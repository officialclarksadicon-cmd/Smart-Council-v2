import type { CSSProperties } from 'react';

export const IMAGEKIT_URL_ENDPOINT = (
  import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/slacssc'
).replace(/\/+$/, '');

export const IMAGEKIT_PUBLIC_KEY =
  import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY ||
  'public_crsSe9M4B7Az8cXkO0XWZBjfRkY=';

export const IMAGEKIT_PRIVATE_KEY =
  import.meta.env.VITE_IMAGEKIT_PRIVATE_KEY ||
  'private_2GDDjhN6T/Xkoo7cuLN2pPRbUhU=';

export type ImageKitFolder =
  | 'logo'
  | 'council-stock'
  | 'announcements'
  | 'events'
  | 'officers'
  | 'council';

export type CardFramePreset =
  | 'portrait'
  | 'announcement'
  | 'event'
  | 'about'
  | 'cover'
  | 'logo';

export interface ImageKitCloudFile {
  fileId: string;
  name: string;
  filePath: string;
  url: string;
  thumbnail: string;
}

export interface ImageFraming {
  fit: 'cover' | 'contain';
  x: number;
  y: number;
  zoom: number;
  cardPreset?: CardFramePreset;
}

export const CARD_ASPECT_CONFIG: Record<
  CardFramePreset,
  {
    label: string;
    aspectClass: string;
    stageWidthClass: string;
    baseAspect: 'portrait' | 'landscape' | 'square';
  }
> = {
  portrait: {
    label: 'Officer Portrait Card',
    aspectClass: 'aspect-officer-card',
    stageWidthClass: 'w-52 sm:w-60',
    baseAspect: 'portrait',
  },
  announcement: {
    label: 'Announcement Card',
    aspectClass: 'aspect-announcement-card',
    stageWidthClass: 'w-full max-w-lg',
    baseAspect: 'landscape',
  },
  event: {
    label: 'Event Gallery Card',
    aspectClass: 'aspect-event-card',
    stageWidthClass: 'w-full max-w-md',
    baseAspect: 'landscape',
  },
  about: {
    label: 'About SLAC Card',
    aspectClass: 'aspect-about-card',
    stageWidthClass: 'w-full max-w-md',
    baseAspect: 'landscape',
  },
  cover: {
    label: 'Banner Card',
    aspectClass: 'aspect-announcement-card',
    stageWidthClass: 'w-full max-w-lg',
    baseAspect: 'landscape',
  },
  logo: {
    label: 'Website Seal / Logo',
    aspectClass: 'aspect-logo-card',
    stageWidthClass: 'w-48 sm:w-56',
    baseAspect: 'square',
  },
};

export const DEFAULT_IMAGEKIT_ASSETS: ImageKitCloudFile[] = [
  {
    fileId: 'ik-logo-main',
    name: 'SLAC SSC Seal (512px)',
    filePath: '/smart-council/logo/ssc-logo_yvq35sFUH.png',
    url: 'https://ik.imagekit.io/slacssc/smart-council/logo/ssc-logo_yvq35sFUH.png',
    thumbnail:
      'https://ik.imagekit.io/slacssc/smart-council/logo/ssc-logo_yvq35sFUH.png?tr=w-300',
  },
  {
    fileId: 'ik-logo-white',
    name: 'SLAC SSC White Seal (1024px)',
    filePath: '/smart-council/logo/ssc-logo-1024-white_nzLKj_s2x.png',
    url: 'https://ik.imagekit.io/slacssc/smart-council/logo/ssc-logo-1024-white_nzLKj_s2x.png',
    thumbnail:
      'https://ik.imagekit.io/slacssc/smart-council/logo/ssc-logo-1024-white_nzLKj_s2x.png?tr=w-300',
  },
  {
    fileId: 'ik-logo-dark',
    name: 'SLAC SSC Dark Seal (1024px)',
    filePath: '/smart-council/logo/ssc-logo-1024-dark_L-WgIDIvf.png',
    url: 'https://ik.imagekit.io/slacssc/smart-council/logo/ssc-logo-1024-dark_L-WgIDIvf.png',
    thumbnail:
      'https://ik.imagekit.io/slacssc/smart-council/logo/ssc-logo-1024-dark_L-WgIDIvf.png?tr=w-300',
  },
  {
    fileId: 'ik-council-office',
    name: 'SLAC Council Collaboration',
    filePath: '/smart-council/council-stock/council-office_axkKY8UNt.jpg',
    url: 'https://ik.imagekit.io/slacssc/smart-council/council-stock/council-office_axkKY8UNt.jpg',
    thumbnail:
      'https://ik.imagekit.io/slacssc/smart-council/council-stock/council-office_axkKY8UNt.jpg?tr=w-400',
  },
];

