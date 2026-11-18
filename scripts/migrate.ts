/**
 * ============================================================================
 * SMART COUNCIL v2.3 — ONE-OFF DATABASE MIGRATION SCRIPT (scripts/migrate.ts)
 * ============================================================================
 * Safely migrates existing Firestore documents in `smart-council-368be`
 * without breaking live data:
 * 1. Strips legacy `passcode` fields from `/councilAccounts/{id}` and mints
 *    Firebase Auth Custom Claims (`{ role: 'admin' | 'official' }`).
 * 2. Backfills `publishedAt` and `startsAt` timestamps on `/announcements` and `/events`.
 * 3. Backfills `authorUid` on `/forumThreads` and copies embedded `replies[]`
 *    into `/forumThreads/{id}/replies/{replyId}` subcollection documents.
 *
 * Usage:
 *   npx tsx scripts/migrate.ts
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'smart-council-368be';
const DATABASE_ID =
  'ai-studio-simplelandingsta-92a36073-b601-43ab-b1cd-5dd6f4137b5f';
const PRIMARY_ADMIN_UID = 'r6KDRrPBerb0KiJ3M5QYpZ0Yjl62';

initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID,
});

const db = getFirestore(DATABASE_ID);
const adminAuth = getAuth();

async function migrateCouncilAccounts() {
  console.log('1. Migrating /councilAccounts (removing plaintext passcodes + syncing custom claims)...');
  const snap = await db.collection('councilAccounts').get();
  const batch = db.batch();
  let count = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const role: 'admin' | 'official' =
      data.role === 'admin' ? 'admin' : 'official';
    const uid =
      typeof data.authUid === 'string' && data.authUid.trim()
        ? data.authUid.trim()
        : docSnap.id;

    batch.update(docSnap.ref, {
      passcode: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    count += 1;

    try {
      await adminAuth.setCustomUserClaims(uid, { role });
      console.log(`   -> Set custom claim role=${role} on UID ${uid}`);
    } catch {
      console.warn(`   -> Skipped custom claim for non-Auth doc ID ${uid}`);
    }
  }

  // Ensure Primary Admin always has admin claim
  try {
    await adminAuth.setCustomUserClaims(PRIMARY_ADMIN_UID, { role: 'admin' });
  } catch {
    // Ignore if primary admin not found in current environment
  }

  if (count > 0) {
    await batch.commit();
  }
  console.log(`   Completed: ${count} councilAccounts cleaned.`);
}

async function migrateAnnouncementsAndEvents() {
  console.log('2. Backfilling real timestamps (publishedAt / startsAt) on announcements & events...');
  const annSnap = await db.collection('announcements').get();
  const annBatch = db.batch();
  let annCount = 0;

  for (const docSnap of annSnap.docs) {
    const d = docSnap.data();
    if (!d.publishedAt) {
      const parsed = Date.parse(String(d.date || ''));
      const ts = !Number.isNaN(parsed)
        ? Timestamp.fromMillis(parsed)
        : d.createdAt ?? FieldValue.serverTimestamp();
      annBatch.update(docSnap.ref, { publishedAt: ts });
      annCount += 1;
    }
  }
  if (annCount > 0) await annBatch.commit();

  const evtSnap = await db.collection('events').get();
  const evtBatch = db.batch();
  let evtCount = 0;

  for (const docSnap of evtSnap.docs) {
    const d = docSnap.data();
    if (!d.startsAt) {
      const parsed = Date.parse(String(d.date || ''));
      const ts = !Number.isNaN(parsed)
        ? Timestamp.fromMillis(parsed)
        : d.createdAt ?? FieldValue.serverTimestamp();
      evtBatch.update(docSnap.ref, { startsAt: ts });
      evtCount += 1;
    }
  }
  if (evtCount > 0) await evtBatch.commit();
  console.log(
    `   Completed: ${annCount} announcements and ${evtCount} events updated.`
  );
}

async function migrateForumThreads() {
  console.log('3. Backfilling authorUid and replies subcollections on /forumThreads...');
  const forumSnap = await db.collection('forumThreads').get();
  let migratedThreads = 0;

  for (const docSnap of forumSnap.docs) {
    const d = docSnap.data();
    const updates: Record<string, unknown> = {};
    if (!d.authorUid) {
      updates.authorUid = PRIMARY_ADMIN_UID;
    }
    if (Object.keys(updates).length > 0) {
      await docSnap.ref.update(updates);
      migratedThreads += 1;
    }

    const replies = Array.isArray(d.replies) ? d.replies : [];
    for (const r of replies) {
      if (!r || typeof r !== 'object') continue;
      const replyId = String(r.id || `rep-${Date.now()}`);
      await docSnap.ref
        .collection('replies')
        .doc(replyId)
        .set(
          {
            id: replyId,
            threadId: docSnap.id,
            author: String(r.author || 'SLAC Student'),
            authorUid: String(r.authorUid || PRIMARY_ADMIN_UID),
            yearLevel: String(r.yearLevel || 'SLAC Student'),
            time: String(r.time || 'Just now'),
            message: String(r.message || ''),
            createdAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    }
  }
  console.log(`   Completed: ${migratedThreads} forumThreads updated.`);
}

async function main() {
  await migrateCouncilAccounts();
  await migrateAnnouncementsAndEvents();
  await migrateForumThreads();
  console.log('All Smart Council v2.3 migrations finished.');
}

void main();
