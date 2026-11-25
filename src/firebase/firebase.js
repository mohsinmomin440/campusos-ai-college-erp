import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { z } from 'zod';

const firebaseEnvSchema = z.object({
  VITE_FIREBASE_API_KEY: z.string().min(1),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  VITE_FIREBASE_PROJECT_ID: z.string().min(1),
  VITE_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  VITE_FIREBASE_APP_ID: z.string().min(1),
});

export function readFirebaseConfigFromEnv(env = import.meta.env) {
  const useEmulators = String(env?.VITE_USE_FIREBASE_EMULATORS ?? '').toLowerCase() === 'true';
  const emulatorHost = env?.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1';

  const parsed = firebaseEnvSchema.safeParse({
    VITE_FIREBASE_API_KEY: env?.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN: env?.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID: env?.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET: env?.VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID: env?.VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID: env?.VITE_FIREBASE_APP_ID,
  });

  if (!parsed.success) {
    return {
      configured: false,
      mode: 'not_configured',
      useEmulators,
      emulatorHost,
      config: null,
      missingKeys: parsed.error.issues.map((issue) => issue.path.join('.')),
    };
  }

  return {
    configured: true,
    mode: useEmulators ? 'emulator' : 'cloud',
    useEmulators,
    emulatorHost,
    missingKeys: [],
    config: {
      apiKey: parsed.data.VITE_FIREBASE_API_KEY,
      authDomain: parsed.data.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: parsed.data.VITE_FIREBASE_PROJECT_ID,
      storageBucket: parsed.data.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: parsed.data.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: parsed.data.VITE_FIREBASE_APP_ID,
    },
  };
}

let cachedClients = null;
let emulatorsConnected = false;

export function getFirebaseClients() {
  if (cachedClients) return cachedClients;

  const envStatus = readFirebaseConfigFromEnv();
  if (!envStatus.configured) {
    cachedClients = {
      ...envStatus,
      app: null,
      auth: null,
      db: null,
      storage: null,
      functions: null,
    };
    return cachedClients;
  }

  const app = getApps().length ? getApp() : initializeApp(envStatus.config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);
  const functions = getFunctions(app);

  if (envStatus.useEmulators && !emulatorsConnected) {
    const host = envStatus.emulatorHost;
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8080);
    connectStorageEmulator(storage, host, 9199);
    connectFunctionsEmulator(functions, host, 5001);
    emulatorsConnected = true;
  }

  cachedClients = {
    ...envStatus,
    app,
    auth,
    db,
    storage,
    functions,
  };
  return cachedClients;
}

export function resetFirebaseClientsCacheForTests() {
  cachedClients = null;
}