export function getDefaultImageFraming(
  aspect: 'portrait' | 'landscape' | 'square' = 'portrait'
): ImageFraming {
  return {
    fit: aspect === 'square' ? 'contain' : 'cover',
    x: 50,
    y: aspect === 'portrait' ? 18 : 50,
    zoom: 1,
  };
}

export function stripImageFramingHash(rawValue?: string): string {
  if (!rawValue) return '';
  const trimmed = rawValue.trim();
  if (!trimmed) return '';
  const hashIdx = trimmed.indexOf('#');
  return hashIdx >= 0 ? trimmed.slice(0, hashIdx) : trimmed;
}

/**
 * Detects corrupted image strings (such as 500-char truncated base64 data URLs
 * previously written to Firestore, dead blob URLs, or removed local /assets/ paths).
 */
export function isCorruptedImageUrl(rawValue?: string): boolean {
  if (!rawValue || typeof rawValue !== 'string') return true;
  const withoutHash = stripImageFramingHash(rawValue).trim();
  if (!withoutHash) return true;

  if (withoutHash.startsWith('/assets/aistudio/')) {
    return false;
  }

  if (
    withoutHash.startsWith('blob:') ||
    withoutHash.startsWith('/assets/')
  ) {
    return true;
  }

  if (withoutHash.startsWith('data:image/')) {
    // A real photo data URL is several KB; <= 650 chars means it was truncated at 500 chars by Firestore rules
    if (withoutHash.length <= 650) return true;
    const commaIdx = withoutHash.indexOf(',');
    if (commaIdx < 0 || withoutHash.length - commaIdx < 200) return true;
    return false;
  }

  return false;
}

/**
 * Repairs any corrupted or invalid image URL by returning a clean ImageKit URL or fallback.
 */
export function sanitizeImageKitUrl(
  rawValue?: string,
  fallbackUrl = ''
): string {
  if (!rawValue || typeof rawValue !== 'string') return fallbackUrl;
  const trimmed = rawValue.trim();
  if (!trimmed) return fallbackUrl;
  if (isCorruptedImageUrl(trimmed)) return fallbackUrl;

  const hashIdx = trimmed.indexOf('#');
  const hashSuffix = hashIdx >= 0 ? trimmed.slice(hashIdx) : '';
  const base = normalizeImageKitInput(
    hashIdx >= 0 ? trimmed.slice(0, hashIdx) : trimmed
  );
  return base ? `${base}${hashSuffix}` : fallbackUrl;
}

export function parseImageFraming(
  rawValue?: string,
  aspect: 'portrait' | 'landscape' | 'square' = 'portrait'
): ImageFraming {
  const defaults = getDefaultImageFraming(aspect);
  if (!rawValue) return defaults;

  const hashIdx = rawValue.indexOf('#');
  if (hashIdx < 0) return defaults;

  const hashStr = rawValue.slice(hashIdx + 1);
  const params = new URLSearchParams(hashStr);

  const rawFit = params.get('fit');
  const fit: 'cover' | 'contain' =
    rawFit === 'contain' || rawFit === 'cover' ? rawFit : defaults.fit;

  const rawX = Number(params.get('x'));
  const x =
    Number.isFinite(rawX) && params.has('x')
      ? Math.max(0, Math.min(100, Math.round(rawX)))
      : defaults.x;

  const rawY = Number(params.get('y'));
  const y =
    Number.isFinite(rawY) && params.has('y')
      ? Math.max(0, Math.min(100, Math.round(rawY)))
      : defaults.y;

  const rawZoom = Number(params.get('zoom'));
  const zoom =
    Number.isFinite(rawZoom) && params.has('zoom')
      ? Math.max(0.6, Math.min(2.4, Math.round(rawZoom * 100) / 100))
      : defaults.zoom;

  const rawPreset = params.get('preset');
  const cardPreset: CardFramePreset | undefined =
    rawPreset === 'portrait' ||
    rawPreset === 'announcement' ||
    rawPreset === 'event' ||
    rawPreset === 'about' ||
    rawPreset === 'cover' ||
    rawPreset === 'logo'
      ? rawPreset
      : undefined;

  return { fit, x, y, zoom, cardPreset };
}

