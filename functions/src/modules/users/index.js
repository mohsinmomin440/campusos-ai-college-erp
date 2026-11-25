import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { z } from 'zod';
import { getDb, isPlatformSuperAdmin, requireAuth, requireTenantRole, ROLES, writeAuditLog } from '../../utils/auth.js';

const provisionTenantSchema = z.object({
  tenantId: z.string().regex(/^[a-z0-9-]{3,40}$/),
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(20),
  city: z.string().max(80).optional().default(''),
  state: z.string().max(80).optional().default(''),
  subscriptionPlan: z.enum(['starter', 'growth', 'enterprise']).default('growth'),
  adminEmail: z.string().email().optional(),
  adminName: z.string().min(2).max(100).optional(),
});

const bootstrapPlatformSchema = z.object({
  tenantId: z.string().regex(/^[a-z0-9-]{3,40}$/),
  collegeName: z.string().min(2).max(120),
  collegeCode: z.string().min(2).max(20),
  city: z.string().max(80).optional().default(''),
  state: z.string().max(80).optional().default(''),
});

const updateTenantStatusSchema = z.object({
  tenantId: z.string().min(3),
  status: z.enum(['active', 'suspended']),
  subscriptionPlan: z.enum(['starter', 'growth', 'enterprise']).optional(),
});

const assignMemberRoleSchema = z.object({
  tenantId: z.string().min(3),
  targetUid: z.string().min(1).optional(),
  email: z.string().email().optional(),
  displayName: z.string().min(2).max(120),
  role: z.enum(Object.values(ROLES)),
  status: z.enum(['active', 'disabled']).default('active'),
  departmentId: z.string().optional().default(''),
  linkedStudentIds: z.array(z.string()).max(20).optional().default([]),
});

export function normalizeInviteEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function encodeEmailDocId(email) {
  return Buffer.from(normalizeInviteEmail(email), 'utf8').toString('base64url');
}

export function validateAssignRoleTransition({ actorRole, isSuper, actorUid, targetUid, targetCurrentRole, nextRole }) {
  if (!isSuper && nextRole === ROLES.PLATFORM_SUPER_ADMIN) {
    throw new HttpsError('permission-denied', 'Only Platform Super Admins can assign the platform_super_admin role.');
  }
  if (!isSuper && targetCurrentRole === ROLES.PLATFORM_SUPER_ADMIN) {
    throw new HttpsError('permission-denied', 'Cannot modify a Platform Super Admin account.');
  }
  if (!isSuper && actorUid === targetUid && nextRole !== actorRole) {
    throw new HttpsError('permission-denied', 'Users cannot change their own privileged role.');
  }
}

async function bindStudentUidIfPresent(db, tenantId, email, uid) {
  if (!email || !uid) return;
  const normalized = normalizeInviteEmail(email);
  const stuSnap = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('students')
    .where('email', '==', normalized)
    .limit(5)
    .get();
  if (stuSnap.empty) return;
  const batch = db.batch();
  stuSnap.docs.forEach((docSnap) => {
    if (!docSnap.data()?.uid) {
      batch.update(docSnap.ref, { uid, updatedAt: FieldValue.serverTimestamp() });
    }
  });
  await batch.commit();
}

export const getBootstrapStatus = onCall(async (request) => {
  requireAuth(request);
  const snap = await getDb().collection('system').doc('bootstrap').get();
  return { initialized: snap.exists };
});

/**
 * One-time transactional initialization for a fresh production Firebase deployment.
 * Permanently locks after creating the first Platform Super Admin and first college tenant.
 */
