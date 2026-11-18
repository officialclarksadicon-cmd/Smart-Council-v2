import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
   query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import * as fs from 'fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const PROJECT_ID = 'smart-council-368be';
const PRIMARY_ADMIN_UID = 'r6KDRrPBerb0KiJ3M5QYpZ0Yjl62';
const PRIMARY_ADMIN_EMAIL = 'official.clarksadicon@gmail.com';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('Smart Council v2.3 Firestore Security Rules', () => {
  it('1. Public guests CANNOT read or list /councilAccounts', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'councilAccounts', 'officer-uid-1'), {
        id: 'officer-uid-1',
        authUid: 'officer-uid-1',
        email: 'president@slacssc.org',
        name: 'Student President',
        position: 'President',
        role: 'official',
        createdByEmail: PRIMARY_ADMIN_EMAIL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    const guestDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(guestDb, 'councilAccounts', 'officer-uid-1')));
    await assertFails(
      getDocs(
        query(
          collection(guestDb, 'councilAccounts'),
          where('role', 'in', ['admin', 'official'])
        )
      )
    );

    // Verified official with custom claim CAN read councilAccounts
    const officialDb = testEnv
      .authenticatedContext('officer-uid-1', {
        email: 'president@slacssc.org',
        email_verified: true,
        role: 'official',
      })
      .firestore();
    await assertSucceeds(
      getDoc(doc(officialDb, 'councilAccounts', 'officer-uid-1'))
    );
  });

  it('2. An SSC Official CANNOT self-promote to admin or write a passcode into /councilAccounts', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'councilAccounts', 'officer-uid-1'), {
        id: 'officer-uid-1',
        authUid: 'officer-uid-1',
        email: 'president@slacssc.org',
        name: 'Student President',
        position: 'President',
        role: 'official',
        createdByEmail: PRIMARY_ADMIN_EMAIL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    const officialDb = testEnv
      .authenticatedContext('officer-uid-1', {
        email: 'president@slacssc.org',
        email_verified: true,
        role: 'official',
      })
      .firestore();

    // Official cannot self-promote to admin
    await assertFails(
      updateDoc(doc(officialDb, 'councilAccounts', 'officer-uid-1'), {
        role: 'admin',
        updatedAt: serverTimestamp(),
      })
    );

    // Even Web Admin cannot store a `passcode` field on councilAccounts
    const adminDb = testEnv
      .authenticatedContext(PRIMARY_ADMIN_UID, {
        email: PRIMARY_ADMIN_EMAIL,
        email_verified: true,
        role: 'admin',
      })
      .firestore();

    await assertFails(
      setDoc(doc(adminDb, 'councilAccounts', 'officer-uid-2'), {
        id: 'officer-uid-2',
        email: 'vp@slacssc.org',
        passcode: 'secret123',
        name: 'Vice President',
        position: 'Vice President',
        role: 'official',
        createdByEmail: PRIMARY_ADMIN_EMAIL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('3. Student B CANNOT delete Student A forum thread; only Author or Moderator can delete', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'students', 'student-a'), {
        uid: 'student-a',
        name: 'Student A',
        email: 'a@slac.edu.ph',
        yearCourse: '3rd Year — BSCS',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'students', 'student-b'), {
        uid: 'student-b',
        name: 'Student B',
        email: 'b@slac.edu.ph',
        yearCourse: '2nd Year — BSA',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    const studentADb = testEnv.authenticatedContext('student-a').firestore();
    await assertSucceeds(
      setDoc(doc(studentADb, 'forumThreads', 'thread-1'), {
        id: 'thread-1',
        author: 'Student A',
        authorUid: 'student-a',
        yearLevel: '3rd Year — BSCS',
        postedAt: 'Today',
        topic: 'Campus Facilities',
        title: 'Library Wi-Fi Improvement',
        body: 'Requesting additional access points on the 2nd floor.',
        supportCount: 0,
        replies: [],
        visibility: 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Student B cannot delete Student A's thread
    const studentBDb = testEnv.authenticatedContext('student-b').firestore();
    await assertFails(deleteDoc(doc(studentBDb, 'forumThreads', 'thread-1')));

    // Student A CAN delete their own thread
    await assertSucceeds(deleteDoc(doc(studentADb, 'forumThreads', 'thread-1')));
  });

  it('4. Unauthenticated guests CANNOT increment /siteStats/visits and signed-in users cannot increment by > 1', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'siteStats', 'visits'), {
        visits: 10,
        updatedAt: serverTimestamp(),
      });
    });

    // Unauthenticated guest cannot increment counter directly
    const guestDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      updateDoc(doc(guestDb, 'siteStats', 'visits'), {
        visits: 11,
        updatedAt: serverTimestamp(),
      })
    );

    // Authenticated user cannot jump visits by +100
    const userDb = testEnv.authenticatedContext('student-a').firestore();
    await assertFails(
      updateDoc(doc(userDb, 'siteStats', 'visits'), {
        visits: 110,
        updatedAt: serverTimestamp(),
      })
    );

    // Authenticated user CAN increment by +1
    await assertSucceeds(
      updateDoc(doc(userDb, 'siteStats', 'visits'), {
        visits: 11,
        updatedAt: serverTimestamp(),
      })
    );
  });
});
