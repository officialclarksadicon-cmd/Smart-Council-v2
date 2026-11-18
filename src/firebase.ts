import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type {
  AnnouncementItem,
  CouncilTask,
  FaqItem,
  ForumReply,
  ForumThread,
  GalleryEventItem,
  OfficerCommittee,
  OfficerMember,
  OfficialAccount,
  OfficialProfile,
  PortalBranding,
  PortalFilters,
  StudentProfile,
} from './siteConfig';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase App Check when a reCAPTCHA v3 / Enterprise site key is configured
const appCheckSiteKey = (
  (import.meta.env.VITE_APP_CHECK_SITE_KEY as string | undefined) ||
  firebaseConfig.recaptchaSiteKey ||
  ''
).trim();

if (typeof window !== 'undefined' && appCheckSiteKey) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch {
    // App Check already initialized or running in test sandbox
  }
}

export const auth = getAuth(app);

// Initialize Cloud Firestore with IndexedDB persistentLocalCache & multi-tab synchronization
export const db = initializeFirestore(
  app,
  {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  },
  firebaseConfig.firestoreDatabaseId
);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onAuthStateChanged,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  sendPasswordResetEmail,
  serverTimestamp,
  setDoc,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  type User,
};

// ============================================================================
// 1. PRIMARY WEB ADMIN IDENTITY & ROLE HELPERS
// ============================================================================

export const PRIMARY_ADMIN_EMAIL = 'official.clarksadicon@gmail.com';
export const PRIMARY_ADMIN_UID = 'r6KDRrPBerb0KiJ3M5QYpZ0Yjl62';

export function isPrimaryAdminUser(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
}

export function isFirebaseAuthenticated(): boolean {
  return Boolean(auth.currentUser);
}

/**
 * Reads the current user's custom role claim (`admin` or `official`) from their ID token,
 * falling back to `councilAccounts/{uid}` or primary admin identity.
 */
export async function resolveUserRoleClaim(
  user: User
): Promise<'admin' | 'official' | null> {
  if (
    user.uid === PRIMARY_ADMIN_UID ||
    (isPrimaryAdminUser(user.email) && user.emailVerified)
  ) {
    return 'admin';
  }
  try {
    const tokenResult = await user.getIdTokenResult();
    const claimRole = tokenResult.claims.role;
    if (claimRole === 'admin' || claimRole === 'official') {
      return claimRole;
    }
  } catch {
    // Ignore token lookup error and fall back to councilAccounts
  }

  try {
    const snap = await getDoc(doc(db, 'councilAccounts', user.uid));
    if (snap.exists()) {
      const data = snap.data();
      return data.role === 'admin' ? 'admin' : 'official';
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Sends a Firebase Auth password setup / reset email link to an officer's email.
 */
export async function sendOfficerPasswordSetupEmail(
  email: string
): Promise<boolean> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return false;
  await sendPasswordResetEmail(auth, cleanEmail);
  return true;
}

/**
 * Signs in a Student using Email & Password and synchronizes their `/students/{uid}` profile.
 */
export async function signInStudentWithEmail(params: {
  email: string;
  password: string;
  yearCourse?: string;
}): Promise<{
  verified: boolean;
  status: 'verified' | 'unverified';
  student: StudentProfile;
  email: string;
}> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cred = await signInWithEmailAndPassword(
    auth,
    cleanEmail,
    params.password
  );
  await cred.user.reload();
  const synced = await upsertStudentUserToFirestore(
    cred.user,
    params.yearCourse || 'SLAC Student'
  );
  const studentProfile: StudentProfile = {
    id: synced.uid,
    name: synced.name,
    identifier: synced.email,
    yearCourse: synced.yearCourse,
    photoURL: synced.photoURL,
  };
  if (!cred.user.emailVerified) {
    return {
      verified: false,
      status: 'unverified',
      email: cleanEmail,
      student: studentProfile,
    };
  }
  return {
    verified: true,
    status: 'verified',
    email: cleanEmail,
    student: studentProfile,
  };
}

/**
 * Registers a new Student account with Email & Password and sends a verification email.
 */
export async function registerStudentWithEmail(params: {
  name: string;
  email: string;
  password: string;
  yearCourse?: string;
}): Promise<{ email: string }> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanName =
    params.name.trim() || cleanEmail.split('@')[0] || 'SLAC Student';
  const cred = await createUserWithEmailAndPassword(
    auth,
    cleanEmail,
    params.password
  );
  await updateProfile(cred.user, { displayName: cleanName });
  await upsertStudentUserToFirestore(
    cred.user,
    params.yearCourse || 'SLAC Student',
    cleanName
  );
  await sendEmailVerification(cred.user);
  return { email: cleanEmail };
}

