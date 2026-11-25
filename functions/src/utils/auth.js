import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

export const ROLES = Object.freeze({
  PLATFORM_SUPER_ADMIN: 'platform_super_admin',
  COLLEGE_ADMIN: 'college_admin',
  PRINCIPAL: 'principal',
  HOD: 'hod',
  FACULTY: 'faculty',
  ADMISSION_OFFICER: 'admission_officer',
  ACCOUNTANT: 'accountant',
  LIBRARIAN: 'librarian',
  PLACEMENT_OFFICER: 'placement_officer',
  STUDENT: 'student',
  PARENT: 'parent',
  AUDITOR: 'auditor',
});

export function getDb() {
  return getFirestore();
}

export function requireAuth(request) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required to perform this action.');
  }
  return request.auth;
}

export async function isPlatformSuperAdmin(uid, token = {}) {
  if (token?.platformRole === ROLES.PLATFORM_SUPER_ADMIN) {
    return true;
  }
  const userSnap = await getDb().collection('users').doc(uid).get();
  return userSnap.exists && userSnap.data()?.platformRole === ROLES.PLATFORM_SUPER_ADMIN;
}

export async function requireTenantRole(request, tenantId, allowedRoles = []) {
  const auth = requireAuth(request);
  if (!tenantId || typeof tenantId !== 'string') {
    throw new HttpsError('invalid-argument', 'A valid tenantId is required.');
  }

  const db = getDb();
  const isSuper = await isPlatformSuperAdmin(auth.uid, auth.token);
  const tenantSnap = await db.collection('tenants').doc(tenantId).get();
  if (!tenantSnap.exists) {
    throw new HttpsError('not-found', 'Tenant college record was not found.');
  }
  const tenant = tenantSnap.data();

  if (isSuper) {
    return {
      uid: auth.uid,
      role: ROLES.PLATFORM_SUPER_ADMIN,
      tenant,
      member: { uid: auth.uid, role: ROLES.PLATFORM_SUPER_ADMIN, status: 'active' },
      isSuper: true,
    };
  }

  if (tenant.status !== 'active') {
    throw new HttpsError('permission-denied', 'This college tenant is currently suspended or inactive.');
  }

  const memberSnap = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('members')
    .doc(auth.uid)
    .get();

  if (!memberSnap.exists) {
    throw new HttpsError('permission-denied', 'You are not a member of this college tenant.');
  }

  const member = memberSnap.data();
  if (member.status !== 'active') {
    throw new HttpsError('permission-denied', 'Your tenant membership is disabled or pending.');
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(member.role)) {
    throw new HttpsError('permission-denied', 'Your role is not authorized for this operation.');
  }

  return {
    uid: auth.uid,
    role: member.role,
    tenant,
    member,
    isSuper: false,
  };
}

export async function writeAuditLog({
  tenantId,
  actorUid,
  actorRole,
  module,
  action,
  targetId = null,
  summary,
  metadata = {},
}) {
  if (!tenantId) return;
  await getDb()
    .collection('tenants')
    .doc(tenantId)
    .collection('auditLogs')
    .add({
      tenantId,
      actorUid,
      actorRole,
      module,
      action,
      targetId,
      summary,
      metadata,
      createdAt: FieldValue.serverTimestamp(),
    });
}
