import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirebaseClients } from './firebase';

export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateUploadFile(file) {
  if (!file) {
    throw new Error('Please choose a file to upload.');
  }
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
    throw new Error('Only PDF, JPG, PNG, or WEBP files are permitted.');
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new Error('File exceeds the maximum allowed size of 5 MB.');
  }
}

export async function uploadTenantDocument({ tenantId, folder = 'documents', file, ownerUid }) {
  validateUploadFile(file);
  const { storage, configured } = getFirebaseClients();
  if (!configured || !storage) {
    throw new Error('Firebase Storage is not configured.');
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `tenants/${tenantId}/${folder}/${ownerUid || 'shared'}/${Date.now()}-${safeName}`;
  const fileRef = ref(storage, storagePath);
  const snapshot = await uploadBytes(fileRef, file, {
    contentType: file.type,
    customMetadata: {
      tenantId,
      uploadedBy: ownerUid || '',
    },
  });
  const downloadUrl = await getDownloadURL(snapshot.ref);
  return {
    storagePath,
    downloadUrl,
    contentType: file.type,
    sizeBytes: file.size,
    fileName: file.name,
  };
}

export async function deleteTenantStorageFile(storagePath) {
  const { storage, configured } = getFirebaseClients();
  if (!configured || !storage || !storagePath) return;
  await deleteObject(ref(storage, storagePath));
}