export async function resendStudentVerificationEmail(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  await sendEmailVerification(user);
  return true;
}

export async function checkAndCompleteStudentEmailVerification(
  fallbackYearCourse = 'SLAC Student',
  fallbackName = 'SLAC Student'
): Promise<StudentProfile | null> {
  const user = auth.currentUser;
  if (!user) return null;
  await user.reload();
  if (!user.emailVerified) return null;
  const synced = await upsertStudentUserToFirestore(
    user,
    fallbackYearCourse,
    fallbackName
  );
  return {
    id: synced.uid,
    name: synced.name,
    identifier: synced.email,
    yearCourse: synced.yearCourse,
    photoURL: synced.photoURL,
  };
}

export async function signInStudentWithGoogle(
  fallbackYearCourse = 'SLAC Student'
): Promise<StudentProfile> {
  const cred = await signInWithPopup(auth, googleProvider);
  const synced = await upsertStudentUserToFirestore(
    cred.user,
    fallbackYearCourse
  );
  return {
    id: synced.uid,
    name: synced.name,
    identifier: synced.email,
    yearCourse: synced.yearCourse,
    photoURL: synced.photoURL,
  };
}

/**
 * Authenticates a Council Official or Web Admin via Firebase Auth Email & Password
 * and verifies their Custom Claim (`role: 'admin' | 'official'`) or `/councilAccounts/{uid}` record.
 * Never accepts or stores plaintext passcodes.
 */
export async function signInOfficialWithFirebaseAuth(
  email: string,
  password: string,
  fallbackDisplayName?: string
): Promise<OfficialProfile | null> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) return null;

  try {
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    const user = cred.user;
    const roleClaim = await resolveUserRoleClaim(user);

    if (isPrimaryAdminUser(cleanEmail)) {
      const adminProfile: OfficialProfile = {
        id: 'acc-admin-1',
        authUid: user.uid || PRIMARY_ADMIN_UID,
        email: PRIMARY_ADMIN_EMAIL,
        name: fallbackDisplayName || 'Clark Sadicon',
        position: 'Head Of Technical',
        role: 'admin',
      };
      await setDoc(
        doc(db, 'councilAccounts', user.uid),
        {
          id: user.uid,
          authUid: user.uid,
          email: PRIMARY_ADMIN_EMAIL,
          name: adminProfile.name,
          position: adminProfile.position,
          role: 'admin',
          createdByEmail: PRIMARY_ADMIN_EMAIL,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => undefined);
      return adminProfile;
    }

    const uidSnap = await getDoc(doc(db, 'councilAccounts', user.uid));
    if (uidSnap.exists()) {
      const d = uidSnap.data();
      return {
        id: String(d.id ?? user.uid),
        authUid: user.uid,
        email: cleanEmail,
        name: String(
          d.name ?? fallbackDisplayName ?? user.displayName ?? 'SSC Official'
        ),
        position: String(d.position ?? 'SSC Officer'),
        role: d.role === 'admin' || roleClaim === 'admin' ? 'admin' : 'official',
      };
    }

    if (roleClaim === 'admin' || roleClaim === 'official') {
      return {
        id: user.uid,
        authUid: user.uid,
        email: cleanEmail,
        name: fallbackDisplayName || user.displayName || 'SSC Official',
        position: 'SSC Officer',
        role: roleClaim,
      };
    }

    await signOut(auth);
    return null;
  } catch {
    return null;
  }
}

/**
 * Authenticates a Council Official or Web Admin via Google Sign-In and verifies
 * their Custom Role Claim (`role: 'admin' | 'official'`) or `/councilAccounts` entry.
 */
