# Smart Council (SLAC SSC) — Firestore Security Specification

## 1. Data Invariants & Master Source of Truth

1. **Strict Separation of Students and Council Officers**:
   - Normal SLAC students signing in with Google are stored exclusively in `/students/{studentId}` where `studentId == request.auth.uid` and `incoming().email == request.auth.token.email`.
   - Provisioned SSC Officials have their Firebase Auth UIDs registered in `/officialUsers/{userId}` by the primary Web Admin (`official.clarksadicon@gmail.com`) and their public roster profiles in `/councilOfficers/{officerId}`.
2. **Primary Admin Exclusivity (`official.clarksadicon@gmail.com`)**:
   - Only the primary Web Admin (`request.auth.uid == 'r6KDRrPBerb0KiJ3M5QYpZ0Yjl62'` or verified `request.auth.token.email == 'official.clarksadicon@gmail.com'`) can create, update, or delete accounts in `/councilAccounts/{accountId}` and `/officialUsers/{userId}`.
3. **Real-Time Public Read & Verified Role Write**:
   - `/announcements/{announcementId}`, `/events/{eventId}`, `/councilOfficers/{officerId}`, `/forumThreads/{threadId}`, and `/portalSettings/{settingId}` allow public reads when `visibility == 'public'` (or `resource == null` on single-document `get` checks before creation).
   - Only signed-in SSC Officials and the Web Admin (`isOfficialOrAdmin()`) can create, update, or delete `/announcements`, `/events`, `/councilOfficers`, and `/portalSettings`.
   - Only signed-in Students (Google Auth) and SSC Officials / Web Admin (`isForumParticipant()`) can create threads or post replies/support in `/forumThreads`.
4. **PII Isolation**:
   - `/students/{studentId}` contains student email addresses and is strictly restricted to `isOwner(studentId)` or `isAdmin()` for `get`, with `allow list: if false;`.
   - `/councilAccounts/{accountId}` contains officer emails and passcodes and is strictly restricted to `isAdmin()`.
5. **Temporal Integrity & Immutability**:
   - Every `create` operation requires `incoming().createdAt == request.time && incoming().updatedAt == request.time`.
   - Every `update` operation requires `incoming().createdAt == existing().createdAt && incoming().updatedAt == request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Identity Spoofing on `/students/{studentId}`**: Authenticated student `uid_A` attempts to create `/students/uid_B` or set `uid: 'uid_B'`.
2. **Email Spoofing Attack on Admin Gate**: Attacker with `email: 'official.clarksadicon@gmail.com'` but `email_verified: false` attempts to write to `/councilAccounts/acc-1`.
3. **Unauthorized Officer Account Creation**: Normal authenticated student `student@slac.edu.ph` attempts to create a document in `/councilAccounts/acc-rogue`.
4. **Privilege Escalation via `/officialUsers`**: Normal authenticated student attempts to create `/officialUsers/uid_A` to gain officer publishing privileges.
5. **Shadow Field Injection on `/announcements`**: Admin/Official sends a valid `Announcement` payload plus an undeclared field `"isPinnedSuper": true`.
6. **PII Blanket Read on `/students`**: Authenticated user `uid_B` attempts `get(/students/uid_A)` or `list(/students)` to scrape student emails.
7. **Unauthorized Guest Forum Post**: Unauthenticated visitor (`request.auth == null`) attempts to create a thread or reply in `/forumThreads/thread-1`.
8. **Unauthorized Student Announcement Write**: Normal signed-in student attempts to create or edit `/announcements/ann-1`.
9. **Resource Poisoning (Oversized String)**: Student attempts to create `/forumThreads/thread-1` with a 10,000-character `body` (exceeding `maxLength: 3000`).
10. **Path Variable ID Poisoning**: User attempts to create `/students/invalid id with spaces!`.
11. **Timestamp Forgery (Backdating)**: Student attempts to create `/students/uid_A` with a past client timestamp instead of `request.time`.
12. **Immutable Field Mutation**: Student `uid_A` attempts to update `/students/uid_A` by changing `createdAt` or `email`.
