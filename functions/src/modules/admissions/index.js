import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getDb, requireTenantRole, ROLES, writeAuditLog } from '../../utils/auth.js';

const decideAdmissionSchema = z.object({
  tenantId: z.string().min(3),
  applicationId: z.string().min(1),
  decision: z.enum(['under_review', 'approved', 'rejected', 'enrolled']),
  remarks: z.string().max(500).optional().default(''),
  enrollmentNumber: z.string().max(40).optional(),
  courseId: z.string().optional(),
  departmentId: z.string().optional(),
  academicYearId: z.string().optional(),
  semesterId: z.string().optional(),
});

export const decideAdmission = onCall(async (request) => {
  const parsed = decideAdmissionSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues.map((i) => i.message).join('; '));
  }
  const input = parsed.data;
  const ctx = await requireTenantRole(request, input.tenantId, [
    ROLES.PLATFORM_SUPER_ADMIN,
    ROLES.COLLEGE_ADMIN,
    ROLES.PRINCIPAL,
    ROLES.ADMISSION_OFFICER,
  ]);

  const db = getDb();
  const tenantRef = db.collection('tenants').doc(input.tenantId);
  const appRef = tenantRef.collection('admissions').doc(input.applicationId);

  const outcome = await db.runTransaction(async (tx) => {
    const appSnap = await tx.get(appRef);
    if (!appSnap.exists) {
      throw new HttpsError('not-found', 'Admission application not found.');
    }
    const app = appSnap.data();

    if (app.status === 'enrolled' && input.decision === 'enrolled') {
      return { alreadyEnrolled: true, studentId: app.convertedStudentId || null };
    }

    tx.update(appRef, {
      status: input.decision,
      reviewedByUid: ctx.uid,
      reviewRemarks: input.remarks,
      reviewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    let studentId = app.convertedStudentId || null;
    if (input.decision === 'enrolled' && !studentId) {
      const studentRef = tenantRef.collection('students').doc();
      studentId = studentRef.id;
      const enrollmentNo =
        input.enrollmentNumber?.trim() ||
        `CMP-${new Date().getFullYear()}-${studentId.slice(0, 6).toUpperCase()}`;

      tx.set(studentRef, {
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        uid: app.applicantUid || '',
        enrollmentNumber: enrollmentNo,
        fullName: app.applicantName,
        email: String(app.email || '').trim().toLowerCase(),
        phone: app.phone || '',
        guardianName: app.guardianName || '',
        guardianPhone: app.guardianPhone || '',
        departmentId: input.departmentId || app.departmentId || '',
        courseId: input.courseId || app.courseId || '',
        academicYearId: input.academicYearId || app.academicYearId || '',
        semesterId: input.semesterId || 'sem-1',
        status: 'active',
        createdByUid: ctx.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      tx.update(appRef, {
        convertedStudentId: studentId,
        enrolledAt: FieldValue.serverTimestamp(),
      });
    }

    return { alreadyEnrolled: false, studentId, applicantName: app.applicantName };
  });

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUid: ctx.uid,
    actorRole: ctx.role,
    module: 'admissions',
    action: `admission_${input.decision}`,
    targetId: input.applicationId,
    summary: `Set application ${input.applicationId} to "${input.decision}"${outcome.studentId ? ` (Student ${outcome.studentId})` : ''}.`,
  });

  return { ok: true, decision: input.decision, ...outcome };
});