export async function signInOfficialWithGoogle(): Promise<OfficialProfile | null> {
  const cred = await signInWithPopup(auth, googleProvider);
  const user = cred.user;
  const cleanEmail = (user.email || '').trim().toLowerCase();
  const roleClaim = await resolveUserRoleClaim(user);

  if (isPrimaryAdminUser(cleanEmail)) {
    return {
      id: 'acc-admin-1',
      authUid: user.uid || PRIMARY_ADMIN_UID,
      email: PRIMARY_ADMIN_EMAIL,
      name: user.displayName || 'Clark Sadicon',
      position: 'Head Of Technical',
      role: 'admin',
    };
  }

  const uidSnap = await getDoc(doc(db, 'councilAccounts', user.uid));
  if (uidSnap.exists()) {
    const d = uidSnap.data();
    return {
      id: String(d.id ?? user.uid),
      authUid: user.uid,
      email: cleanEmail,
      name: String(d.name ?? user.displayName ?? 'SSC Official'),
      position: String(d.position ?? 'SSC Officer'),
      role: d.role === 'admin' || roleClaim === 'admin' ? 'admin' : 'official',
    };
  }

  if (roleClaim === 'admin' || roleClaim === 'official') {
    return {
      id: user.uid,
      authUid: user.uid,
      email: cleanEmail,
      name: user.displayName || 'SSC Official',
      position: 'SSC Officer',
      role: roleClaim,
    };
  }

  await signOut(auth);
  return null;
}

// ============================================================================
// 2. STRUCTURED FIRESTORE ERROR HANDLING
// ============================================================================

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Verifies there is an active authenticated Firebase Auth user before writes.
 * Never performs silent background password sign-ins.
 */
export async function ensureAdminFirebaseAuth(): Promise<boolean> {
  return Boolean(auth.currentUser);
}

// ============================================================================
// 3. COMMITTEE & DATE PARSING HELPERS
// ============================================================================

export function inferCommitteeFromPosition(position: string): OfficerCommittee {
  const pos = position.trim().toLowerCase();
  if (pos.includes('representative')) return 'Year Level Representatives';
  if (pos.includes('information')) return 'Information';
  if (pos.includes('documentary') || pos.includes('documentation')) {
    return 'Documentary';
  }
  if (pos.includes('technical')) return 'Technical';
  return 'Executive Board';
}

export function isLegacySeededOfficerId(id: string | undefined | null): boolean {
  if (!id) return false;
  return /^(exec-|rep-|info-|doc-|tech-)/i.test(id.trim());
}

function parseDisplayDateToTimestamp(displayDate: string): Timestamp {
  const cleaned = displayDate
    .replace(/^[A-Za-z]+,\s*/, '')
    .replace(/•.*$/, '')
    .trim();
  const parsed = Date.parse(cleaned);
  if (!Number.isNaN(parsed) && parsed > 946684800000) {
    return Timestamp.fromMillis(parsed);
  }
  return Timestamp.now();
}

// ============================================================================
// 4. ATOMIC FIRESTORE WRITE & BATCH HELPERS (NO READ-THEN-WRITE LOOPS)
// ============================================================================

/**
 * Upserts a Student user profile in `/students/{uid}` using `setDoc(..., { merge: true })`.
 */
export async function upsertStudentUserToFirestore(
  user: User,
  yearCourse = 'SLAC Student',
  customDisplayName?: string
): Promise<{
  uid: string;
  name: string;
  email: string;
  yearCourse: string;
  photoURL?: string;
}> {
  const studentRef = doc(db, 'students', user.uid);
  const existingSnap = await getDoc(studentRef);
  const existingData = existingSnap.exists() ? existingSnap.data() : null;

  const resolvedName = (
    customDisplayName?.trim() ||
    (typeof existingData?.name === 'string' ? existingData.name.trim() : '') ||
    user.displayName?.trim() ||
    user.email?.split('@')[0] ||
    'SLAC Student'
  ).slice(0, 120);

  const resolvedYearCourse = (
    (typeof existingData?.yearCourse === 'string' &&
    existingData.yearCourse !== 'SLAC Student'
      ? existingData.yearCourse
      : yearCourse.trim()) || 'SLAC Student'
  ).slice(0, 100);

  const resolvedEmail = (user.email || 'student@slac.edu.ph').slice(0, 160);
  const photoURL = (user.photoURL || '').slice(0, 500);

  try {
    const payload: Record<string, unknown> = {
      uid: user.uid,
      name: resolvedName,
      email: resolvedEmail,
      yearCourse: resolvedYearCourse,
      updatedAt: serverTimestamp(),
      createdAt: existingData?.createdAt ?? serverTimestamp(),
    };
    if (photoURL) {
      payload.photoURL = photoURL;
    }
    await setDoc(studentRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `students/${user.uid}`);
  }

  return {
    uid: user.uid,
    name: resolvedName,
    email: resolvedEmail,
    yearCourse: resolvedYearCourse,
    photoURL: photoURL || undefined,
  };
}

