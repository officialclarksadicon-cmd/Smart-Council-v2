import { initializeApp } from 'firebase/app';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  getAuth,
  linkWithCredential,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  AnnouncementItem,
  FaqItem,
  ForumThread,
  GalleryEventItem,
  OfficerCommittee,
  OfficerMember,
  OfficerTermRoster,
  OfficialAccount,
  OfficialProfile,
  PortalBranding,
  PortalFilters,
  StudentProfile,
  siteConfig,
} from './siteConfig';
import { isCorruptedImageUrl } from './utils/imagekit';

export const PRIMARY_ADMIN_EMAIL = 'official.clarksadicon@gmail.com';
export const PRIMARY_ADMIN_UID = 'r6KDRrPBerb0KiJ3M5QYpZ0Yjl62';

// Initialize Firebase SDK for project smart-council-368be
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

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
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export function sanitizeFirestoreId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return cleaned || `doc-${Date.now()}`;
}

/**
 * Ensures we never write a 500-char truncated base64 data URL to Firestore.
 * Only clean ImageKit / HTTPS URLs (<= 500 chars) are written to Firestore.
 */
function sanitizeFirestoreImageUrl(
  rawUrl?: string,
  fallbackUrl?: string
): string | undefined {
  if (!rawUrl || !rawUrl.trim()) return fallbackUrl;
  const trimmed = rawUrl.trim();
  if (isCorruptedImageUrl(trimmed)) return fallbackUrl;
  if (trimmed.startsWith('data:image/') || trimmed.length > 500) {
    return fallbackUrl;
  }
  return trimmed;
}

export function inferCommitteeFromPosition(position: string): OfficerCommittee {
  const normalized = position.toLowerCase();
  if (normalized.includes('representative')) {
    return 'Year Level Representatives';
  }
  if (normalized.includes('information')) {
    return 'Information';
  }
  if (normalized.includes('document')) {
    return 'Documentary';
  }
  if (normalized.includes('technical')) {
    return 'Technical';
  }
  return 'Executive Board';
}

export function isPrimaryAdminUser(email?: string | null): boolean {
  return (email ?? '').trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
}

export function isFirebaseAdminAuthenticated(): boolean {
  return (
    auth.currentUser?.uid === PRIMARY_ADMIN_UID ||
    isPrimaryAdminUser(auth.currentUser?.email)
  );
}

export function isFirebaseAuthenticated(): boolean {
  return Boolean(auth.currentUser);
}

