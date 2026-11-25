import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { createCampusActionRunner } from './core/handlers.js';

if (!getApps().length) {
  initializeApp();
}

const runner = createCampusActionRunner({
  getDb: () => getFirestore(),
  getAdminAuth: () => getAuth(),
  FieldValue,
  createError: (code, message) => new HttpsError(code, message),
  serviceName: 'campusos-functions',
});

export const healthCheck = onCall((request) => runner.healthCheck(request.auth));
export const getBootstrapStatus = onCall((request) => runner.getBootstrapStatus(request.auth));
export const bootstrapPlatform = onCall((request) => runner.bootstrapPlatform(request.auth, request.data));
export const provisionTenant = onCall((request) => runner.provisionTenant(request.auth, request.data));
export const updateTenantStatus = onCall((request) => runner.updateTenantStatus(request.auth, request.data));
export const assignMemberRole = onCall((request) => runner.assignMemberRole(request.auth, request.data));
export const claimPendingInvitations = onCall((request) => runner.claimPendingInvitations(request.auth));
export const decideAdmission = onCall((request) => runner.decideAdmission(request.auth, request.data));
export const publishExamResults = onCall((request) => runner.publishExamResults(request.auth, request.data));
export const recordPayment = onCall((request) => runner.recordPayment(request.auth, request.data));
export const issueFeeAdjustment = onCall((request) => runner.issueFeeAdjustment(request.auth, request.data));
export const getAiStatus = onCall((request) => runner.getAiStatus(request.auth));
export const runCampusAi = onCall((request) => runner.runCampusAi(request.auth, request.data));

export const paymentWebhook = onRequest(async (req, res) => {
  const result = runner.verifyPaymentWebhookSignature({
    rawBody: JSON.stringify(req.body || {}),
    signature: req.get('x-campusos-signature') || '',
  });
  if (!result.configured) {
    res.status(503).json({
      ok: false,
      configured: false,
      error: 'Payment gateway webhook secret is not configured on the server.',
    });
    return;
  }
  if (!result.valid) {
    res.status(401).json({ ok: false, error: 'Invalid webhook signature.' });
    return;
  }
  res.status(200).json({ ok: true, verified: true });
});
