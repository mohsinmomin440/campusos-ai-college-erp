import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createCampusActionRunner, getGeminiConfigurationStatus } from '../functions/src/core/handlers.js';

const ERROR_STATUS_MAP = {
  unauthenticated: 401,
  'permission-denied': 403,
  'invalid-argument': 400,
  'not-found': 404,
  'already-exists': 409,
  'failed-precondition': 412,
  'resource-exhausted': 429,
  unavailable: 503,
};

class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.statusCode = ERROR_STATUS_MAP[code] || 500;
  }
}

function parseServiceAccountFromEnv() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson && rawJson.trim().startsWith('{')) {
    return JSON.parse(rawJson);
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }
  return null;
}

function ensureAdminInitialized() {
  if (getApps().length) return true;
  const serviceAccount = parseServiceAccountFromEnv();
  if (!serviceAccount) return false;
  initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id || serviceAccount.projectId,
  });
  return true;
}

function getAllowedOrigins() {
  const list = [
    'https://campusos-erp-24bca088.web.app',
    'https://campusos-erp-24bca088.firebaseapp.com',
    'http://127.0.0.1:5173',
    'http://localhost:5173',
  ];
  if (process.env.VERCEL_URL) list.push(`https://${process.env.VERCEL_URL}`);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) list.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',').forEach((o) => {
      if (o.trim()) list.push(o.trim());
    });
  }
  return new Set(list);
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  const allowed = getAllowedOrigins();
  if (origin && allowed.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-campusos-signature');
}

const runner = createCampusActionRunner({
  getDb: () => getFirestore(),
  getAdminAuth: () => getAuth(),
  FieldValue,
  createError: (code, message) => new ApiError(code, message),
  serviceName: 'campusos-vercel-api',
});

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const action = Array.isArray(req.query.action) ? req.query.action[0] : req.query.action;
  if (!action) {
    res.status(404).json({ ok: false, error: 'Missing API action.' });
    return;
  }

  if (action === 'paymentWebhook') {
    const sigRes = runner.verifyPaymentWebhookSignature({
      rawBody: JSON.stringify(req.body || {}),
      signature: req.headers['x-campusos-signature'] || '',
    });
    if (!sigRes.configured) {
      res.status(503).json({ ok: false, configured: false, error: 'Payment gateway webhook secret is not configured on the server.' });
      return;
    }
    if (!sigRes.valid) {
      res.status(401).json({ ok: false, error: 'Invalid webhook signature.' });
      return;
    }
    res.status(200).json({ ok: true, verified: true });
    return;
  }

  const adminReady = ensureAdminInitialized();

  if (action === 'healthCheck') {
    const gemini = getGeminiConfigurationStatus();
    let authenticated = false;
    const authHeader = req.headers.authorization || '';
    if (adminReady && authHeader.startsWith('Bearer ')) {
      try {
        await getAuth().verifyIdToken(authHeader.slice(7));
        authenticated = true;
      } catch {
        authenticated = false;
      }
    }
    res.status(200).json({
      ok: true,
      service: 'campusos-vercel-api',
      emulator: false,
      authenticated,
      firebaseAdminConfigured: adminReady,
      geminiConfigured: gemini.configured,
      paymentGatewayConfigured: Boolean(process.env.PAYMENT_WEBHOOK_SECRET),
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (!adminReady) {
    res.status(503).json({
      ok: false,
      error:
        'Server Firebase Admin credentials (FIREBASE_SERVICE_ACCOUNT_JSON) are not configured yet in Vercel Environment Variables.',
    });
    return;
  }

  let auth = null;
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    try {
      const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
      auth = { uid: decoded.uid, token: decoded };
    } catch {
      res.status(401).json({ ok: false, error: 'Invalid or expired Firebase authentication token.' });
      return;
    }
  }

  const allowedActions = {
    getBootstrapStatus: () => runner.getBootstrapStatus(auth),
    bootstrapPlatform: () => runner.bootstrapPlatform(auth, req.body || {}),
    provisionTenant: () => runner.provisionTenant(auth, req.body || {}),
    updateTenantStatus: () => runner.updateTenantStatus(auth, req.body || {}),
    assignMemberRole: () => runner.assignMemberRole(auth, req.body || {}),
    claimPendingInvitations: () => runner.claimPendingInvitations(auth),
    decideAdmission: () => runner.decideAdmission(auth, req.body || {}),
    publishExamResults: () => runner.publishExamResults(auth, req.body || {}),
    recordPayment: () => runner.recordPayment(auth, req.body || {}),
    issueFeeAdjustment: () => runner.issueFeeAdjustment(auth, req.body || {}),
    getAiStatus: () => runner.getAiStatus(auth),
    runCampusAi: () => runner.runCampusAi(auth, req.body || {}),
  };

  const execFn = allowedActions[action];
  if (!execFn) {
    res.status(404).json({ ok: false, error: `Unknown CampusOS endpoint "${action}".` });
    return;
  }

  try {
    const result = await execFn();
    res.status(200).json(result);
  } catch (err) {
    const status = err instanceof ApiError ? err.statusCode : 500;
    res.status(status).json({ ok: false, code: err.code || 'internal', error: err.message });
  }
}