export async function provisionOfficerInFirebaseAuth(
  email: string,
  passcode: string,
  displayName: string
): Promise<string | null> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPasscode =
    passcode.trim().length >= 6
      ? passcode.trim()
      : passcode.trim().padEnd(6, '0');

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPasscode,
          displayName: displayName.trim(),
          returnSecureToken: true,
        }),
      }
    );

    const data = (await res.json().catch(() => ({}))) as {
      localId?: string;
      error?: { message?: string };
    };

    if (res.ok && data.localId) {
      return data.localId;
    }

    if (data.error?.message === 'EMAIL_EXISTS') {
      const signInRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            password: cleanPasscode,
            returnSecureToken: true,
          }),
        }
      );
      const signInData = (await signInRes.json().catch(() => ({}))) as {
        localId?: string;
      };
      if (signInRes.ok && signInData.localId) {
        return signInData.localId;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function linkAdminPasswordIfPossible(
  user: User,
  passcode = '123456'
): Promise<void> {
  if (!isPrimaryAdminUser(user.email)) return;
  const hasPasswordProvider = user.providerData.some(
    (p) => p.providerId === 'password'
  );
  if (hasPasswordProvider) return;

  try {
    const cred = EmailAuthProvider.credential(PRIMARY_ADMIN_EMAIL, passcode);
    await linkWithCredential(user, cred);
  } catch {
    // Ignore if already linked or requires recent login
  }
}

export async function upsertOfficialUserToFirestore(
  _authUid: string,
  _account: OfficialAccount
): Promise<void> {
  // Retired duplicate officialUsers writes; all accounts live in councilAccounts.
  return;
}

export async function signInOfficialWithFirebaseAuth(
  email: string,
  passcode: string,
  displayName?: string
): Promise<OfficialProfile | null> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPasscode =
    passcode.trim().length >= 6
      ? passcode.trim()
      : passcode.trim().padEnd(6, '0');

  if (
    auth.currentUser &&
    auth.currentUser.email?.toLowerCase() === cleanEmail
  ) {
    if (isPrimaryAdminUser(cleanEmail)) {
      await linkAdminPasswordIfPossible(auth.currentUser, cleanPasscode);
    }
  } else {
    try {
      await signInWithEmailAndPassword(auth, cleanEmail, cleanPasscode);
    } catch {
      if (displayName) {
        await provisionOfficerInFirebaseAuth(
          cleanEmail,
          cleanPasscode,
          displayName
        );
        try {
          await signInWithEmailAndPassword(auth, cleanEmail, cleanPasscode);
        } catch {
          // Ignore if Google provider without password linked yet
        }
      }
    }
  }

  if (auth.currentUser) {
    if (isPrimaryAdminUser(auth.currentUser.email)) {
      return {
        id: 'acc-admin-1',
        email: PRIMARY_ADMIN_EMAIL,
        name: 'Clark Sadicon',
        position: 'Head Of Technical',
        role: 'admin',
      };
    }

    try {
      const uidSnap = await getDoc(
        doc(db, 'councilAccounts', auth.currentUser.uid)
      );
      if (uidSnap.exists()) {
        const d = uidSnap.data();
        return {
          id: String(d.id ?? auth.currentUser.uid),
          email: cleanEmail,
          name: String(d.name ?? auth.currentUser.displayName ?? 'SSC Official'),
          position: String(d.position ?? 'SSC Officer'),
          role: d.role === 'admin' ? 'admin' : 'official',
        };
      }

      const byEmailSnap = await getDocs(
        query(collection(db, 'councilAccounts'), where('email', '==', cleanEmail))
      );
      if (!byEmailSnap.empty) {
        const d = byEmailSnap.docs[0].data();
        return {
          id: String(d.id ?? byEmailSnap.docs[0].id),
          email: cleanEmail,
          name: String(d.name ?? auth.currentUser.displayName ?? 'SSC Official'),
          position: String(d.position ?? 'SSC Officer'),
          role: d.role === 'admin' ? 'admin' : 'official',
        };
      }
    } catch {
      // Fallback to caller's matched account if present
    }
  }

  return null;
}

export async function ensureAdminFirebaseAuth(): Promise<User> {
  if (auth.currentUser) {
    if (isFirebaseAdminAuthenticated()) {
      await linkAdminPasswordIfPossible(auth.currentUser);
      return auth.currentUser;
    }
    try {
      const offSnap = await getDoc(
        doc(db, 'officialUsers', auth.currentUser.uid)
      );
      if (offSnap.exists() && offSnap.data()?.role === 'admin') {
        return auth.currentUser;
      }
    } catch {
      // Fall through to primary admin auth fallback
    }
  }

  try {
    const passCred = await signInWithEmailAndPassword(
      auth,
      PRIMARY_ADMIN_EMAIL,
      '123456'
    );
    return passCred.user;
  } catch {
    const credential = await signInWithPopup(auth, googleProvider);
    if (!isPrimaryAdminUser(credential.user.email)) {
      await signOut(auth);
      throw new Error(
        `Only a Web Admin can manage officer accounts.`
      );
    }
    await linkAdminPasswordIfPossible(credential.user);
    return credential.user;
  }
}

