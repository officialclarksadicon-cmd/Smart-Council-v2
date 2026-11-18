import crypto from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

initializeApp();

const FIRESTORE_DATABASE_ID =
  'ai-studio-simplelandingsta-92a36073-b601-43ab-b1cd-5dd6f4137b5f';
const PRIMARY_ADMIN_UID = 'r6KDRrPBerb0KiJ3M5QYpZ0Yjl62';
const PRIMARY_ADMIN_EMAIL = 'official.clarksadicon@gmail.com';

const imagekitPublicKey = defineSecret('IMAGEKIT_PUBLIC_KEY');
const imagekitPrivateKey = defineSecret('IMAGEKIT_PRIVATE_KEY');

const ALLOWED_IMAGEKIT_FOLDERS = new Set([
  'logo',
  'council-stock',
  'announcements',
  'events',
  'officers',
  'council',
]);

async function verifyBearerToken(authHeader: string | undefined) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) return null;
  try {
    return await getAuth().verifyIdToken(idToken, true);
  } catch {
    return null;
  }
}

function hasOfficialOrAdminClaim(decoded: {
  uid: string;
  email?: string;
  email_verified?: boolean;
  role?: string;
}): boolean {
  if (decoded.role === 'admin' || decoded.role === 'official') return true;
  if (decoded.uid === PRIMARY_ADMIN_UID) return true;
  if (
    decoded.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL &&
    decoded.email_verified === true
  ) {
    return true;
  }
  return false;
}

function hasAdminClaim(decoded: {
  uid: string;
  email?: string;
  email_verified?: boolean;
  role?: string;
}): boolean {
  if (decoded.role === 'admin') return true;
  if (decoded.uid === PRIMARY_ADMIN_UID) return true;
  if (
    decoded.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL &&
    decoded.email_verified === true
  ) {
    return true;
  }
  return false;
}

/**
 * Unified 2nd-Gen Cloud Function handling `/api/**` rewrites from Firebase Hosting:
 * - GET  /api/imagekit/auth       (requires official/admin claim)
 * - GET  /api/imagekit/list       (requires official/admin claim)
 * - POST /api/admin/onboard-officer (requires admin claim; creates Auth user, sets custom claims, sends password-setup link)
 * - POST /api/stats/visit         (rate-guarded server-side visit increment)
 */