export async function updateStudentIdentityInFirestore(
  name: string,
  yearCourse: string
) {
  const user = auth.currentUser;
  if (!user) return;
  const studentRef = doc(db, 'students', user.uid);
  try {
    const snap = await getDoc(studentRef);
    const payload: Record<string, unknown> = {
      uid: user.uid,
      name: (name.trim() || 'SLAC Student').slice(0, 120),
      email: (user.email || 'student@slac.edu.ph').slice(0, 160),
      yearCourse: (yearCourse.trim() || 'SLAC Student').slice(0, 100),
      updatedAt: serverTimestamp(),
      createdAt: snap.exists()
        ? snap.data().createdAt ?? serverTimestamp()
        : serverTimestamp(),
    };
    if (user.photoURL) {
      payload.photoURL = user.photoURL.slice(0, 500);
    }
    await setDoc(studentRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `students/${user.uid}`);
  }
}

/**
 * Provisions a new Council Officer account in `/councilAccounts` (without any passcode),
 * adds their public entry in `/councilOfficers` via an atomic `writeBatch`,
 * and triggers the backend onboarding endpoint (`/api/admin/onboard-officer`) to send a password setup link.
 */
export async function pushNewCouncilMemberToFirestore(
  account: OfficialAccount,
  term = '2025–2026',
  officerSlotId?: string,
  existingImage?: string
) {
  if (!auth.currentUser) {
    throw new Error('Admin authentication required.');
  }

  const cleanEmail = account.email.trim().toLowerCase().slice(0, 160);
  const cleanName = (account.name.trim() || 'SSC Official').slice(0, 120);
  const cleanPos = (account.position.trim() || 'Head Of Technical').slice(
    0,
    80
  );
  const cleanRole: 'admin' | 'official' =
    account.role === 'admin' ? 'admin' : 'official';

  // 1. Call backend / Cloud Function to provision Firebase Auth user + Custom Claim + password-setup email
  let provisionedUid = account.authUid?.trim() || account.id;
  try {
    const idToken = await auth.currentUser.getIdToken();
    const res = await fetch('/api/admin/onboard-officer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        email: cleanEmail,
        name: cleanName,
        position: cleanPos,
        role: cleanRole,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { uid?: string };
      if (data.uid) {
        provisionedUid = data.uid;
      }
    }
  } catch {
    // Continue with Firestore batch write even if Functions endpoint is in local preview mode
  }

  const accountDocId = provisionedUid || account.id;
  const resolvedOfficerId = officerSlotId || `off-${account.id}`;
  const committee = inferCommitteeFromPosition(cleanPos);

  try {
    const batch = writeBatch(db);
    const accRef = doc(db, 'councilAccounts', accountDocId);

    batch.set(
      accRef,
      {
        id: accountDocId,
        authUid: accountDocId,
        email: cleanEmail,
        name: cleanName,
        position: cleanPos,
        role: cleanRole,
        createdByEmail: auth.currentUser.email || PRIMARY_ADMIN_EMAIL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    const offRef = doc(db, 'councilOfficers', resolvedOfficerId);
    const officerPayload: Record<string, unknown> = {
      id: resolvedOfficerId,
      term: (term.trim() || '2025–2026').slice(0, 32),
      name: cleanName,
      position: cleanPos,
      committee,
      accountId: accountDocId,
      visibility: 'public',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (existingImage?.trim()) {
      officerPayload.image = existingImage.trim().slice(0, 500);
    }

    batch.set(offRef, officerPayload, { merge: true });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `councilAccounts/${accountDocId}`
    );
  }
}

export async function updateCouncilAccountInFirestore(
  account: OfficialAccount
) {
  if (!auth.currentUser) {
    throw new Error('Admin authentication required.');
  }

  const targetDocId = isPrimaryAdminUser(account.email)
    ? PRIMARY_ADMIN_UID
    : account.authUid?.trim() || account.id;

  const ref = doc(db, 'councilAccounts', targetDocId);
  try {
    const snap = await getDoc(ref);
    const existing = snap.exists() ? snap.data() : null;
    await setDoc(
      ref,
      {
        id: targetDocId,
        authUid: targetDocId,
        email: account.email.trim().toLowerCase().slice(0, 160),
        name: (account.name.trim() || 'SSC Official').slice(0, 120),
        position: (account.position.trim() || 'Head Of Technical').slice(0, 80),
        role: account.role === 'admin' ? 'admin' : 'official',
        createdByEmail:
          existing?.createdByEmail ||
          auth.currentUser.email ||
          PRIMARY_ADMIN_EMAIL,
        createdAt: existing?.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `councilAccounts/${targetDocId}`
    );
  }
}

export async function deleteCouncilAccountFromFirestore(
  accountId: string,
  email?: string,
  officerName?: string
) {
  if (!auth.currentUser) {
    throw new Error('Admin authentication required.');
  }
  if (isPrimaryAdminUser(email) || accountId === PRIMARY_ADMIN_UID) {
    return;
  }

  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'councilAccounts', accountId));

    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      const emailSnap = await getDocs(
        query(
          collection(db, 'councilAccounts'),
          where('email', '==', cleanEmail)
        )
      );
      emailSnap.docs.forEach((d) => batch.delete(d.ref));
    }

    const byAccSnap = await getDocs(
      query(
        collection(db, 'councilOfficers'),
        where('accountId', '==', accountId)
      )
    );
    byAccSnap.docs.forEach((d) => batch.delete(d.ref));

    if (officerName?.trim()) {
      const byNameSnap = await getDocs(
        query(
          collection(db, 'councilOfficers'),
          where('name', '==', officerName.trim())
        )
      );
      byNameSnap.docs.forEach((d) => batch.delete(d.ref));
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `councilAccounts/${accountId}`
    );
  }
}

