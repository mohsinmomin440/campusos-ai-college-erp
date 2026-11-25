import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { getFirebaseClients } from './firebase';
import { ROLES } from '@/schemas/roles';

export function subscribeAuthState(callback) {
  const { auth, configured } = getFirebaseClients();
  if (!configured || !auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function loginWithEmail(email, password) {
  const { auth, configured } = getFirebaseClients();
  if (!configured || !auth) {
    throw new Error('Firebase Authentication is not configured.');
  }
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function registerUserAccount({ email, password, displayName }) {
  const { auth, db, configured } = getFirebaseClients();
  if (!configured || !auth || !db) {
    throw new Error('Firebase Authentication is not configured.');
  }
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (displayName) {
    await updateProfile(cred.user, { displayName: displayName.trim() });
  }
  await setDoc(
    doc(db, 'users', cred.user.uid),
    {
      uid: cred.user.uid,
      email: cred.user.email,
      displayName: displayName?.trim() || email.split('@')[0],
      tenantIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return cred.user;
}

export async function logoutCurrentUser() {
  const { auth } = getFirebaseClients();
  if (auth) {
    await signOut(auth);
  }
}

export async function requestPasswordReset(email) {
  const { auth, configured } = getFirebaseClients();
  if (!configured || !auth) {
    throw new Error('Firebase Authentication is not configured.');
  }
  await sendPasswordResetEmail(auth, email.trim());
}

export async function resendVerificationEmail() {
  const { auth } = getFirebaseClients();
  if (!auth?.currentUser) {
    throw new Error('No signed-in user.');
  }
  await sendEmailVerification(auth.currentUser);
}

export async function loadUserContext(user) {
  const { db, configured } = getFirebaseClients();
  if (!configured || !db || !user) {
    return { profile: null, memberships: [], tenants: [] };
  }

  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  let profile = userSnap.exists() ? userSnap.data() : null;

  if (!profile) {
    profile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email || 'Campus User',
      tenantIds: [],
    };
    try {
      await setDoc(userRef, { ...profile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
    } catch {
      // Ignore if rules block profile creation in partial state
    }
  }

  const isSuperAdmin = profile.platformRole === ROLES.PLATFORM_SUPER_ADMIN;
  const memberships = [];
  const tenants = [];

  if (isSuperAdmin) {
    const allTenantsSnap = await getDocs(collection(db, 'tenants'));
    for (const tDoc of allTenantsSnap.docs) {
      const tData = { id: tDoc.id, ...tDoc.data() };
      tenants.push(tData);
      memberships.push({
        tenantId: tDoc.id,
        uid: user.uid,
        role: ROLES.PLATFORM_SUPER_ADMIN,
        status: 'active',
        displayName: profile.displayName || user.email,
      });
    }
  } else {
    const tenantIds = Array.isArray(profile.tenantIds) ? profile.tenantIds : [];
    for (const tId of tenantIds) {
      try {
        const [tSnap, mSnap] = await Promise.all([
          getDoc(doc(db, 'tenants', tId)),
          getDoc(doc(db, 'tenants', tId, 'members', user.uid)),
        ]);
        if (tSnap.exists() && mSnap.exists()) {
          tenants.push({ id: tSnap.id, ...tSnap.data() });
          memberships.push({ id: mSnap.id, tenantId: tId, ...mSnap.data() });
        }
      } catch {
        // Skip tenants this user cannot read
      }
    }
  }

  return { profile, memberships, tenants, isSuperAdmin };
}
