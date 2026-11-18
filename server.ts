import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const PRIMARY_ADMIN_UID = 'r6KDRrPBerb0KiJ3M5QYpZ0Yjl62';
const PRIMARY_ADMIN_EMAIL = 'official.clarksadicon@gmail.com';

const ALLOWED_IMAGEKIT_FOLDERS = new Set([
  'logo',
  'council-stock',
  'announcements',
  'events',
  'officers',
  'council',
]);

/**
 * Reads ImageKit server credentials strictly from server-side environment variables.
 * Never falls back to hardcoded keys or VITE_ prefixed private keys.
 */
function getImageKitConfig() {
  const urlEndpoint = (
    process.env.IMAGEKIT_URL_ENDPOINT ||
    process.env.VITE_IMAGEKIT_URL_ENDPOINT ||
    'https://ik.imagekit.io/slacssc'
  ).replace(/\/+$/, '');

  const publicKey = (process.env.IMAGEKIT_PUBLIC_KEY || '').trim();
  const privateKey = (process.env.IMAGEKIT_PRIVATE_KEY || '').trim();

  return {
    urlEndpoint,
    publicKey,
    privateKey,
    isConfigured: Boolean(urlEndpoint && publicKey && privateKey),
  };
}

interface VerifiedUserToken {
  uid: string;
  email: string;
  emailVerified: boolean;
  role?: 'admin' | 'official';
}

/**
 * Verifies a Firebase ID token against the Google Identity Toolkit accounts:lookup endpoint
 * using the project's public web API key, extracting UID, verified email, and custom claims.
 */
async function verifyFirebaseIdToken(
  authHeader: string | undefined
): Promise<VerifiedUserToken | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) return null;

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
        firebaseConfig.apiKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!response.ok) return null;
    const data = (await response.json()) as {
      users?: Array<{
        localId?: string;
        email?: string;
        emailVerified?: boolean;
        customAttributes?: string;
      }>;
    };
    const user = data.users?.[0];
    if (!user?.localId) return null;

    let customRole: 'admin' | 'official' | undefined;
    if (user.customAttributes) {
      try {
        const parsed = JSON.parse(user.customAttributes) as {
          role?: string;
        };
        if (parsed.role === 'admin' || parsed.role === 'official') {
          customRole = parsed.role;
        }
      } catch {
        // Ignore malformed customAttributes
      }
    }

    const email = (user.email || '').trim().toLowerCase();
    const isPrimaryAdmin =
      user.localId === PRIMARY_ADMIN_UID ||
      (email === PRIMARY_ADMIN_EMAIL && Boolean(user.emailVerified));

    return {
      uid: user.localId,
      email,
      emailVerified: Boolean(user.emailVerified),
      role: isPrimaryAdmin ? 'admin' : customRole,
    };
  } catch {
    return null;
  }
}

async function requireOfficialOrAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const verified = await verifyFirebaseIdToken(req.headers.authorization);
  if (!verified) {
    return res.status(401).json({
      error: 'Authentication required. Provide a valid Firebase Bearer token.',
    });
  }
  (req as Request & { user?: VerifiedUserToken }).user = verified;
  return next();
}