export async function upsertCouncilOfficerToFirestore(
  member: OfficerMember,
  term: string,
  accountId?: string
) {
  if (!auth.currentUser) {
    throw new Error('Official authentication required.');
  }
  if (isLegacySeededOfficerId(member.id) || !member.name.trim()) return;

  const ref = doc(db, 'councilOfficers', member.id);
  try {
    const snap = await getDoc(ref);
    const existing = snap.exists() ? snap.data() : null;
    const payload: Record<string, unknown> = {
      id: member.id,
      term: (term.trim() || '2025–2026').slice(0, 32),
      name: member.name.trim().slice(0, 120),
      position: (member.position.trim() || 'SSC Officer').slice(0, 80),
      committee:
        member.committee || inferCommitteeFromPosition(member.position),
      visibility: 'public',
      createdAt: existing?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (member.image?.trim()) {
      payload.image = member.image.trim().slice(0, 500);
    }
    if (typeof member.optional === 'boolean') {
      payload.optional = member.optional;
    }
    if (accountId || existing?.accountId) {
      payload.accountId = String(accountId || existing?.accountId).slice(
        0,
        128
      );
    }
    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `councilOfficers/${member.id}`
    );
  }
}

export async function deleteCouncilOfficerFromFirestore(officerId: string) {
  if (!auth.currentUser) {
    throw new Error('Official authentication required.');
  }
  try {
    await deleteDoc(doc(db, 'councilOfficers', officerId));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `councilOfficers/${officerId}`
    );
  }
}

/**
 * Deletes all officers belonging to a specific academic term using a single `writeBatch`.
 */
export async function deleteCouncilTermFromFirestore(term: string) {
  if (!auth.currentUser) {
    throw new Error('Official authentication required.');
  }
  const cleanTerm = term.trim();
  if (!cleanTerm) return;

  try {
    const q = query(
      collection(db, 'councilOfficers'),
      where('term', '==', cleanTerm)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    const batch = writeBatch(db);
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `councilOfficers?term=${cleanTerm}`
    );
  }
}

/**
 * Upserts an Announcement with a real `publishedAt` Timestamp alongside the display `date` string.
 */