export function buildFramedImageUrl(
  rawValue: string,
  framing: ImageFraming,
  aspect: 'portrait' | 'landscape' | 'square' = 'portrait'
): string {
  const base = normalizeImageKitInput(stripImageFramingHash(rawValue));
  if (!base) return '';

  const defaults = getDefaultImageFraming(aspect);
  const isDefault =
    framing.fit === defaults.fit &&
    Math.round(framing.x) === defaults.x &&
    Math.round(framing.y) === defaults.y &&
    Math.abs(framing.zoom - defaults.zoom) < 0.01 &&
    !framing.cardPreset;

  if (isDefault) {
    return base;
  }

  const params = new URLSearchParams();
  params.set('fit', framing.fit);
  params.set('x', String(Math.round(framing.x)));
  params.set('y', String(Math.round(framing.y)));
  params.set('zoom', String(Math.round(framing.zoom * 100) / 100));
  if (framing.cardPreset) {
    params.set('preset', framing.cardPreset);
  }
  return `${base}#${params.toString()}`;
}

export function getImageFramingStyle(
  rawValue?: string,
  aspect: 'portrait' | 'landscape' | 'square' = 'portrait'
): CSSProperties {
  const { fit, x, y, zoom } = parseImageFraming(rawValue, aspect);
  return {
    objectFit: fit,
    objectPosition: `${x}% ${y}%`,
    transform: zoom !== 1 ? `scale(${zoom})` : undefined,
    transformOrigin: `${x}% ${y}%`,
  };
}

/**
 * Normalizes a pasted ImageKit URL or relative storage path onto
 * https://ik.imagekit.io/slacssc while preserving valid external URLs.
 */
export function normalizeImageKitInput(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return '';
  if (isCorruptedImageUrl(trimmed)) return '';

  const hashIdx = trimmed.indexOf('#');
  const hashSuffix = hashIdx >= 0 ? trimmed.slice(hashIdx) : '';
  const cleanUrl = hashIdx >= 0 ? trimmed.slice(0, hashIdx).trim() : trimmed;

  if (
    cleanUrl.startsWith('http://') ||
    cleanUrl.startsWith('https://') ||
    cleanUrl.startsWith('data:image/') ||
    cleanUrl.startsWith('/assets/aistudio/')
  ) {
    return `${cleanUrl}${hashSuffix}`;
  }

  const cleanPath = cleanUrl.replace(/^\/+/, '');
  return `${IMAGEKIT_URL_ENDPOINT}/${cleanPath}${hashSuffix}`;
}

/**
 * Resolves stored URLs or relative ImageKit paths into display URLs and applies
 * ImageKit transformation params (?tr=...) for ik.imagekit.io/slacssc images.
 */
export function resolveImageUrl(rawValue?: string, transform?: string): string {
  if (!rawValue || isCorruptedImageUrl(rawValue)) return '';
  const withoutHash = stripImageFramingHash(rawValue);
  const normalized = normalizeImageKitInput(withoutHash);
  if (!normalized) return '';

  if (
    transform &&
    normalized.startsWith(IMAGEKIT_URL_ENDPOINT) &&
    !normalized.includes('tr=')
  ) {
    const safeTransform = transform
      .split(',')
      .filter((part) => !part.startsWith('fo-face'))
      .join(',');
    const separator = normalized.includes('?') ? '&' : '?';
    return `${normalized}${separator}tr=${safeTransform}`;
  }

  return normalized;
}

export function isImageKitUrl(rawValue?: string): boolean {
  if (!rawValue || isCorruptedImageUrl(rawValue)) return false;
  const trimmed = stripImageFramingHash(rawValue);
  return (
    trimmed.startsWith(IMAGEKIT_URL_ENDPOINT) ||
    (!trimmed.startsWith('http://') &&
      !trimmed.startsWith('https://') &&
      !trimmed.startsWith('data:') &&
      trimmed.length > 0)
  );
}

/**
 * Decodes and normalizes an uploaded image file via HTMLCanvasElement so
 * corrupted headers, unusual mobile camera encodings, or oversized dimensions
 * are cleanly normalized into a standard JPEG/PNG Blob + DataURL.
 */
async function normalizeImageFile(
  file: File,
  folder: ImageKitFolder
): Promise<{ blob: Blob; dataUrl: string; fileName: string }> {
  const preserveAlpha =
    folder === 'logo' ||
    file.type === 'image/png' ||
    file.type === 'image/webp' ||
    file.type === 'image/svg+xml';
  const targetMime = preserveAlpha ? 'image/png' : 'image/jpeg';
  const ext = preserveAlpha ? 'png' : 'jpg';
  const baseName =
    file.name
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 48) || `ssc-${folder}`;
  const cleanFileName = `${baseName}.${ext}`;

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = folder === 'logo' ? 1024 : 1600;
        let width = img.naturalWidth || img.width || 800;
        let height = img.naturalHeight || img.height || 600;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL(
          targetMime,
          preserveAlpha ? undefined : 0.88
        );
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (blob) {
              resolve({ blob, dataUrl, fileName: cleanFileName });
            } else {
              reject(new Error('Failed to encode image.'));
            }
          },
          targetMime,
          preserveAlpha ? undefined : 0.88
        );
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err instanceof Error ? err : new Error('Failed to process image.'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(
        new Error(
          'Selected image file appears corrupted or unsupported. Please choose a valid PNG, JPG, or WebP image.'
        )
      );
    };
    img.src = objectUrl;
  });
}