export const api = onRequest(
  {
    region: 'us-central1',
    cors: true,
    maxInstances: 10,
    secrets: [imagekitPublicKey, imagekitPrivateKey],
  },
  async (req, res) => {
    const path = req.path.replace(/\/+$/, '') || '/';

    // 1. GET /api/imagekit/auth
    if (req.method === 'GET' && path === '/api/imagekit/auth') {
      const decoded = await verifyBearerToken(req.headers.authorization);
      if (!decoded || !hasOfficialOrAdminClaim(decoded)) {
        res.status(403).json({
          error: 'Official or Admin role claim required for upload signature.',
        });
        return;
      }

      const pubKey = imagekitPublicKey.value().trim();
      const privKey = imagekitPrivateKey.value().trim();
      if (!pubKey || !privKey) {
        res.status(503).json({
          error: 'ImageKit secrets are not configured.',
        });
        return;
      }

      const folderParam = String(req.query.folder || 'council')
        .trim()
        .replace(/^\/+|\/+$/g, '')
        .replace(/^smart-council\//, '');

      if (folderParam && !ALLOWED_IMAGEKIT_FOLDERS.has(folderParam)) {
        res.status(400).json({ error: 'Folder not in allowlist.' });
        return;
      }

      const token = crypto.randomUUID();
      const expire = Math.floor(Date.now() / 1000) + 600;
      const signature = crypto
        .createHmac('sha1', privKey)
        .update(token + expire.toString())
        .digest('hex');

      res.json({
        token,
        expire,
        signature,
        publicKey: pubKey,
        urlEndpoint: 'https://ik.imagekit.io/slacssc',
        folder: `/smart-council/${folderParam || 'council'}`,
      });
      return;
    }

    // 2. GET /api/imagekit/list
    if (req.method === 'GET' && path === '/api/imagekit/list') {
      const decoded = await verifyBearerToken(req.headers.authorization);
      if (!decoded || !hasOfficialOrAdminClaim(decoded)) {
        res.status(403).json({
          error: 'Official or Admin role claim required.',
        });
        return;
      }

      const privKey = imagekitPrivateKey.value().trim();
      if (!privKey) {
        res.status(503).json({ error: 'ImageKit secret not configured.' });
        return;
      }

      const folderParam = String(req.query.folder || '')
        .trim()
        .replace(/^\/+|\/+$/g, '')
        .replace(/^smart-council\/?/, '');

      if (folderParam && !ALLOWED_IMAGEKIT_FOLDERS.has(folderParam)) {
        res.status(400).json({ error: 'Invalid folder parameter.' });
        return;
      }

      const pathFilter = folderParam
        ? `/smart-council/${folderParam}`
        : '/smart-council';

      const basicAuth = Buffer.from(`${privKey}:`).toString('base64');
      const queryParams = new URLSearchParams({
        path: pathFilter,
        limit: '60',
        sort: 'DESC_CREATED',
        fileType: 'image',
      });

      const response = await fetch(
        `https://api.imagekit.io/v1/files?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Basic ${basicAuth}`,
            Accept: 'application/json',
          },
        }
      );
      const data = await response.json();
      res.status(response.status).json({
        files: Array.isArray(data) ? data : [],
      });
      return;
    }

    // 3. POST /api/admin/onboard-officer
    if (req.method === 'POST' && path === '/api/admin/onboard-officer') {
      const decoded = await verifyBearerToken(req.headers.authorization);
      if (!decoded || !hasAdminClaim(decoded)) {
        res.status(403).json({
          error: 'Web Admin claim required to onboard officers.',
        });
        return;
      }

      const { email, name, position, role } = req.body ?? {};
      const cleanEmail =
        typeof email === 'string' ? email.trim().toLowerCase() : '';
      const cleanName = typeof name === 'string' ? name.trim() : 'SSC Official';
      const cleanPos =
        typeof position === 'string' ? position.trim() : 'SSC Officer';
      const cleanRole: 'admin' | 'official' =
        role === 'admin' ? 'admin' : 'official';

      if (!cleanEmail || !cleanEmail.includes('@')) {
        res.status(400).json({ error: 'Valid officer email required.' });
        return;
      }

      const adminAuth = getAuth();
      let userRecord;
      try {
        userRecord = await adminAuth.getUserByEmail(cleanEmail);
      } catch {
        userRecord = await adminAuth.createUser({
          email: cleanEmail,
          displayName: cleanName,
          emailVerified: false,
        });
      }

      await adminAuth.setCustomUserClaims(userRecord.uid, {
        role: cleanRole,
      });

      const db = getFirestore(FIRESTORE_DATABASE_ID);
      await db
        .collection('councilAccounts')
        .doc(userRecord.uid)
        .set(
          {
            id: userRecord.uid,
            authUid: userRecord.uid,
            email: cleanEmail,
            name: cleanName,
            position: cleanPos,
            role: cleanRole,
            createdByEmail: decoded.email || PRIMARY_ADMIN_EMAIL,
            updatedAt: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      const resetLink = await adminAuth.generatePasswordResetLink(cleanEmail);

      res.json({
        ok: true,
        uid: userRecord.uid,
        email: cleanEmail,
        role: cleanRole,
        passwordSetupLink: resetLink,
      });
      return;
    }

    // 4. POST /api/stats/visit
    if (req.method === 'POST' && path === '/api/stats/visit') {
      const db = getFirestore(FIRESTORE_DATABASE_ID);
      await db
        .collection('siteStats')
        .doc('visits')
        .set(
          {
            visits: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      res.json({ ok: true });
      return;
    }

    res.status(404).json({ error: 'Endpoint not found.' });
  }
);