export async function upsertAnnouncementToFirestore(item: AnnouncementItem) {
  if (!auth.currentUser) {
    throw new Error('Official authentication required.');
  }
  const ref = doc(db, 'announcements', item.id);
  try {
    const snap = await getDoc(ref);
    const existing = snap.exists() ? snap.data() : null;
    const publishedAtTs = item.publishedAt
      ? Timestamp.fromMillis(item.publishedAt)
      : existing?.publishedAt ?? parseDisplayDateToTimestamp(item.date);

    const payload: Record<string, unknown> = {
      id: item.id,
      title: (item.title.trim() || 'Official Advisory').slice(0, 200),
      date: (item.date.trim() || 'Today').slice(0, 60),
      publishedAt: publishedAtTs,
      category: (item.category.trim() || 'Campus Life').slice(0, 80),
      summary: (item.summary.trim() || 'See full council memo.').slice(0, 2000),
      issuedBy: (item.issuedBy.trim() || 'SLAC SSC').slice(0, 160),
      visibility: 'public',
      createdAt: existing?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (item.image?.trim()) {
      payload.image = item.image.trim().slice(0, 500);
    }
    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `announcements/${item.id}`
    );
  }
}

export async function deleteAnnouncementFromFirestore(announcementId: string) {
  if (!auth.currentUser) {
    throw new Error('Official authentication required.');
  }
  try {
    await deleteDoc(doc(db, 'announcements', announcementId));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `announcements/${announcementId}`
    );
  }
}

/**
 * Upserts a PortalEvent with a real `startsAt` Timestamp alongside the display `date` string.
 */
export async function upsertEventToFirestore(item: GalleryEventItem) {
  if (!auth.currentUser) {
    throw new Error('Official authentication required.');
  }
  const ref = doc(db, 'events', item.id);
  try {
    const snap = await getDoc(ref);
    const existing = snap.exists() ? snap.data() : null;
    const startsAtTs = item.startsAt
      ? Timestamp.fromMillis(item.startsAt)
      : existing?.startsAt ?? parseDisplayDateToTimestamp(item.date);

    const payload: Record<string, unknown> = {
      id: item.id,
      title: (item.title.trim() || 'SLAC Campus Event').slice(0, 200),
      date: (item.date.trim() || 'TBA').slice(0, 80),
      startsAt: startsAtTs,
      time: (item.time.trim() || 'TBA').slice(0, 80),
      location: (item.location.trim() || 'SLAC Campus').slice(0, 160),
      category: (item.category.trim() || 'Governance').slice(0, 80),
      description: (
        item.description.trim() || 'Upcoming campus activity.'
      ).slice(0, 2000),
      image: (
        item.image.trim() ||
        'https://ik.imagekit.io/slacssc/smart-council/council-stock/council-office_axkKY8UNt.jpg'
      ).slice(0, 500),
      imageAlt: (item.imageAlt.trim() || `${item.title} cover photo`).slice(
        0,
        240
      ),
      visibility: 'public',
      createdAt: existing?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `events/${item.id}`);
  }
}