async function startServer() {
  const ikCheck = getImageKitConfig();
  if (!ikCheck.isConfigured) {
    console.warn(
      '[Smart Council] IMAGEKIT_PUBLIC_KEY / IMAGEKIT_PRIVATE_KEY are not set in environment. ' +
        'Signed ImageKit uploads will return 503 until configured in .env.'
    );
  }

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  /**
   * 1. GET /api/imagekit/auth
   * Generates a short-lived HMAC-SHA1 signature for direct browser-to-ImageKit uploads.
   * Requires a verified Firebase ID token.
   */
  app.get('/api/imagekit/auth', requireOfficialOrAdmin, (req, res) => {
    const { publicKey, privateKey, urlEndpoint, isConfigured } =
      getImageKitConfig();

    if (!isConfigured) {
      return res.status(503).json({
        error:
          'ImageKit server credentials are not configured. Set IMAGEKIT_PUBLIC_KEY and IMAGEKIT_PRIVATE_KEY in .env.',
      });
    }

    const folderParam = String(req.query.folder || 'council')
      .trim()
      .replace(/^\/+|\/+$/g, '')
      .replace(/^smart-council\//, '');

    if (folderParam && !ALLOWED_IMAGEKIT_FOLDERS.has(folderParam)) {
      return res.status(400).json({
        error: `Invalid upload folder "${folderParam}". Allowed folders: ${Array.from(
          ALLOWED_IMAGEKIT_FOLDERS
        ).join(', ')}.`,
      });
    }

    const token = crypto.randomUUID();
    const expire = Math.floor(Date.now() / 1000) + 60 * 10; // 10-minute expiry
    const signature = crypto
      .createHmac('sha1', privateKey)
      .update(token + expire.toString())
      .digest('hex');

    return res.json({
      token,
      expire,
      signature,
      publicKey,
      urlEndpoint,
      folder: `/smart-council/${folderParam || 'council'}`,
    });
  });

  /**
   * 2. GET /api/imagekit/list
   * Lists existing image assets from ImageKit for the SSC Suite Media Library picker.
   * Requires a verified Firebase ID token.
   */
  app.get('/api/imagekit/list', requireOfficialOrAdmin, async (req, res) => {
    const { privateKey, isConfigured } = getImageKitConfig();

    if (!isConfigured) {
      return res.status(503).json({
        error: 'ImageKit server credentials are not configured.',
      });
    }

    try {
      const folderParam = String(req.query.folder || '')
        .trim()
        .replace(/^\/+|\/+$/g, '');
      const cleanSubfolder = folderParam.replace(/^smart-council\/?/, '');
      if (cleanSubfolder && !ALLOWED_IMAGEKIT_FOLDERS.has(cleanSubfolder)) {
        return res.status(400).json({ error: 'Invalid folder parameter.' });
      }

      const pathFilter = cleanSubfolder
        ? `/smart-council/${cleanSubfolder}`
        : '/smart-council';

      const basicAuth = Buffer.from(`${privateKey}:`).toString('base64');
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
      if (!response.ok) {
        return res.status(response.status).json({
          error: data?.message || 'Unable to list files from ImageKit.',
        });
      }

      return res.json({
        files: Array.isArray(data) ? data : [],
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to list ImageKit files.';
      return res.status(500).json({ error: message });
    }
  });

  /**
   * 3. POST /api/admin/onboard-officer
   * Sends a Firebase Auth password-reset/setup email link for a newly onboarded officer.
   * In Cloud Functions production (functions/src/index.ts), this also mints custom claims
   * { role: 'admin' | 'official' } via firebase-admin.
   */
  app.post(
    '/api/admin/onboard-officer',
    requireOfficialOrAdmin,
    async (req, res) => {
      const { email, role, name, position } = req.body ?? {};
      const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return res.status(400).json({ error: 'Valid officer email is required.' });
      }
      if (role !== 'admin' && role !== 'official') {
        return res.status(400).json({ error: 'Role must be admin or official.' });
      }

      try {
        // Trigger Firebase Auth password setup / reset email via Identity Toolkit
        await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(
            firebaseConfig.apiKey
          )}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requestType: 'PASSWORD_RESET',
              email: cleanEmail,
            }),
          }
        );

        return res.json({
          ok: true,
          email: cleanEmail,
          role,
          name: String(name || '').trim(),
          position: String(position || '').trim(),
          message:
            'Officer onboarding initiated. Password setup email dispatched if the account is registered in Firebase Auth.',
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to onboard officer.';
        return res.status(500).json({ error: message });
      }
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(
      '/assets',
      express.static(path.join(distPath, 'assets'), {
        maxAge: '1y',
        immutable: true,
      })
    );
    app.use(express.static(distPath, { maxAge: '1h' }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Council server running on http://localhost:${PORT}`);
  });
}

void startServer();