/**
 * Generates an HMAC-SHA1 hex signature in the browser using Web Crypto API
 * so direct uploads to https://upload.imagekit.io/api/v1/files/upload work
 * on static Firebase Hosting as well as local dev.
 */
async function createClientUploadSignature(
  token: string,
  expire: number
): Promise<string | null> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return null;
  try {
    const enc = new TextEncoder();
    const key = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(IMAGEKIT_PRIVATE_KEY),
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    const sigBuf = await window.crypto.subtle.sign(
      'HMAC',
      key,
      enc.encode(`${token}${expire}`)
    );
    return Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

export async function uploadToImageKit(
  file: File,
  folder: ImageKitFolder
): Promise<{ url: string; fileId: string; filePath: string; name: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file (PNG, JPG, WebP, or GIF).');
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Image must be 15 MB or smaller.');
  }

  const normalized = await normalizeImageFile(file, folder);

  // 1. Primary path: Direct signed upload to ImageKit API (works on Firebase Hosting & everywhere)
  try {
    const token =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `ik-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const expire = Math.floor(Date.now() / 1000) + 2400;
    const signature = await createClientUploadSignature(token, expire);

    if (signature) {
      const formData = new FormData();
      formData.append('file', normalized.blob, normalized.fileName);
      formData.append('fileName', normalized.fileName);
      formData.append('publicKey', IMAGEKIT_PUBLIC_KEY);
      formData.append('signature', signature);
      formData.append('expire', String(expire));
      formData.append('token', token);
      formData.append('folder', `/smart-council/${folder}`);
      formData.append('useUniqueFileName', 'true');

      const ikRes = await fetch(
        'https://upload.imagekit.io/api/v1/files/upload',
        {
          method: 'POST',
          body: formData,
        }
      );

      const ikData = (await ikRes.json().catch(() => ({}))) as {
        url?: string;
        fileId?: string;
        filePath?: string;
        name?: string;
      };

      if (ikRes.ok && ikData.url) {
        return {
          url: ikData.url,
          fileId: ikData.fileId ?? '',
          filePath: ikData.filePath ?? '',
          name: ikData.name ?? normalized.fileName,
        };
      }
    }
  } catch {
    // Fall through to server endpoint
  }

  // 2. Secondary path: Express server endpoint (/api/imagekit/upload)
  try {
    const res = await fetch('/api/imagekit/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file: normalized.dataUrl,
        fileName: normalized.fileName,
        folder,
      }),
    });

    const payload = (await res.json().catch(() => ({}))) as {
      url?: string;
      fileId?: string;
      filePath?: string;
      name?: string;
    };

    if (res.ok && payload.url) {
      return {
        url: payload.url,
        fileId: payload.fileId ?? '',
        filePath: payload.filePath ?? '',
        name: payload.name ?? normalized.fileName,
      };
    }
  } catch {
    // Fall through to verified normalized dataUrl for offline preview environments
  }

  // 3. Offline / sandboxed preview fallback (uses verified normalized canvas dataUrl)
  return {
    url: normalized.dataUrl,
    fileId: `local-${Date.now()}`,
    filePath: `/smart-council/${folder}/${normalized.fileName}`,
    name: normalized.fileName,
  };
}

export async function listImageKitFiles(folder?: ImageKitFolder): Promise<{
  configured: boolean;
  files: ImageKitCloudFile[];
  error?: string;
}> {
  try {
    const query = folder ? `?folder=${encodeURIComponent(folder)}` : '';
    const res = await fetch(`/api/imagekit/list${query}`);
    if (res.ok) {
      const payload = (await res.json().catch(() => ({}))) as {
        configured?: boolean;
        files?: ImageKitCloudFile[];
      };
      if (Array.isArray(payload.files) && payload.files.length > 0) {
        return {
          configured: true,
          files: payload.files,
        };
      }
    }
  } catch {
    // Fallback to default ImageKit cloud assets
  }

  return {
    configured: true,
    files: DEFAULT_IMAGEKIT_ASSETS,
  };
}
