import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getDb, requireTenantRole, ROLES, writeAuditLog } from '../../utils/auth.js';

export function computeGradeAndStatus(obtainedMarks, maxMarks, passMarks) {
  if (maxMarks <= 0) {
    throw new Error('maxMarks must be positive');
  }
  const percentage = Math.round((obtainedMarks / maxMarks) * 10000) / 100;
  const passed = obtainedMarks >= passMarks;
  let grade = 'F';
  if (!passed) {
    grade = 'F';
  } else if (percentage >= 90) {
    grade = 'O';
  } else if (percentage >= 80) {
    grade = 'A+';
  } else if (percentage >= 70) {
    grade = 'A';
  } else if (percentage >= 60) {
    grade = 'B+';
  } else if (percentage >= 50) {
    grade = 'B';
  } else {
    grade = 'C';
  }
  return { percentage, grade, passed };
}

const publishExamResultsSchema = z.object({
  tenantId: z.string().min(3),
  examId: z.string().min(1),
});

export const publishExamResults = onCall(async (request) => {
  const parsed = publishExamResultsSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues.map((i) => i.message).join('; '));
  }
  const { tenantId, examId } = parsed.data;
  const ctx = await requireTenantRole(request, tenantId, [
    ROLES.PLATFORM_SUPER_ADMIN,
    ROLES.COLLEGE_ADMIN,
    ROLES.PRINCIPAL,
  ]);

  const db = getDb();
  const tenantRef = db.collection('tenants').doc(tenantId);
  const examRef = tenantRef.collection('examinations').doc(examId);
  const examSnap = await examRef.get();
  if (!examSnap.exists) {
    throw new HttpsError('not-found', 'Examination not found.');
  }
  const exam = examSnap.data();

  const resultsSnap = await tenantRef
    .collection('results')
    .where('examId', '==', examId)
    .get();

  if (resultsSnap.empty) {
    throw new HttpsError('failed-precondition', 'Cannot publish an examination with zero entered marks.');
  }

  const maxMarks = Number(exam.maxMarks || 100);
  const passMarks = Number(exam.passMarks || 40);

  // Process in chunks <= 400 to stay safely within Firestore 500-op batch limit
  const docs = resultsSnap.docs;
  let publishedCount = 0;

  for (let i = 0; i < docs.length; i += 200) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + 200);
    for (const docSnap of chunk) {
      const r = docSnap.data();
      const obtained = Number(r.marksObtained ?? 0);
      if (obtained < 0 || obtained > maxMarks) {
        throw new HttpsError(
          'failed-precondition',
          `Invalid marks (${obtained}) for student ${r.studentName || r.studentId}; must be 0..${maxMarks}.`
        );
      }
      const { percentage, grade, passed } = computeGradeAndStatus(obtained, maxMarks, passMarks);
      batch.update(docSnap.ref, {
        maxMarks,
        passMarks,
        percentage,
        grade,
        passed,
        published: true,
        publishedByUid: ctx.uid,
        publishedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (r.studentUid) {
        const notifRef = tenantRef.collection('notifications').doc();
        batch.set(notifRef, {
          tenantId,
          recipientUid: r.studentUid,
          title: `Results Published: ${exam.title}`,
          message: `Your marks for ${r.subjectName || exam.title} (${grade}, ${percentage}%) are now available.`,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      publishedCount += 1;
    }
    await batch.commit();
  }

  await examRef.update({
    status: 'published',
    publishedByUid: ctx.uid,
    publishedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await writeAuditLog({
    tenantId,
    actorUid: ctx.uid,
    actorRole: ctx.role,
    module: 'examinations',
    action: 'results_published',
    targetId: examId,
    summary: `Published ${publishedCount} verified result records for examination "${exam.title}".`,
  });

  return { ok: true, examId, publishedCount };
});