async function saveVerifiedStudentProfile(
  user: User,
  yearCourseInput?: string,
  fallbackName?: string
): Promise<StudentProfile> {
  const uid = user.uid;
  const email = (user.email ?? '').trim();
  const displayName = (
    user.displayName ||
    fallbackName ||
    email.split('@')[0] ||
    'SLAC Student'
  )
    .trim()
    .slice(0, 120);
  const yearCourse =
    (yearCourseInput ?? '').trim().slice(0, 100) || 'SLAC College Student';

  const studentPath = `students/${uid}`;
  const studentRef = doc(db, 'students', uid);

  try {
    const existingSnap = await getDoc(studentRef);
    if (existingSnap.exists()) {
      const existingData = existingSnap.data();
      const resolvedName =
        displayName ||
        (typeof existingData.name === 'string' && existingData.name
          ? existingData.name
          : 'SLAC Student');
      const resolvedCourse =
        (yearCourseInput ?? '').trim() ||
        (typeof existingData.yearCourse === 'string' && existingData.yearCourse
          ? existingData.yearCourse
          : 'SLAC College Student');

      const updatePayload: Record<string, unknown> = {
        uid,
        name: resolvedName,
        email: existingData.email || email,
        yearCourse: resolvedCourse,
        createdAt: existingData.createdAt,
        updatedAt: serverTimestamp(),
      };
      if (user.photoURL && user.photoURL.length <= 500) {
        updatePayload.photoURL = user.photoURL;
      }

      await setDoc(studentRef, updatePayload);
      return {
        id: uid,
        name: resolvedName,
        identifier: email,
        yearCourse: resolvedCourse,
        photoURL: user.photoURL ?? undefined,
      };
    } else {
      const createPayload: Record<string, unknown> = {
        uid,
        name: displayName,
        email,
        yearCourse,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (user.photoURL && user.photoURL.length <= 500) {
        createPayload.photoURL = user.photoURL;
      }

      await setDoc(studentRef, createPayload);
      return {
        id: uid,
        name: displayName,
        identifier: email,
        yearCourse,
        photoURL: user.photoURL ?? undefined,
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, studentPath);
  }
}

export async function signInStudentWithGoogle(
  yearCourseInput?: string
): Promise<StudentProfile> {
  const credential = await signInWithPopup(auth, googleProvider);
  return saveVerifiedStudentProfile(credential.user, yearCourseInput);
}

export async function registerStudentWithEmail(params: {
  name: string;
  email: string;
  password: string;
  yearCourse?: string;
}): Promise<{ verificationSent: true; email: string }> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanName = params.name.trim().slice(0, 120) || 'SLAC Student';

  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      cleanEmail,
      params.password
    );
    await updateProfile(credential.user, { displayName: cleanName }).catch(
      () => undefined
    );
    await sendEmailVerification(credential.user).catch(() => undefined);
    return {
      verificationSent: true,
      email: credential.user.email ?? cleanEmail,
    };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message.toLowerCase() : '';
    if (rawMsg.includes('email-already-in-use')) {
      try {
        const existingCred = await signInWithEmailAndPassword(
          auth,
          cleanEmail,
          params.password
        );
        await reload(existingCred.user).catch(() => undefined);
        if (!existingCred.user.emailVerified) {
          await updateProfile(existingCred.user, {
            displayName: cleanName,
          }).catch(() => undefined);
          await sendEmailVerification(existingCred.user).catch(() => undefined);
          return {
            verificationSent: true,
            email: existingCred.user.email ?? cleanEmail,
          };
        }
      } catch {
        // Fall through
      }
    }
    throw err;
  }
}

export async function signInStudentWithEmail(params: {
  email: string;
  password: string;
  yearCourse?: string;
}): Promise<
  | { verified: true; student: StudentProfile }
  | { verified: false; email: string }
> {
  const cleanEmail = params.email.trim().toLowerCase();
  const credential = await signInWithEmailAndPassword(
    auth,
    cleanEmail,
    params.password
  );
  await reload(credential.user);

  if (!credential.user.emailVerified) {
    return {
      verified: false,
      email: credential.user.email ?? cleanEmail,
    };
  }

  await credential.user.getIdToken(true);
  const student = await saveVerifiedStudentProfile(
    credential.user,
    params.yearCourse
  );
  return {
    verified: true,
    student,
  };
}

export async function resendStudentVerificationEmail(): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('Sign in with your email and password first.');
  }
  await reload(auth.currentUser);
  if (auth.currentUser.emailVerified) return;
  await sendEmailVerification(auth.currentUser);
}

export async function checkAndCompleteStudentEmailVerification(
  yearCourseInput?: string,
  fallbackName?: string
): Promise<StudentProfile | null> {
  if (!auth.currentUser) return null;
  await reload(auth.currentUser);
  if (!auth.currentUser.emailVerified) {
    return null;
  }
  await auth.currentUser.getIdToken(true);
  return saveVerifiedStudentProfile(
    auth.currentUser,
    yearCourseInput,
    fallbackName
  );
}

export async function updateStudentIdentityInFirestore(
  name: string,
  yearCourse: string
): Promise<StudentProfile | null> {
  if (!auth.currentUser) return null;
  const cleanName = name.trim().slice(0, 120) || 'SLAC Student';
  const cleanCourse = yearCourse.trim().slice(0, 100) || 'SLAC Student';
  try {
    await updateProfile(auth.currentUser, { displayName: cleanName }).catch(
      () => undefined
    );
  } catch {
    // Ignore
  }
  return saveVerifiedStudentProfile(auth.currentUser, cleanCourse, cleanName);
}

