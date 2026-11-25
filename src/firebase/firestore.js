import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseClients } from './firebase';

export function requireDb() {
  const { db, configured } = getFirebaseClients();
  if (!configured || !db) {
    throw new Error('Firebase Firestore is not configured. Add VITE_FIREBASE_* environment variables.');
  }
  return db;
}

export function requireFunctions() {
  const { functions, configured } = getFirebaseClients();
  if (!configured || !functions) {
    throw new Error('Firebase Cloud Functions client is not configured.');
  }
  return functions;
}

export async function callTrustedFunction(name, payload = {}) {
  const { auth, useEmulators } = getFirebaseClients();
  const configuredApiBase = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
  const isVercelOrigin =
    typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app');
  const httpApiBase = configuredApiBase || (isVercelOrigin ? '/api' : '');

  if (!useEmulators && httpApiBase) {
    const token = auth?.currentUser ? await auth.currentUser.getIdToken() : '';
    const res = await fetch(`${httpApiBase}/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload || {}),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error || `Server request "${name}" failed (${res.status}).`);
    }
    return body;
  }

  const functions = requireFunctions();
  const fn = httpsCallable(functions, name);
  const result = await fn(payload);
  return result.data;
}

export function tenantCollection(tenantId, collectionName) {
  if (!tenantId) throw new Error('tenantId is required for tenant-scoped collection access.');
  return collection(requireDb(), 'tenants', tenantId, collectionName);
}

export function tenantDoc(tenantId, collectionName, docId) {
  if (!tenantId || !docId) throw new Error('tenantId and docId are required.');
  return doc(requireDb(), 'tenants', tenantId, collectionName, docId);
}

export async function listTenantDocs(tenantId, collectionName, constraints = []) {
  const ref = tenantCollection(tenantId, collectionName);
  const q = constraints.length ? query(ref, ...constraints) : query(ref);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getTenantDoc(tenantId, collectionName, docId) {
  const snap = await getDoc(tenantDoc(tenantId, collectionName, docId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createTenantDoc(tenantId, collectionName, data, customId = null) {
  const payload = {
    ...data,
    tenantId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (customId) {
    const ref = tenantDoc(tenantId, collectionName, customId);
    await setDoc(ref, payload);
    return { id: customId, ...payload };
  }
  const ref = await addDoc(tenantCollection(tenantId, collectionName), payload);
  return { id: ref.id, ...payload };
}

export async function updateTenantDoc(tenantId, collectionName, docId, data) {
  const ref = tenantDoc(tenantId, collectionName, docId);
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTenantDoc(tenantId, collectionName, docId) {
  await deleteDoc(tenantDoc(tenantId, collectionName, docId));
}

export { where, orderBy, limit, serverTimestamp, doc, getDoc, getDocs, query, collection };