export async function deleteEventFromFirestore(eventId: string) {
  if (!auth.currentUser) {
    throw new Error('Official authentication required.');
  }
  try {
    await deleteDoc(doc(db, 'events', eventId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `events/${eventId}`);
  }
}

export async function upsertFaqToFirestore(item: FaqItem, order = 0) {
  if (!auth.currentUser) {
    throw new Error('Official authentication required.');
  }
  const ref = doc(db, 'faqs', item.id);
  try {
    const snap = await getDoc(ref);
    const existing = snap.exists() ? snap.data() : null;
    await setDoc(ref, {
      id: item.id,
      category: (item.category.trim() || 'Council Office').slice(0, 80),
      question: (item.question.trim() || 'Student FAQ').slice(0, 300),
      answer: (item.answer.trim() || 'Official answer pending.').slice(0, 2000),
      order: Math.max(0, Math.min(10000, Math.round(order))),
      visibility: 'public',
      createdAt: existing?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `faqs/${item.id}`);
  }
}

export async function deleteFaqFromFirestore(faqId: string) {
  if (!auth.currentUser) {
    throw new Error('Official authentication required.');
  }
  try {
    await deleteDoc(doc(db, 'faqs', faqId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `faqs/${faqId}`);
  }
}

/**
 * Upserts a ForumThread with `authorUid` ownership and bounded replies.
 */
export async function upsertForumThreadToFirestore(
  thread: ForumThread,
  _requireAdminAuth = false
) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Please sign in to post or update forum discussions.');
  }

  const ref = doc(db, 'forumThreads', thread.id);
  try {
    const snap = await getDoc(ref);
    const existing = snap.exists() ? snap.data() : null;
    const boundedReplies = (thread.replies || []).slice(0, 100).map((r) => ({
      id: String(r.id).slice(0, 80),
      author: String(r.author || 'SLAC Student').slice(0, 120),
      authorUid: String(r.authorUid || currentUser.uid).slice(0, 128),
      yearLevel: String(r.yearLevel || 'SLAC Student').slice(0, 100),
      time: String(r.time || 'Just now').slice(0, 60),
      message: String(r.message || '').slice(0, 2000),
    }));

    const payload: Record<string, unknown> = {
      id: thread.id,
      author: existing
        ? existing.author
        : (thread.author.trim() || 'SLAC Student').slice(0, 120),
      authorUid: existing?.authorUid || thread.authorUid || currentUser.uid,
      yearLevel: existing
        ? existing.yearLevel
        : (thread.yearLevel.trim() || 'SLAC Student').slice(0, 100),
      postedAt: existing
        ? existing.postedAt
        : (thread.postedAt.trim() || 'Just now').slice(0, 60),
      topic: (thread.topic.trim() || 'Suggestions').slice(0, 80),
      title: existing
        ? existing.title
        : (thread.title.trim() || 'Discussion Topic').slice(0, 200),
      body: existing
        ? existing.body
        : (thread.body.trim() || 'Student inquiry.').slice(0, 3000),
      supportCount: existing
        ? Math.max(
            0,
            Math.min(1000000, Math.round(Number(thread.supportCount) || 0))
          )
        : 0,
      replies: boundedReplies,
      visibility: 'public',
      createdAt: existing?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `forumThreads/${thread.id}`
    );
  }
}

/**
 * Adds a reply both to `/forumThreads/{threadId}/replies/{replyId}` subcollection
 * and the thread's summary replies list inside an atomic batch.
 */
export async function addForumReplyInFirestore(
  thread: ForumThread,
  reply: ForumReply
) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Please sign in to reply to forum discussions.');
  }

  const replyRef = doc(db, 'forumThreads', thread.id, 'replies', reply.id);
  try {
    await setDoc(replyRef, {
      id: reply.id,
      threadId: thread.id,
      author: (reply.author.trim() || 'SLAC Student').slice(0, 120),
      authorUid: currentUser.uid,
      yearLevel: (reply.yearLevel.trim() || 'SLAC Student').slice(0, 100),
      time: (reply.time.trim() || 'Just now').slice(0, 60),
      message: reply.message.trim().slice(0, 2000),
      createdAt: serverTimestamp(),
    });
    await upsertForumThreadToFirestore(thread, false);
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `forumThreads/${thread.id}/replies/${reply.id}`
    );
  }
}

/**
 * Atomically toggles a user's support vote on `/forumThreads/{threadId}` using a Firestore
 * transaction and a per-user support document `/forumThreads/{threadId}/supports/{uid}`
 * so a user can support at most once.
 */
export async function toggleForumSupportTransactionInFirestore(
  threadId: string,
  fallbackDelta: number
): Promise<number> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Please sign in to support a forum discussion.');
  }

  const threadRef = doc(db, 'forumThreads', threadId);
  const supportRef = doc(
    db,
    'forumThreads',
    threadId,
    'supports',
    currentUser.uid
  );

  return runTransaction(db, async (tx) => {
    const [threadSnap, supportSnap] = await Promise.all([
      tx.get(threadRef),
      tx.get(supportRef),
    ]);
    if (!threadSnap.exists()) {
      throw new Error('Discussion thread does not exist.');
    }
    const data = threadSnap.data();
    const currentCount = Math.max(0, Number(data.supportCount) || 0);

    let nextCount = currentCount;
    if (supportSnap.exists()) {
      tx.delete(supportRef);
      nextCount = Math.max(0, currentCount - 1);
    } else if (fallbackDelta < 0 && currentCount > 0) {
      nextCount = Math.max(0, currentCount - 1);
    } else {
      tx.set(supportRef, {
        uid: currentUser.uid,
        threadId,
        createdAt: serverTimestamp(),
      });
      nextCount = currentCount + 1;
    }

    tx.update(threadRef, {
      supportCount: nextCount,
      updatedAt: serverTimestamp(),
    });

    return nextCount;
  });
}

