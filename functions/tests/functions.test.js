import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPaymentToInvoice,
  computeGradeAndStatus,
  validateAssignRoleTransition,
  normalizeInviteEmail,
  encodeEmailDocId,
  minimizePii,
  getGeminiConfigurationStatus,
} from '../src/core/handlers.js';

test('Finance: applyPaymentToInvoice computes exact minor-unit balances', () => {
  const partial = applyPaymentToInvoice({ totalMinor: 2500000, paidMinor: 0, paymentMinor: 1000000 });
  assert.deepEqual(partial, { nextPaid: 1000000, nextBalance: 1500000, nextStatus: 'partial' });

  const full = applyPaymentToInvoice({ totalMinor: 2500000, paidMinor: 1000000, paymentMinor: 1500000 });
  assert.deepEqual(full, { nextPaid: 2500000, nextBalance: 0, nextStatus: 'paid' });
});

test('Finance: rejects overpayment and non-integer amounts', () => {
  assert.throws(() => applyPaymentToInvoice({ totalMinor: 1000, paidMinor: 500, paymentMinor: 600 }), /exceeds outstanding/i);
  assert.throws(() => applyPaymentToInvoice({ totalMinor: 1000, paidMinor: 0, paymentMinor: 10.5 }), /integer minor units/i);
});

test('Examinations: computeGradeAndStatus calculates grades deterministically', () => {
  assert.deepEqual(computeGradeAndStatus(92, 100, 40), { percentage: 92, grade: 'O', passed: true });
  assert.deepEqual(computeGradeAndStatus(35, 100, 40), { percentage: 35, grade: 'F', passed: false });
});

test('Users RBAC: blocks self role escalation and non-super-admin assigning platform_super_admin', () => {
  assert.throws(
    () =>
      validateAssignRoleTransition({
        actorRole: 'college_admin',
        isSuper: false,
        actorUid: 'u1',
        targetUid: 'u2',
        targetCurrentRole: 'faculty',
        nextRole: 'platform_super_admin',
      }),
    /Platform Super Admins/i
  );

  assert.throws(
    () =>
      validateAssignRoleTransition({
        actorRole: 'principal',
        isSuper: false,
        actorUid: 'u1',
        targetUid: 'u1',
        targetCurrentRole: 'principal',
        nextRole: 'college_admin',
      }),
    /cannot change their own/i
  );
});

test('Gemini AI governance: minimizes PII and detects unconfigured key safely', () => {
  const redacted = minimizePii('Contact student@college.edu or +91 9876543210 for fee receipt.');
  assert.equal(redacted.includes('student@college.edu'), false);
  assert.equal(redacted.includes('9876543210'), false);
  assert.match(redacted, /\[REDACTED_EMAIL\]/);
  assert.match(redacted, /\[REDACTED_PHONE\]/);

  const prev = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  assert.equal(getGeminiConfigurationStatus().configured, false);
  if (prev !== undefined) process.env.GEMINI_API_KEY = prev;
});

test('Users invitations: normalizes emails and generates safe Firestore doc IDs', () => {
  assert.equal(normalizeInviteEmail('  Faculty@College.EDU '), 'faculty@college.edu');
  const id1 = encodeEmailDocId('Faculty@College.EDU');
  const id2 = encodeEmailDocId('faculty@college.edu');
  assert.equal(id1, id2);
  assert.equal(id1.includes('/'), false);
});