const LEGACY_SEEDED_OFFICER_ID_REGEX =
  /^(2019-2020|2020-2021|2021-2022|2022-2023|2023-2024|2024-2025|2025-2026)-(pres|vp|sec|asec|tres|aud|bm|rep1|rep2|rep3|rep4|hinfo|minfo|einfo|hdoc|doc|htech|tech)$/;

export function isLegacySeededOfficerId(id: string): boolean {
  return LEGACY_SEEDED_OFFICER_ID_REGEX.test(id.trim());
}

export async function upsertCouncilOfficerToFirestore(
  member: OfficerMember,
  termLabel: string,
  accountId?: string
): Promise<void> {
  if (!isFirebaseAuthenticated()) return;

  const cleanId = sanitizeFirestoreId(member.id);
  const officerRef = doc(db, 'councilOfficers', cleanId);
  const officerPath = `councilOfficers/${cleanId}`;

  try {
    const snap = await getDoc(officerRef);
    const basePayload: Record<string, unknown> = {
      id: cleanId,
      term: termLabel.trim().slice(0, 32) || '2025–2026',
      name: member.name.trim().slice(0, 120),
      position: member.position.trim().slice(0, 80) || 'SSC Officer',
      committee: member.committee,
      visibility: 'public',
      updatedAt: serverTimestamp(),
    };

    const safeImg = sanitizeFirestoreImageUrl(member.image);
    if (safeImg) {
      basePayload.image = safeImg;
    }
    if (typeof member.optional === 'boolean') {
      basePayload.optional = member.optional;
    }
    if (accountId) {
      basePayload.accountId = sanitizeFirestoreId(accountId);
    }

    if (snap.exists()) {
      const existingData = snap.data();
      await setDoc(officerRef, {
        ...basePayload,
        createdAt: existingData.createdAt,
      });
    } else {
      await setDoc(officerRef, {
        ...basePayload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, officerPath);
  }
}

export async function deleteCouncilOfficerFromFirestore(
  officerId: string
): Promise<void> {
  if (!isFirebaseAuthenticated()) return;
  const cleanId = sanitizeFirestoreId(officerId);
  const path = `councilOfficers/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'councilOfficers', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteCouncilTermFromFirestore(
  termLabel: string
): Promise<void> {
  if (!isFirebaseAuthenticated()) return;
  try {
    const snap = await getDocs(
      query(
        collection(db, 'councilOfficers'),
        where('visibility', '==', 'public')
      )
    );
    for (const docSnap of snap.docs) {
      const d = docSnap.data();
      if (String(d.term ?? '').trim() === termLabel.trim()) {
        await deleteDoc(doc(db, 'councilOfficers', docSnap.id));
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'councilOfficers');
  }
}

export async function upsertAnnouncementToFirestore(
  item: AnnouncementItem
): Promise<void> {
  if (!isFirebaseAuthenticated()) return;

  const cleanId = sanitizeFirestoreId(item.id);
  const ref = doc(db, 'announcements', cleanId);
  const path = `announcements/${cleanId}`;

  try {
    const snap = await getDoc(ref);
    const basePayload: Record<string, unknown> = {
      id: cleanId,
      title: item.title.trim().slice(0, 200) || 'Announcement',
      date: item.date.trim().slice(0, 60) || 'Today',
      category: item.category.trim().slice(0, 80) || 'Campus Life',
      summary: item.summary.trim().slice(0, 2000) || 'Official SLAC SSC memo.',
      issuedBy: item.issuedBy.trim().slice(0, 160) || 'SLAC SSC',
      visibility: 'public',
      updatedAt: serverTimestamp(),
    };

    const safeImg = sanitizeFirestoreImageUrl(item.image);
    if (safeImg) {
      basePayload.image = safeImg;
    }

    if (snap.exists()) {
      await setDoc(ref, {
        ...basePayload,
        createdAt: snap.data().createdAt,
      });
    } else {
      await setDoc(ref, {
        ...basePayload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAnnouncementFromFirestore(
  announcementId: string
): Promise<void> {
  if (!isFirebaseAuthenticated()) return;
  const cleanId = sanitizeFirestoreId(announcementId);
  const path = `announcements/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'announcements', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertEventToFirestore(
  item: GalleryEventItem
): Promise<void> {
  if (!isFirebaseAuthenticated()) return;

  const cleanId = sanitizeFirestoreId(item.id);
  const ref = doc(db, 'events', cleanId);
  const path = `events/${cleanId}`;
  const fallbackImg = siteConfig.hero.backgroundImage;
  const safeImg =
    sanitizeFirestoreImageUrl(item.image, fallbackImg) || fallbackImg;

  try {
    const snap = await getDoc(ref);
    const basePayload: Record<string, unknown> = {
      id: cleanId,
      title: item.title.trim().slice(0, 200) || 'Campus Event',
      date: item.date.trim().slice(0, 80) || 'TBA',
      time: item.time.trim().slice(0, 80) || 'TBA',
      location: item.location.trim().slice(0, 160) || 'SLAC Campus',
      category: item.category.trim().slice(0, 80) || 'Governance',
      description:
        item.description.trim().slice(0, 2000) ||
        'Upcoming SLAC SSC campus activity.',
      image: safeImg,
      imageAlt: (
        item.imageAlt?.trim() || `${item.title.trim()} campus event`
      ).slice(0, 240),
      visibility: 'public',
      updatedAt: serverTimestamp(),
    };

    if (snap.exists()) {
      await setDoc(ref, {
        ...basePayload,
        createdAt: snap.data().createdAt,
      });
    } else {
      await setDoc(ref, {
        ...basePayload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteEventFromFirestore(eventId: string): Promise<void> {
  if (!isFirebaseAuthenticated()) return;
  const cleanId = sanitizeFirestoreId(eventId);
  const path = `events/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'events', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertForumThreadToFirestore(
  thread: ForumThread,
  allowModerationFields = false
): Promise<void> {
  if (!isFirebaseAuthenticated()) return;

  const cleanId = sanitizeFirestoreId(thread.id);
  const ref = doc(db, 'forumThreads', cleanId);
  const path = `forumThreads/${cleanId}`;

  const sanitizedReplies = (thread.replies ?? []).slice(0, 100).map((rep) => ({
    id: String(rep.id || `rep-${Date.now()}`).slice(0, 128),
    author: String(rep.author || 'SLAC Student').trim().slice(0, 120),
    yearLevel: String(rep.yearLevel || 'SLAC Student').trim().slice(0, 100),
    time: String(rep.time || 'Just now').trim().slice(0, 60),
    message: String(rep.message || '').trim().slice(0, 2000),
  }));

  const safeSupportCount = Math.max(
    0,
    Math.min(100000, Math.floor(Number(thread.supportCount) || 0))
  );

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const existingData = snap.data();
      if (allowModerationFields) {
        await setDoc(ref, {
          id: existingData.id,
          author: existingData.author,
          yearLevel: existingData.yearLevel,
          postedAt: existingData.postedAt,
          topic: thread.topic.trim().slice(0, 80) || existingData.topic,
          title: thread.title.trim().slice(0, 200) || existingData.title,
          body: thread.body.trim().slice(0, 3000) || existingData.body,
          supportCount: safeSupportCount,
          replies: sanitizedReplies,
          visibility: 'public',
          createdAt: existingData.createdAt,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, {
          id: existingData.id,
          author: existingData.author,
          yearLevel: existingData.yearLevel,
          postedAt: existingData.postedAt,
          topic: existingData.topic,
          title: existingData.title,
          body: existingData.body,
          supportCount: safeSupportCount,
          replies: sanitizedReplies,
          visibility: existingData.visibility,
          createdAt: existingData.createdAt,
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      await setDoc(ref, {
        id: cleanId,
        author: thread.author.trim().slice(0, 120) || 'SLAC Student',
        yearLevel: thread.yearLevel.trim().slice(0, 100) || 'SLAC Student',
        postedAt: thread.postedAt.trim().slice(0, 60) || 'Just now',
        topic: thread.topic.trim().slice(0, 80) || 'Suggestions',
        title: thread.title.trim().slice(0, 200) || 'Student Discussion',
        body: thread.body.trim().slice(0, 3000) || 'Discussion details.',
        supportCount: safeSupportCount,
        replies: sanitizedReplies,
        visibility: 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteForumThreadFromFirestore(
  threadId: string
): Promise<void> {
  if (!isFirebaseAuthenticated()) return;
  const cleanId = sanitizeFirestoreId(threadId);
  const path = `forumThreads/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'forumThreads', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertFaqToFirestore(
  item: FaqItem,
  orderIndex = 0
): Promise<void> {
  if (!isFirebaseAuthenticated()) return;

  const cleanId = sanitizeFirestoreId(item.id);
  const ref = doc(db, 'faqs', cleanId);
  const path = `faqs/${cleanId}`;
  const safeOrder = Math.max(
    0,
    Math.min(10000, Math.floor(Number(orderIndex) || 0))
  );

  try {
    const snap = await getDoc(ref);
    const basePayload = {
      id: cleanId,
      category: item.category.trim().slice(0, 80) || 'Council Office',
      question:
        item.question.trim().slice(0, 300) ||
        'Frequently Asked Student Question',
      answer:
        item.answer.trim().slice(0, 2000) ||
        'Official SLAC Supreme Student Council response.',
      order:
        snap.exists() && typeof snap.data().order === 'number'
          ? snap.data().order
          : safeOrder,
      visibility: 'public',
      updatedAt: serverTimestamp(),
    };

    if (snap.exists()) {
      await setDoc(ref, {
        ...basePayload,
        createdAt: snap.data().createdAt,
      });
    } else {
      await setDoc(ref, {
        ...basePayload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteFaqFromFirestore(faqId: string): Promise<void> {
  if (!isFirebaseAuthenticated()) return;
  const cleanId = sanitizeFirestoreId(faqId);
  const path = `faqs/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'faqs', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Upserts synchronized category filter settings & branding photos in /portalSettings/config.
 */
export async function upsertPortalSettingsToFirestore(
  filters: PortalFilters,
  aiAutoSync: boolean,
  branding?: Partial<PortalBranding>
): Promise<void> {
  if (!isFirebaseAuthenticated()) return;

  const ref = doc(db, 'portalSettings', 'config');
  const path = 'portalSettings/config';

  const sanitizeList = (arr: string[], fallback: string[]) => {
    const source = Array.isArray(arr) && arr.length > 0 ? arr : fallback;
    return source
      .map((s) => String(s).trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 25);
  };

  try {
    const snap = await getDoc(ref);
    const existing = snap.exists() ? snap.data() : {};

    const basePayload: Record<string, unknown> = {
      id: 'config',
      announcementFilters: sanitizeList(
        filters.announcements,
        siteConfig.defaultFilters.announcements
      ),
      eventFilters: sanitizeList(
        filters.events,
        siteConfig.defaultFilters.events
      ),
      forumFilters: sanitizeList(
        filters.forum,
        siteConfig.defaultFilters.forum
      ),
      aiAutoSync: Boolean(aiAutoSync),
      visibility: 'public',
      updatedAt: serverTimestamp(),
    };

    const resolvedLogo = sanitizeFirestoreImageUrl(
      branding?.customLogoUrl ?? existing.customLogoUrl
    );
    if (resolvedLogo) basePayload.customLogoUrl = resolvedLogo;

    const resolvedAbout = sanitizeFirestoreImageUrl(
      branding?.aboutSlacImage ?? existing.aboutSlacImage
    );
    if (resolvedAbout) basePayload.aboutSlacImage = resolvedAbout;

    const resolvedHero = sanitizeFirestoreImageUrl(
      branding?.heroImage ?? existing.heroImage
    );
    if (resolvedHero) basePayload.heroImage = resolvedHero;

    if (snap.exists()) {
      await setDoc(ref, {
        ...basePayload,
        createdAt: existing.createdAt,
      });
    } else {
      await setDoc(ref, {
        ...basePayload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function autoSeedPortalToFirestore(params: {
  accounts: OfficialAccount[];
  officerTerms: OfficerTermRoster[];
  announcements: AnnouncementItem[];
  events: GalleryEventItem[];
  forumThreads: ForumThread[];
  faqs: FaqItem[];
  filters: PortalFilters;
  branding?: PortalBranding;
  aiAutoSync: boolean;
}): Promise<void> {
  if (!isFirebaseAuthenticated() || !auth.currentUser) return;

  let isAdmin = isFirebaseAdminAuthenticated();
  let isOfficial = isAdmin;

  if (!isAdmin) {
    try {
      const offSnap = await getDoc(
        doc(db, 'councilAccounts', auth.currentUser.uid)
      );
      if (offSnap.exists()) {
        isOfficial = true;
        if (offSnap.data()?.role === 'admin') {
          isAdmin = true;
        }
      }
    } catch {
      isOfficial = false;
    }
  }

  if (!isOfficial) return;

  if (isAdmin && auth.currentUser) {
    if (isPrimaryAdminUser(auth.currentUser.email)) {
      await linkAdminPasswordIfPossible(auth.currentUser);
    }

    // ONLY ensure the primary admin account (official.clarksadicon@gmail.com) exists in councilAccounts.
    // NEVER re-upload deleted or cached non-admin accounts from localStorage!
    const adminAccRef = doc(db, 'councilAccounts', 'acc-admin-1');
    try {
      const snap = await getDoc(adminAccRef);
      if (!snap.exists()) {
        await setDoc(adminAccRef, {
          id: 'acc-admin-1',
          email: PRIMARY_ADMIN_EMAIL,
          passcode: '123456',
          name: 'Clark Sadicon',
          position: 'Head Of Technical',
          role: 'admin',
          authUid: sanitizeFirestoreId(auth.currentUser.uid),
          createdByEmail: PRIMARY_ADMIN_EMAIL,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Ignore
    }

    // Automatically remove any legacy duplicate officialUsers documents
    try {
      const legacyOfficialSnaps = await getDocs(collection(db, 'officialUsers'));
      for (const docSnap of legacyOfficialSnaps.docs) {
        await deleteDoc(doc(db, 'officialUsers', docSnap.id)).catch(
          () => undefined
        );
      }
    } catch {
      // Ignore
    }
  }

  try {
    const officersSnap = await getDocs(
      query(
        collection(db, 'councilOfficers'),
        where('visibility', '==', 'public')
      )
    );
    for (const docSnap of officersSnap.docs) {
      if (isLegacySeededOfficerId(docSnap.id)) {
        await deleteDoc(doc(db, 'councilOfficers', docSnap.id));
      }
    }
  } catch {
    // Ignore
  }

  try {
    const settingsSnap = await getDoc(doc(db, 'portalSettings', 'config'));
    if (!settingsSnap.exists()) {
      await upsertPortalSettingsToFirestore(
        params.filters,
        params.aiAutoSync,
        params.branding
      );
    }
  } catch {
    // Ignore
  }

  try {
    const faqsSnap = await getDocs(
      query(collection(db, 'faqs'), where('visibility', '==', 'public'))
    );
    if (faqsSnap.empty && params.faqs.length > 0) {
      for (let i = 0; i < params.faqs.length; i += 1) {
        await upsertFaqToFirestore(params.faqs[i], i);
      }
    }
  } catch {
    // Ignore
  }
}

export async function syncFullPortalStateToFirestore(params: {
  announcements: AnnouncementItem[];
  events: GalleryEventItem[];
  forumThreads: ForumThread[];
  officerTerms: OfficerTermRoster[];
  faqs: FaqItem[];
  filters: PortalFilters;
  branding?: PortalBranding;
  aiAutoSync: boolean;
}): Promise<void> {
  if (!isFirebaseAuthenticated()) return;

  try {
    for (const item of params.announcements) {
      await upsertAnnouncementToFirestore(item);
    }
    for (const evt of params.events) {
      await upsertEventToFirestore(evt);
    }
    for (const thread of params.forumThreads) {
      await upsertForumThreadToFirestore(thread, true);
    }
    for (const roster of params.officerTerms) {
      for (const member of roster.officers) {
        await upsertCouncilOfficerToFirestore(member, roster.term);
      }
    }
    for (let i = 0; i < params.faqs.length; i += 1) {
      await upsertFaqToFirestore(params.faqs[i], i);
    }
    await upsertPortalSettingsToFirestore(
      params.filters,
      params.aiAutoSync,
      params.branding
    );
  } catch {
    // Errors logged by individual helpers
  }
}

export async function pushNewCouncilMemberToFirestore(
  account: OfficialAccount,
  termLabel: string,
  officerId: string,
  image?: string
): Promise<void> {
  const authUid = await provisionOfficerInFirebaseAuth(
    account.email,
    account.passcode,
    account.name
  );

  const adminUser = await ensureAdminFirebaseAuth();

  // Store inside the single unified councilAccounts collection
  const docKey = sanitizeFirestoreId(authUid || account.id);
  const accRef = doc(db, 'councilAccounts', docKey);
  const accPath = `councilAccounts/${docKey}`;
  const creatorEmail =
    adminUser.email?.trim().toLowerCase() || PRIMARY_ADMIN_EMAIL;

  try {
    const snap = await getDoc(accRef);
    const payload: Record<string, unknown> = {
      id: docKey,
      email: account.email.trim().toLowerCase(),
      passcode: account.passcode,
      name: account.name.trim().slice(0, 120),
      position: account.position.trim().slice(0, 80),
      role: account.role,
      createdByEmail: creatorEmail,
      updatedAt: serverTimestamp(),
    };
    if (authUid) {
      payload.authUid = sanitizeFirestoreId(authUid);
    }

    if (snap.exists()) {
      const existingData = snap.data();
      await setDoc(accRef, {
        ...payload,
        createdByEmail: existingData.createdByEmail || creatorEmail,
        createdAt: existingData.createdAt,
      });
    } else {
      await setDoc(accRef, {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, accPath);
  }

  const committee = inferCommitteeFromPosition(account.position);
  await upsertCouncilOfficerToFirestore(
    {
      id: officerId,
      position: account.position,
      committee,
      name: account.name,
      image,
      optional: account.position === 'Asst. Secretary' ? true : undefined,
    },
    termLabel,
    docKey
  );
}

export async function updateCouncilAccountInFirestore(
  account: OfficialAccount
): Promise<void> {
  if (!isFirebaseAuthenticated()) {
    await ensureAdminFirebaseAuth().catch(() => undefined);
  }
  if (!isFirebaseAuthenticated()) return;

  const cleanAccountId = sanitizeFirestoreId(account.id);
  const accRef = doc(db, 'councilAccounts', cleanAccountId);
  const accPath = `councilAccounts/${cleanAccountId}`;

  try {
    const snap = await getDoc(accRef);
    if (snap.exists()) {
      const existingData = snap.data();
      await setDoc(accRef, {
        ...existingData,
        email: account.email.trim().toLowerCase(),
        passcode: account.passcode,
        name: account.name.trim().slice(0, 120),
        position: account.position.trim().slice(0, 80),
        role: account.role,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const byEmailSnap = await getDocs(
      query(
        collection(db, 'councilAccounts'),
        where('email', '==', account.email.trim().toLowerCase())
      )
    );
    for (const d of byEmailSnap.docs) {
      const existingData = d.data();
      await setDoc(doc(db, 'councilAccounts', d.id), {
        ...existingData,
        email: account.email.trim().toLowerCase(),
        passcode: account.passcode,
        name: account.name.trim().slice(0, 120),
        position: account.position.trim().slice(0, 80),
        role: account.role,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, accPath);
  }
}

export async function deleteCouncilAccountFromFirestore(
  accountId: string,
  accountEmail?: string,
  accountName?: string
): Promise<void> {
  if (!isFirebaseAuthenticated()) {
    await ensureAdminFirebaseAuth().catch(() => undefined);
  }
  if (!isFirebaseAuthenticated()) return;

  const cleanId = sanitizeFirestoreId(accountId);
  const accPath = `councilAccounts/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'councilAccounts', cleanId)).catch(() => undefined);
    await deleteDoc(doc(db, 'officialUsers', cleanId)).catch(() => undefined);

    if (accountEmail) {
      const cleanEmail = accountEmail.trim().toLowerCase();
      const matchingAccounts = await getDocs(
        query(collection(db, 'councilAccounts'), where('email', '==', cleanEmail))
      );
      for (const docSnap of matchingAccounts.docs) {
        const d = docSnap.data();
        if (typeof d.authUid === 'string' && d.authUid) {
          await deleteDoc(doc(db, 'officialUsers', d.authUid)).catch(
            () => undefined
          );
        }
        await deleteDoc(doc(db, 'councilAccounts', docSnap.id)).catch(
          () => undefined
        );
      }
    }

    // Also remove any linked officer entry in councilOfficers
    const officersSnap = await getDocs(
      query(collection(db, 'councilOfficers'), where('visibility', '==', 'public'))
    );
    for (const offDoc of officersSnap.docs) {
      const d = offDoc.data();
      const matchesAccId = d.accountId === cleanId;
      const matchesName =
        accountName &&
        typeof d.name === 'string' &&
        d.name.trim().toLowerCase() === accountName.trim().toLowerCase();
      if (matchesAccId || matchesName) {
        await deleteDoc(doc(db, 'councilOfficers', offDoc.id)).catch(
          () => undefined
        );
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, accPath);
  }
}

export {
  collection,
  doc,
  getDoc,
  onAuthStateChanged,
  onSnapshot,
  query,
  signOut,
  where,
};