export const bootstrapPlatform = onCall(async (request) => {
  const auth = requireAuth(request);
  const parsed = bootstrapPlatformSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues.map((i) => i.message).join('; '));
  }
  const input = parsed.data;
  const db = getDb();
  const bootstrapRef = db.collection('system').doc('bootstrap');
  const tenantRef = db.collection('tenants').doc(input.tenantId);
  const userRef = db.collection('users').doc(auth.uid);

  await db.runTransaction(async (tx) => {
    const bootSnap = await tx.get(bootstrapRef);
    if (bootSnap.exists) {
      throw new HttpsError('failed-precondition', 'CampusOS platform is already initialized.');
    }
    const existingTenant = await tx.get(tenantRef);
    if (existingTenant.exists) {
      throw new HttpsError('already-exists', `Tenant "${input.tenantId}" already exists.`);
    }

    const email = auth.token?.email || '';
    const displayName = auth.token?.name || email || 'Platform Owner';

    tx.set(bootstrapRef, {
      initialized: true,
      initializedByUid: auth.uid,
      firstTenantId: input.tenantId,
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.set(
      userRef,
      {
        uid: auth.uid,
        email,
        displayName,
        platformRole: ROLES.PLATFORM_SUPER_ADMIN,
        defaultTenantId: input.tenantId,
        tenantIds: FieldValue.arrayUnion(input.tenantId),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    tx.set(tenantRef, {
      tenantId: input.tenantId,
      name: input.collegeName,
      code: input.collegeCode.toUpperCase(),
      city: input.city,
      state: input.state,
      subscriptionPlan: 'enterprise',
      status: 'active',
      currency: 'INR',
      attendanceThresholdPercent: 75,
      createdByUid: auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(tenantRef.collection('members').doc(auth.uid), {
      uid: auth.uid,
      tenantId: input.tenantId,
      email,
      displayName,
      role: ROLES.PLATFORM_SUPER_ADMIN,
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUid: auth.uid,
    actorRole: ROLES.PLATFORM_SUPER_ADMIN,
    module: 'administration',
    action: 'platform_bootstrapped',
    targetId: input.tenantId,
    summary: `Initialized CampusOS platform and provisioned primary tenant ${input.collegeName}.`,
  });

  return { ok: true, tenantId: input.tenantId };
});

export const provisionTenant = onCall(async (request) => {
  const auth = requireAuth(request);
  const superAdmin = await isPlatformSuperAdmin(auth.uid, auth.token);
  if (!superAdmin) {
    throw new HttpsError('permission-denied', 'Only Platform Super Admin can provision a college tenant.');
  }

  const parsed = provisionTenantSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues.map((i) => i.message).join('; '));
  }
  const input = parsed.data;
  const db = getDb();
  const tenantRef = db.collection('tenants').doc(input.tenantId);

  const existing = await tenantRef.get();
  if (existing.exists) {
    throw new HttpsError('already-exists', `Tenant "${input.tenantId}" already exists.`);
  }

  await tenantRef.set({
    tenantId: input.tenantId,
    name: input.name,
    code: input.code.toUpperCase(),
    city: input.city,
    state: input.state,
    subscriptionPlan: input.subscriptionPlan,
    status: 'active',
    currency: 'INR',
    attendanceThresholdPercent: 75,
    createdByUid: auth.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (input.adminEmail) {
    const normalizedAdminEmail = normalizeInviteEmail(input.adminEmail);
    let adminUser = null;
    try {
      adminUser = await getAuth().getUserByEmail(normalizedAdminEmail);
    } catch {
      adminUser = null;
    }
    if (adminUser) {
      await tenantRef.collection('members').doc(adminUser.uid).set({
        uid: adminUser.uid,
        tenantId: input.tenantId,
        email: normalizedAdminEmail,
        displayName: input.adminName || adminUser.displayName || normalizedAdminEmail,
        role: ROLES.COLLEGE_ADMIN,
        status: 'active',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await db.collection('users').doc(adminUser.uid).set(
        {
          uid: adminUser.uid,
          email: normalizedAdminEmail,
          displayName: input.adminName || adminUser.displayName || normalizedAdminEmail,
          defaultTenantId: input.tenantId,
          tenantIds: FieldValue.arrayUnion(input.tenantId),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      await tenantRef.collection('invitations').doc(encodeEmailDocId(normalizedAdminEmail)).set({
        tenantId: input.tenantId,
        email: normalizedAdminEmail,
        displayName: input.adminName || normalizedAdminEmail,
        role: ROLES.COLLEGE_ADMIN,
        status: 'pending',
        linkedStudentIds: [],
        invitedByUid: auth.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUid: auth.uid,
    actorRole: ROLES.PLATFORM_SUPER_ADMIN,
    module: 'administration',
    action: 'tenant_provisioned',
    targetId: input.tenantId,
    summary: `Provisioned college tenant ${input.name} (${input.code.toUpperCase()}) on ${input.subscriptionPlan} plan.`,
  });

  return { ok: true, tenantId: input.tenantId };
});

export const updateTenantStatus = onCall(async (request) => {
  const auth = requireAuth(request);
  const superAdmin = await isPlatformSuperAdmin(auth.uid, auth.token);
  if (!superAdmin) {
    throw new HttpsError('permission-denied', 'Only Platform Super Admin can update college tenant status.');
  }

  const parsed = updateTenantStatusSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues.map((i) => i.message).join('; '));
  }
  const input = parsed.data;
  const db = getDb();
  const tenantRef = db.collection('tenants').doc(input.tenantId);
  const snap = await tenantRef.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Tenant not found.');
  }

  const updates = {
    status: input.status,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (input.subscriptionPlan) {
    updates.subscriptionPlan = input.subscriptionPlan;
  }

  await tenantRef.update(updates);

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUid: auth.uid,
    actorRole: ROLES.PLATFORM_SUPER_ADMIN,
    module: 'administration',
    action: 'tenant_status_updated',
    targetId: input.tenantId,
    summary: `Updated tenant status to ${input.status}${input.subscriptionPlan ? ` (${input.subscriptionPlan})` : ''}.`,
  });

  return { ok: true, tenantId: input.tenantId, status: input.status };
});

export const assignMemberRole = onCall(async (request) => {
  const parsed = assignMemberRoleSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues.map((i) => i.message).join('; '));
  }
  const input = parsed.data;
  const ctx = await requireTenantRole(request, input.tenantId, [
    ROLES.PLATFORM_SUPER_ADMIN,
    ROLES.COLLEGE_ADMIN,
    ROLES.PRINCIPAL,
  ]);

  const db = getDb();
  const normalizedEmail = input.email ? normalizeInviteEmail(input.email) : '';
  let targetUid = input.targetUid;
  let resolvedEmail = normalizedEmail;

  if (!targetUid && normalizedEmail) {
    try {
      const userRecord = await getAuth().getUserByEmail(normalizedEmail);
      targetUid = userRecord.uid;
      resolvedEmail = normalizeInviteEmail(userRecord.email || normalizedEmail);
    } catch {
      targetUid = null;
    }
  }

  // If the user has not registered yet, create a tamper-proof pending invitation
  if (!targetUid) {
    if (!normalizedEmail) {
      throw new HttpsError('invalid-argument', 'Either targetUid or email is required.');
    }
    validateAssignRoleTransition({
      actorRole: ctx.role,
      isSuper: ctx.isSuper,
      actorUid: ctx.uid,
      targetUid: normalizedEmail,
      targetCurrentRole: null,
      nextRole: input.role,
    });

    const inviteRef = db
      .collection('tenants')
      .doc(input.tenantId)
      .collection('invitations')
      .doc(encodeEmailDocId(normalizedEmail));

    await inviteRef.set({
      tenantId: input.tenantId,
      email: normalizedEmail,
      displayName: input.displayName,
      role: input.role,
      status: 'pending',
      departmentId: input.departmentId,
      linkedStudentIds: input.linkedStudentIds,
      invitedByUid: ctx.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await writeAuditLog({
      tenantId: input.tenantId,
      actorUid: ctx.uid,
      actorRole: ctx.role,
      module: 'security',
      action: 'member_invited',
      targetId: normalizedEmail,
      summary: `Created pending "${input.role}" invitation for ${input.displayName} (${normalizedEmail}).`,
    });

    return { ok: true, invited: true, email: normalizedEmail, role: input.role };
  }

  const memberRef = db.collection('tenants').doc(input.tenantId).collection('members').doc(targetUid);
  const existingSnap = await memberRef.get();
  const currentRole = existingSnap.exists ? existingSnap.data()?.role : null;

  validateAssignRoleTransition({
    actorRole: ctx.role,
    isSuper: ctx.isSuper,
    actorUid: ctx.uid,
    targetUid,
    targetCurrentRole: currentRole,
    nextRole: input.role,
  });

  await memberRef.set(
    {
      uid: targetUid,
      tenantId: input.tenantId,
      email: resolvedEmail || existingSnap.data()?.email || '',
      displayName: input.displayName,
      role: input.role,
      status: input.status,
      departmentId: input.departmentId,
      linkedStudentIds: input.linkedStudentIds,
      updatedAt: FieldValue.serverTimestamp(),
      ...(existingSnap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    },
    { merge: true }
  );

  await db.collection('users').doc(targetUid).set(
    {
      uid: targetUid,
      email: resolvedEmail || existingSnap.data()?.email || '',
      displayName: input.displayName,
      defaultTenantId: input.tenantId,
      tenantIds: FieldValue.arrayUnion(input.tenantId),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  if (input.role === ROLES.STUDENT && resolvedEmail) {
    await bindStudentUidIfPresent(db, input.tenantId, resolvedEmail, targetUid);
  }

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUid: ctx.uid,
    actorRole: ctx.role,
    module: 'security',
    action: 'member_role_assigned',
    targetId: targetUid,
    summary: `Assigned role "${input.role}" (${input.status}) to ${input.displayName}.`,
    metadata: { previousRole: currentRole, nextRole: input.role, status: input.status },
  });

  return { ok: true, invited: false, targetUid, role: input.role, status: input.status };
});

/**
 * Automatically claims pending tenant invitations for an authenticated user matching their email.
 * In production cloud mode, requires email_verified === true to prevent email-squatting hijacks.
 */
export const claimPendingInvitations = onCall(async (request) => {
  const auth = requireAuth(request);
  const rawEmail = auth.token?.email;
  if (!rawEmail) {
    return { claimed: 0 };
  }
  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
  if (!isEmulator && auth.token?.email_verified !== true) {
    return { claimed: 0, reason: 'email_verification_required' };
  }

  const normalizedEmail = normalizeInviteEmail(rawEmail);
  const db = getDb();
  const pendingSnap = await db
    .collectionGroup('invitations')
    .where('email', '==', normalizedEmail)
    .where('status', '==', 'pending')
    .get();

  if (pendingSnap.empty) {
    return { claimed: 0 };
  }

  let claimed = 0;
  for (const inviteDoc of pendingSnap.docs) {
    const invite = inviteDoc.data();
    const tenantId = invite.tenantId;
    if (!tenantId) continue;

    await db.runTransaction(async (tx) => {
      const freshInvite = await tx.get(inviteDoc.ref);
      if (!freshInvite.exists || freshInvite.data()?.status !== 'pending') return;

      const memberRef = db.collection('tenants').doc(tenantId).collection('members').doc(auth.uid);
      tx.set(
        memberRef,
        {
          uid: auth.uid,
          tenantId,
          email: normalizedEmail,
          displayName: invite.displayName || auth.token?.name || normalizedEmail,
          role: invite.role,
          status: 'active',
          departmentId: invite.departmentId || '',
          linkedStudentIds: invite.linkedStudentIds || [],
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(
        db.collection('users').doc(auth.uid),
        {
          uid: auth.uid,
          email: normalizedEmail,
          displayName: invite.displayName || auth.token?.name || normalizedEmail,
          defaultTenantId: tenantId,
          tenantIds: FieldValue.arrayUnion(tenantId),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.update(inviteDoc.ref, {
        status: 'accepted',
        acceptedByUid: auth.uid,
        acceptedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    if (invite.role === ROLES.STUDENT) {
      await bindStudentUidIfPresent(db, tenantId, normalizedEmail, auth.uid);
    }

    await writeAuditLog({
      tenantId,
      actorUid: auth.uid,
      actorRole: invite.role,
      module: 'security',
      action: 'invitation_claimed',
      targetId: auth.uid,
      summary: `User ${normalizedEmail} accepted pending "${invite.role}" invitation.`,
    });
    claimed += 1;
  }

  return { claimed };
});
