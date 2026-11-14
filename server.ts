import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

const imagekitUrlEndpoint = (
  process.env.IMAGEKIT_URL_ENDPOINT?.trim() ||
  process.env.VITE_IMAGEKIT_URL_ENDPOINT?.trim() ||
  'https://ik.imagekit.io/slacssc'
).replace(/\/+$/, '');

const imagekitPublicKey =
  process.env.IMAGEKIT_PUBLIC_KEY?.trim() ||
  process.env.VITE_IMAGEKIT_PUBLIC_KEY?.trim() ||
  'public_crsSe9M4B7Az8cXkO0XWZBjfRkY=';

const imagekitPrivateKey =
  process.env.IMAGEKIT_PRIVATE_KEY?.trim() ||
  process.env.VITE_IMAGEKIT_PRIVATE_KEY?.trim() ||
  'private_2GDDjhN6T/Xkoo7cuLN2pPRbUhU=';

const app = express();
app.use(express.json({ limit: '25mb' }));

/**
 * GET /api/imagekit/auth
 * Generates signed upload parameters (token, expire, signature, publicKey)
 * for direct client-to-ImageKit uploads.
 */
app.get('/api/imagekit/auth', (_req, res) => {
  const token = crypto.randomUUID();
  const expire = Math.floor(Date.now() / 1000) + 2400;
  const signature = crypto
    .createHmac('sha1', imagekitPrivateKey)
    .update(token + String(expire))
    .digest('hex');

  res.json({
    token,
    expire,
    signature,
    publicKey: imagekitPublicKey,
    urlEndpoint: imagekitUrlEndpoint,
  });
});

/**
 * POST /api/imagekit/upload
 * Uploads a photo directly to ImageKit (https://ik.imagekit.io/slacssc) using
 * binary Blob conversion so uploaded images are never corrupted.
 */
app.post('/api/imagekit/upload', async (req, res) => {
  if (!imagekitPrivateKey) {
    res.status(503).json({
      error: 'IMAGEKIT_PRIVATE_KEY is not configured.',
    });
    return;
  }

  try {
    const body = (req.body ?? {}) as {
      file?: string;
      fileName?: string;
      folder?: string;
    };

    const filePayload = typeof body.file === 'string' ? body.file.trim() : '';
    const rawFileName =
      typeof body.fileName === 'string' && body.fileName.trim()
        ? body.fileName.trim()
        : `ssc-photo-${Date.now()}.jpg`;
    const safeFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '-');
    const allowedFolders = [
      'logo',
      'council-stock',
      'announcements',
      'events',
      'officers',
      'council',
    ];
    const safeFolder =
      typeof body.folder === 'string' && allowedFolders.includes(body.folder)
        ? body.folder
        : 'council-stock';

    if (!filePayload) {
      res.status(400).json({ error: 'Missing image file data.' });
      return;
    }

    const formData = new FormData();

    // Convert base64 data URL into a clean binary Blob to prevent file corruption
    const dataUrlMatch = filePayload.match(
      /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
    );
    if (dataUrlMatch) {
      const mimeType = dataUrlMatch[1];
      const base64Data = dataUrlMatch[2];
      const binaryBuffer = Buffer.from(base64Data, 'base64');
      const fileBlob = new Blob([binaryBuffer], { type: mimeType });
      formData.append('file', fileBlob, safeFileName);
    } else {
      formData.append('file', filePayload);
    }

    formData.append('fileName', safeFileName);
    formData.append('folder', `/smart-council/${safeFolder}`);
    formData.append('useUniqueFileName', 'true');

    const authHeader = `Basic ${Buffer.from(`${imagekitPrivateKey}:`).toString('base64')}`;
    const ikRes = await fetch(
      'https://upload.imagekit.io/api/v1/files/upload',
      {
        method: 'POST',
        headers: {
          Authorization: authHeader,
        },
        body: formData,
      }
    );

    const ikData = (await ikRes.json().catch(() => ({}))) as {
      url?: string;
      fileId?: string;
      filePath?: string;
      thumbnailUrl?: string;
      name?: string;
      message?: string;
    };

    if (!ikRes.ok || !ikData.url) {
      res.status(ikRes.status >= 400 ? ikRes.status : 502).json({
        error: ikData.message || 'ImageKit upload rejected the file.',
      });
      return;
    }

    res.json({
      url: ikData.url,
      fileId: ikData.fileId ?? '',
      filePath: ikData.filePath ?? '',
      thumbnailUrl: ikData.thumbnailUrl ?? ikData.url,
      name: ikData.name ?? safeFileName,
      urlEndpoint: imagekitUrlEndpoint,
    });
  } catch (err) {
    console.error('ImageKit upload error:', err);
    res.status(500).json({
      error:
        err instanceof Error
          ? err.message
          : 'Unable to upload image to ImageKit right now.',
    });
  }
});

/**
 * GET /api/imagekit/list
 * Lists previously uploaded images in ImageKit (/smart-council/<folder> or root).
 */
app.get('/api/imagekit/list', async (req, res) => {
  if (!imagekitPrivateKey) {
    res.json({
      configured: false,
      urlEndpoint: imagekitUrlEndpoint,
      files: [],
    });
    return;
  }

  try {
    const allowedFolders = [
      'logo',
      'council-stock',
      'announcements',
      'events',
      'officers',
      'council',
    ];
    const folderParam =
      typeof req.query.folder === 'string' &&
      allowedFolders.includes(req.query.folder)
        ? req.query.folder
        : '';

    const params = new URLSearchParams({
      limit: '60',
      fileType: 'image',
      sort: 'DESC_CREATED',
    });
    if (folderParam) {
      params.set('path', `/smart-council/${folderParam}`);
    }

    const authHeader = `Basic ${Buffer.from(`${imagekitPrivateKey}:`).toString('base64')}`;
    const ikRes = await fetch(
      `https://api.imagekit.io/v1/files?${params.toString()}`,
      {
        headers: {
          Authorization: authHeader,
        },
      }
    );

    if (!ikRes.ok) {
      const errData = (await ikRes.json().catch(() => ({}))) as {
        message?: string;
      };
      res.status(ikRes.status).json({
        error: errData.message || 'Unable to list files from ImageKit.',
      });
      return;
    }

    const items = (await ikRes.json()) as Array<{
      fileId?: string;
      name?: string;
      filePath?: string;
      url?: string;
      thumbnail?: string;
    }>;

    res.json({
      configured: true,
      urlEndpoint: imagekitUrlEndpoint,
      files: Array.isArray(items)
        ? items
            .filter((item) => Boolean(item.url))
            .map((item) => ({
              fileId: item.fileId ?? '',
              name: item.name ?? 'image',
              filePath: item.filePath ?? '',
              url: item.url ?? '',
              thumbnail: item.thumbnail ?? item.url ?? '',
            }))
        : [],
    });
  } catch (err) {
    console.error('ImageKit list error:', err);
    res.status(500).json({
      error:
        err instanceof Error
          ? err.message
          : 'Unable to fetch ImageKit media library.',
    });
  }
});

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Council server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