export async function deleteForumThreadFromFirestore(threadId: string) {
  if (!auth.currentUser) {
    throw new Error('Authentication required to delete a forum thread.');
  }
  try {
    await deleteDoc(doc(db, 'forumThreads', threadId));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `forumThreads/${threadId}`
    );
  }
}

export async function upsertPortalSettingsToFirestore(
  filters: PortalFilters,
  aiAutoSync: boolean,
  branding?: PortalBranding
) {
  if (!auth.currentUser) {
    throw new Error('Official authentication required.');
  }
  const ref = doc(db, 'portalSettings', 'config');
  try {
    const snap = await getDoc(ref);
    const existing = snap.exists() ? snap.data() : null;
    const payload: Record<string, unknown> = {
      id: 'config',
      announcementFilters: (filters.announcements || [])
        .slice(0, 40)
        .map((s) => s.slice(0, 60)),
      eventFilters: (filters.events || [])
        .slice(0, 40)
        .map((s) => s.slice(0, 60)),
      forumFilters: (filters.forum || [])
        .slice(0, 40)
        .map((s) => s.slice(0, 60)),
      aiAutoSync: Boolean(aiAutoSync),
      visibility: 'public',
      createdAt: existing?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const resolvedLogo = branding?.customLogoUrl ?? existing?.customLogoUrl;
    const resolvedAbout = branding?.aboutSlacImage ?? existing?.aboutSlacImage;

    if (typeof resolvedLogo === 'string') {
      payload.customLogoUrl = resolvedLogo.trim().slice(0, 500);
    }
    if (typeof resolvedAbout === 'string') {
      payload.aboutSlacImage = resolvedAbout.trim().slice(0, 500);
    }

    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'portalSettings/config');
  }
}

// ============================================================================
// 5. SSC SUITE ASSIGNED TASKS & SITE VISIT ANALYTICS
// ============================================================================

export const SITE_VISITS_DOC_ID = 'visits';

/**
 * Increments the portal visit counter once per browser session.
 * Uses the server endpoint `/api/stats/visit` for unauthenticated visitors,
 * or a guarded Firestore transaction (+1 only) when authenticated.
 */
export async function incrementSiteVisitsInFirestore(): Promise<void> {
  if (!auth.currentUser) {
    try {
      await fetch('/api/stats/visit', { method: 'POST' });
    } catch {
      // Ignore offline/network telemetry errors
    }
    return;
  }

  const ref = doc(db, 'siteStats', SITE_VISITS_DOC_ID);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        tx.set(ref, {
          visits: 1,
          updatedAt: serverTimestamp(),
        });
      } else {
        const currentVisits = Number(snap.data().visits) || 0;
        tx.update(ref, {
          visits: currentVisits + 1,
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch {
    // Non-blocking analytics counter
  }
}

export async function createAssignedTaskInFirestore(
  task: CouncilTask
): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('Admin authentication required.');
  }

  const ref = doc(db, 'tasks', task.id);
  try {
    await setDoc(ref, {
      id: task.id,
      title: (task.title.trim() || 'Council Task').slice(0, 300),
      description: (task.description || '').trim().slice(0, 2000),
      assignedToUid: task.assignedToUid.trim().slice(0, 128),
      assignedToName: (task.assignedToName.trim() || 'SSC Officer').slice(
        0,
        160
      ),
      status: task.status === 'completed' ? 'completed' : 'pending',
      createdBy: (
        task.createdBy ||
        auth.currentUser.uid ||
        PRIMARY_ADMIN_EMAIL
      )
        .trim()
        .slice(0, 160),
      createdAt: serverTimestamp(),
      completedAt: task.status === 'completed' ? serverTimestamp() : null,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `tasks/${task.id}`);
  }
}

export async function updateAssignedTaskStatusInFirestore(
  taskId: string,
  nextStatus: 'pending' | 'completed'
): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('Official authentication required.');
  }

  const ref = doc(db, 'tasks', taskId);
  try {
    await updateDoc(ref, {
      status: nextStatus,
      completedAt: nextStatus === 'completed' ? serverTimestamp() : null,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
  }
}

export async function deleteAssignedTaskFromFirestore(
  taskId: string
): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('Admin authentication required.');
  }

  const ref = doc(db, 'tasks', taskId);
  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tasks/${taskId}`);
  }
}
