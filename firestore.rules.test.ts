import { readFileSync } from 'fs';
import {
  collection,
  doc,
  Firestore,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

export interface RulesTestContext {
  firestore(): Firestore;
}

export interface RulesTestEnvironment {
  authenticatedContext(
    userId: string,
    tokenOptions?: Record<string, unknown>
  ): RulesTestContext;
  unauthenticatedContext(): RulesTestContext;
  cleanup(): Promise<void>;
}

const ADMIN_UID = 'r6KDRrPBerb0KiJ3M5QYpZ0Yjl62';
const ADMIN_EMAIL = 'official.clarksadicon@gmail.com';
const OFFICIAL_UID = 'officer_uid_1';
const STUDENT_A_UID = 'student_uid_a';
const STUDENT_B_UID = 'student_uid_b';

async function assertSucceeds<T>(promise: Promise<T>): Promise<T> {
  return await promise;
}

async function assertFails(promise: Promise<unknown>): Promise<void> {
  let failed = false;
  try {
    await promise;
  } catch {
    failed = true;
  }
  if (!failed) {
    throw new Error('Expected Firestore operation to fail with PERMISSION_DENIED.');
  }
}

export async function runSecurityRulesDirtyDozenSuite(
  testEnv: RulesTestEnvironment
) {
  const rulesSource = readFileSync('firestore.rules', 'utf8');
  if (!rulesSource.includes("rules_version = '2';")) {
    throw new Error('Invalid firestore.rules file.');
  }

  try {
    const adminDb = testEnv
      .authenticatedContext(ADMIN_UID, {
        email: ADMIN_EMAIL,
        email_verified: true,
      })
      .firestore();

    const unverifiedSpoofAdminDb = testEnv
      .authenticatedContext('spoof_admin_uid', {
        email: ADMIN_EMAIL,
        email_verified: false,
      })
      .firestore();

    const officialDb = testEnv
      .authenticatedContext(OFFICIAL_UID, {
        email: 'vp@smart.council',
        email_verified: false,
      })
      .firestore();

    const studentADb = testEnv
      .authenticatedContext(STUDENT_A_UID, {
        email: 'student.a@slac.edu.ph',
        email_verified: true,
      })
      .firestore();

    const studentBDb = testEnv
      .authenticatedContext(STUDENT_B_UID, {
        email: 'student.b@slac.edu.ph',
        email_verified: true,
      })
      .firestore();

    const guestDb = testEnv.unauthenticatedContext().firestore();

    // Seed valid student, official, announcement, and forum thread
    await assertSucceeds(
      setDoc(doc(studentADb, 'students', STUDENT_A_UID), {
        uid: STUDENT_A_UID,
        name: 'Juan Dela Cruz',
        email: 'student.a@slac.edu.ph',
        yearCourse: '2nd Year BSIT',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    await assertSucceeds(
      setDoc(doc(adminDb, 'officialUsers', OFFICIAL_UID), {
        uid: OFFICIAL_UID,
        accountId: 'acc-vp',
        name: 'Roel Anthony Gines Dy',
        position: 'Vice President',
        role: 'official',
        visibility: 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    await assertSucceeds(
      setDoc(doc(officialDb, 'announcements', 'ann-1'), {
        id: 'ann-1',
        title: 'Club Renewal Extended',
        date: 'Nov 13, 2026',
        category: 'Governance',
        summary: 'Submit updated rosters by Nov 20.',
        issuedBy: 'SSC Secretariat',
        visibility: 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    await assertSucceeds(
      setDoc(doc(studentADb, 'forumThreads', 'thread-1'), {
        id: 'thread-1',
        author: 'Juan Dela Cruz',
        yearLevel: '2nd Year BSIT',
        postedAt: 'Just now',
        topic: 'Suggestions',
        title: 'Library Study Hours',
        body: 'Requesting extended study hours during finals week.',
        supportCount: 1,
        replies: [],
        visibility: 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Guests can read public announcements and forum threads
    await assertSucceeds(
      getDocs(
        query(collection(guestDb, 'announcements'), where('visibility', '==', 'public'))
      )
    );
    await assertSucceeds(
      getDocs(
        query(collection(guestDb, 'forumThreads'), where('visibility', '==', 'public'))
      )
    );

    // Payload 1: Identity Spoofing on /students/{studentId}
    await assertFails(
      setDoc(doc(studentADb, 'students', STUDENT_B_UID), {
        uid: STUDENT_B_UID,
        name: 'Spoofed Student',
        email: 'student.a@slac.edu.ph',
        yearCourse: '1st Year BSBA',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Payload 2: Email Spoofing Attack on Admin Gate (email_verified: false)
    await assertFails(
      setDoc(doc(unverifiedSpoofAdminDb, 'councilAccounts', 'acc-spoof'), {
        id: 'acc-spoof',
        email: 'hacker@smart.council',
        passcode: 'SLAC-ADM-999999',
        name: 'Spoof Admin',
        position: 'President',
        role: 'admin',
        createdByEmail: ADMIN_EMAIL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Payload 3: Unauthorized Officer Account Creation by Normal Student
    await assertFails(
      setDoc(doc(studentADb, 'councilAccounts', 'acc-rogue'), {
        id: 'acc-rogue',
        email: 'student.a@slac.edu.ph',
        passcode: 'SLAC-SSC-123456',
        name: 'Juan Dela Cruz',
        position: 'Secretary',
        role: 'official',
        createdByEmail: ADMIN_EMAIL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Payload 4: Privilege Escalation via /officialUsers by Student
    await assertFails(
      setDoc(doc(studentADb, 'officialUsers', STUDENT_A_UID), {
        uid: STUDENT_A_UID,
        accountId: 'acc-fake',
        name: 'Juan Dela Cruz',
        position: 'President',
        role: 'official',
        visibility: 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Payload 5: Shadow Field Injection on /announcements
    await assertFails(
      setDoc(doc(adminDb, 'announcements', 'ann-shadow'), {
        id: 'ann-shadow',
        title: 'Valid Headline',
        date: 'Nov 13, 2026',
        category: 'Campus Life',
        summary: 'Valid summary',
        issuedBy: 'SSC',
        visibility: 'public',
        isSuperPinned: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Payload 6: PII Blanket Read on /students
    await assertFails(getDoc(doc(studentBDb, 'students', STUDENT_A_UID)));
    await assertFails(getDocs(collection(studentBDb, 'students')));

    // Payload 7: Unauthorized Guest Forum Post
    await assertFails(
      setDoc(doc(guestDb, 'forumThreads', 'thread-guest'), {
        id: 'thread-guest',
        author: 'Guest',
        yearLevel: 'Visitor',
        postedAt: 'Just now',
        topic: 'Suggestions',
        title: 'Guest Thread',
        body: 'Trying to post without signing in.',
        supportCount: 1,
        replies: [],
        visibility: 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Payload 8: Unauthorized Student Announcement Write
    await assertFails(
      setDoc(doc(studentADb, 'announcements', 'ann-student'), {
        id: 'ann-student',
        title: 'Student Memo',
        date: 'Nov 13, 2026',
        category: 'Campus Life',
        summary: 'Students cannot publish official memos.',
        issuedBy: 'Student',
        visibility: 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Payload 9: Resource Poisoning (Oversized String)
    await assertFails(
      setDoc(doc(studentADb, 'forumThreads', 'thread-oversized'), {
        id: 'thread-oversized',
        author: 'Juan Dela Cruz',
        yearLevel: '2nd Year BSIT',
        postedAt: 'Just now',
        topic: 'Suggestions',
        title: 'Oversized Body',
        body: 'X'.repeat(3500),
        supportCount: 1,
        replies: [],
        visibility: 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Payload 10: Path Variable ID Poisoning
    await assertFails(
      setDoc(doc(studentADb, 'students', 'bad id with spaces!'), {
        uid: 'bad id with spaces!',
        name: 'Juan Dela Cruz',
        email: 'student.a@slac.edu.ph',
        yearCourse: '2nd Year BSIT',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Payload 11: Timestamp Forgery (Backdating)
    await assertFails(
      setDoc(doc(studentBDb, 'students', STUDENT_B_UID), {
        uid: STUDENT_B_UID,
        name: 'Maria Clara',
        email: 'student.b@slac.edu.ph',
        yearCourse: '3rd Year BSBA',
        createdAt: new Date(2020, 1, 1),
        updatedAt: serverTimestamp(),
      })
    );

    // Payload 12: Immutable Field Mutation on /students
    await assertFails(
      updateDoc(doc(studentADb, 'students', STUDENT_A_UID), {
        email: 'changed@slac.edu.ph',
        updatedAt: serverTimestamp(),
      })
    );
  } finally {
    await testEnv.cleanup();
  }
}
