import type { CSSProperties } from 'react';
import { auth } from '../firebase';
import { siteConfig } from '../siteConfig';

const DEFAULT_IMAGEKIT_ENDPOINT = 'https://ik.imagekit.io/slacssc';

export type ImageKitFolder =
  | 'logo'
  | 'council-stock'
  | 'announcements'
  | 'events'
  | 'officers'
  | 'council';

export type CardFramePreset =
  | 'announcement'
  | 'event'
  | 'portrait'
  | 'about'
  | 'logo'
  | 'cover';

export interface CardAspectMeta {
  label: string;
  aspectClass: string;
  stageWidthClass: string;
  baseAspect: 'landscape' | 'portrait' | 'square';
}

export const CARD_ASPECT_CONFIG: Record<CardFramePreset, CardAspectMeta> = {
  announcement: {
    label: 'Announcement Card (16:9)',
    aspectClass: 'aspect-announcement-card',
    stageWidthClass: 'w-full max-w-[420px]',
    baseAspect: 'landscape',
  },
  event: {
    label: 'Event Banner (16:10)',
    aspectClass: 'aspect-event-card',
    stageWidthClass: 'w-full max-w-[400px]',
    baseAspect: 'landscape',
  },
  portrait: {
    label: 'Officer Portrait (4:5)',
    aspectClass: 'aspect-officer-portrait',
    stageWidthClass: 'w-full max-w-[260px]',
    baseAspect: 'portrait',
  },
  about: {
    label: 'Council Feature (4:3)',
    aspectClass: 'aspect-about-card',
    stageWidthClass: 'w-full max-w-[380px]',
    baseAspect: 'landscape',
  },
  logo: {
    label: 'Brand Seal (1:1)',
    aspectClass: 'aspect-logo-mark',
    stageWidthClass: 'w-full max-w-[220px]',
    baseAspect: 'square',
  },
  cover: {
    label: 'Cover Banner (16:9)',
    aspectClass: 'aspect-announcement-card',
    stageWidthClass: 'w-full max-w-[420px]',
    baseAspect: 'landscape',
  },
};

export interface ImageKitCloudFile {
  fileId: string;
  name: string;
  url: string;
  thumbnail: string;
  thumbnailUrl?: string;
  filePath: string;
  folder?: string;
  createdAt?: string;
}

export type ImageKitMediaItem = ImageKitCloudFile;

export const DEFAULT_IMAGEKIT_ASSETS: ImageKitCloudFile[] = [
  {
    fileId: 'default-ssc-logo',
    name: 'ssc-logo.png',
    url: `${DEFAULT_IMAGEKIT_ENDPOINT}/smart-council/logo/ssc-logo_yvq35sFUH.png`,
    thumbnail: `${DEFAULT_IMAGEKIT_ENDPOINT}/smart-council/logo/ssc-logo_yvq35sFUH.png?tr=w-300,q-80,f-auto`,
    filePath: '/smart-council/logo/ssc-logo_yvq35sFUH.png',
    folder: 'logo',
  },
  {
    fileId: 'default-council-stock',
    name: 'council-stock.png',
    url: `${DEFAULT_IMAGEKIT_ENDPOINT}/smart-council/council-stock/council-stock_fA8tG9wLp.png`,
    thumbnail: `${DEFAULT_IMAGEKIT_ENDPOINT}/smart-council/council-stock/council-stock_fA8tG9wLp.png?tr=w-400,q-80,f-auto`,
    filePath: '/smart-council/council-stock/council-stock_fA8tG9wLp.png',
    folder: 'council-stock',
  },
];

export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_IMAGEKIT_FOLDERS = new Set<string>([
  'logo',
  'council-stock',
  'announcements',
  'events',
  'officers',
  'council',
]);

/**
 * Returns the configured ImageKit URL endpoint (e.g., https://ik.imagekit.io/slacssc).
 * Never embeds any private keys in the client bundle.
 */
export function getImageKitEndpoint(): string {
  const envEndpoint = (
    import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT as string | undefined
  )?.trim();
  const raw =
    envEndpoint ||
    siteConfig.brand.imagekitEndpoint ||
    DEFAULT_IMAGEKIT_ENDPOINT;
  return raw.replace(/\/+$/, '');
}

/**
 * Detects whether a stored image URL or path was corrupted (e.g. a CSS gradient,
 * spaces, or a truncated string without an image extension or valid HTTP/data prefix).
 */
export function isCorruptedImageUrl(input: string | undefined | null): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  if (!trimmed) return false;

  const base = stripImageFramingHash(trimmed);
  if (!base) return true;

  if (base.startsWith('data:image/')) return false;
  if (base.startsWith('blob:')) return false;

  if (/linear-gradient|radial-gradient|\s/i.test(base)) {
    return true;
  }

  if (base.startsWith('http://') || base.startsWith('https://')) {
    try {
      const parsed = new URL(base);
      if (parsed.hostname.includes('ik.imagekit.io')) {
        const segments = parsed.pathname.split('/').filter(Boolean);
        if (segments.length < 2) return true;
        const lastSegment = segments[segments.length - 1] || '';
        if (!/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(lastSegment)) {
          return true;
        }
      }
      return false;
    } catch {
      return true;
    }
  }

  if (base.startsWith('/')) {
    const cleanPath = base.split('?')[0];
    if (!/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(cleanPath)) {
      return true;
    }
    return false;
  }

  return true;
}

/**
 * Sanitizes an ImageKit URL or path and falls back to `fallbackUrl` if corrupted.
 */
export function sanitizeImageKitUrl(
  input: string | undefined | null,
  fallbackUrl: string
): string {
  if (!input || !input.trim()) return fallbackUrl;
  if (isCorruptedImageUrl(input)) return fallbackUrl;
  return normalizeImageKitInput(input);
}

/**
 * Normalizes any user input into a clean URL or ImageKit path, preserving `#pos=...` framing hash.
 */
export function normalizeImageKitInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  const hashIndex = trimmed.indexOf('#pos=');
  const basePart = hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed;
  const hashPart = hashIndex >= 0 ? trimmed.slice(hashIndex) : '';

  if (
    basePart.startsWith('http://') ||
    basePart.startsWith('https://') ||
    basePart.startsWith('data:image/') ||
    basePart.startsWith('blob:')
  ) {
    return `${basePart}${hashPart}`;
  }

  const endpoint = getImageKitEndpoint();
  const cleanRel = basePart.replace(/^\/+/, '');
  if (!cleanRel) return '';

  if (cleanRel.startsWith('assets/')) {
    return `/${cleanRel}${hashPart}`;
  }

  return `${endpoint}/${cleanRel}${hashPart}`;
}

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  focus?: 'auto' | 'face' | 'center';
}

/**
 * Resolves any stored image URL or relative ImageKit path into a full CDN URL
 * with automatic format (`f-auto`) and quality (`q-auto`) transformations.
 * Supports either a raw ImageKit transformation string (e.g. `'w-900,c-at_max,f-auto,q-85'`)
 * or an `ImageTransformOptions` object.
 */
export function resolveImageUrl(
  src: string | undefined | null,
  options?: string | ImageTransformOptions
): string {
  if (!src) return '';
  const trimmed = stripImageFramingHash(src.trim());
  if (!trimmed) return '';

  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/assets/')
  ) {
    return trimmed;
  }

  const endpoint = getImageKitEndpoint();
  let fullUrl = trimmed;

  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    const cleanPath = trimmed.replace(/^\/+/, '');
    fullUrl = `${endpoint}/${cleanPath}`;
  }

  if (!fullUrl.includes('ik.imagekit.io')) {
    return fullUrl;
  }

  let trValue = '';
  if (typeof options === 'string') {
    trValue = options.trim();
  } else {
    const trParts: string[] = ['f-auto'];
    if (options?.quality) {
      trParts.push(`q-${options.quality}`);
    } else {
      trParts.push('q-80');
    }
    if (options?.width) {
      trParts.push(`w-${options.width}`);
    }
    if (options?.height) {
      trParts.push(`h-${options.height}`);
    }
    if (options?.focus) {
      trParts.push(`fo-${options.focus}`);
    }
    trValue = trParts.join(',');
  }

  if (!trValue) return fullUrl;

  try {
    const parsed = new URL(fullUrl);
    if (!parsed.searchParams.has('tr')) {
      parsed.searchParams.set('tr', trValue);
    }
    return parsed.toString();
  } catch {
    return fullUrl;
  }
}

/**
 * Generates a responsive `srcSet` string for ImageKit CDN URLs across standard widths.
 */
export function getImageKitSrcSet(
  src: string | undefined | null,
  widths: number[] = [400, 800, 1200]
): string | undefined {
  if (!src) return undefined;
  const clean = stripImageFramingHash(src.trim());
  if (!clean.includes('ik.imagekit.io')) return undefined;

  return widths
    .map((w) => `${resolveImageUrl(clean, { width: w })} ${w}w`)
    .join(', ');
}

export interface ImageFraming {
  x: number;
  y: number;
  zoom: number;
  fit: 'cover' | 'contain';
  cardPreset?: CardFramePreset;
}

export function getDefaultImageFraming(
  aspect: 'landscape' | 'portrait' | 'square' | 'contain' | 'cover' = 'landscape'
): ImageFraming {
  if (aspect === 'square' || aspect === 'contain') {
    return { x: 50, y: 50, zoom: 1, fit: 'contain' };
  }
  return { x: 50, y: 50, zoom: 1, fit: 'cover' };
}

export function parseImageFraming(
  src: string | undefined | null,
  fallbackAspect:
    | 'landscape'
    | 'portrait'
    | 'square'
    | 'contain'
    | 'cover' = 'landscape'
): ImageFraming {
  const defaults = getDefaultImageFraming(fallbackAspect);
  if (!src) return defaults;

  const hashIdx = src.indexOf('#pos=');
  if (hashIdx < 0) return defaults;

  const rawParams = src.slice(hashIdx + 5).trim();
  const parts = rawParams.split(',');
  const x = Math.max(0, Math.min(100, Number(parts[0]) || 50));
  const y = Math.max(0, Math.min(100, Number(parts[1]) || 50));
  const zoom = Math.max(0.6, Math.min(2.5, Number(parts[2]) || 1));
  const fit: 'cover' | 'contain' =
    parts[3] === 'contain'
      ? 'contain'
      : parts[3] === 'cover'
        ? 'cover'
        : defaults.fit;
  const cardPreset = parts[4] as CardFramePreset | undefined;

  return {
    x,
    y,
    zoom,
    fit,
    ...(cardPreset ? { cardPreset } : {}),
  };
}

export function stripImageFramingHash(src: string | undefined | null): string {
  if (!src) return '';
  const idx = src.indexOf('#pos=');
  return idx >= 0 ? src.slice(0, idx) : src;
}

export function buildFramedImageUrl(
  src: string,
  framing: Partial<ImageFraming>,
  fallbackAspect:
    | 'landscape'
    | 'portrait'
    | 'square'
    | 'contain'
    | 'cover' = 'landscape'
): string {
  const base = stripImageFramingHash(src.trim());
  if (!base) return '';
  const defaults = getDefaultImageFraming(fallbackAspect);
  const rx = Math.round(Math.max(0, Math.min(100, framing.x ?? defaults.x)));
  const ry = Math.round(Math.max(0, Math.min(100, framing.y ?? defaults.y)));
  const rz = Number(
    Math.max(0.6, Math.min(2.5, framing.zoom ?? defaults.zoom)).toFixed(2)
  );
  const fit = framing.fit ?? defaults.fit;
  const preset = framing.cardPreset;

  if (rx === 50 && ry === 50 && rz === 1 && fit === defaults.fit && !preset) {
    return base;
  }

  const suffix = preset
    ? `${rx},${ry},${rz},${fit},${preset}`
    : `${rx},${ry},${rz},${fit}`;
  return `${base}#pos=${suffix}`;
}

export function applyImageFramingHash(
  src: string,
  x: number,
  y: number,
  zoom = 1
): string {
  return buildFramedImageUrl(src, { x, y, zoom });
}

export function getImageFramingStyle(
  src: string | undefined | null,
  fallbackAspect:
    | 'landscape'
    | 'portrait'
    | 'square'
    | 'contain'
    | 'cover' = 'landscape'
): CSSProperties {
  const { x, y, zoom, fit } = parseImageFraming(src, fallbackAspect);
  return {
    objectFit: fit,
    objectPosition: `${x}% ${y}%`,
    transform: zoom !== 1 ? `scale(${zoom})` : undefined,
    transformOrigin: `${x}% ${y}%`,
  };
}

export interface ImageKitUploadResult {
  url: string;
  filePath: string;
  name: string;
  fileId: string;
}

async function getAuthBearerHeader(): Promise<Record<string, string>> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error(
      'Please sign in with an SSC Official or Admin account before uploading.'
    );
  }
  const idToken = await currentUser.getIdToken();
  return {
    Authorization: `Bearer ${idToken}`,
  };
}

/**
 * Lists files from ImageKit via the authenticated `/api/imagekit/list` endpoint.
 */
export async function listImageKitFiles(
  folder = ''
): Promise<{ files: ImageKitCloudFile[] }> {
  try {
    const cleanFolder = folder
      .replace(/^\/+|\/+$/g, '')
      .replace(/^smart-council\/?/, '');
    const authHeaders = await getAuthBearerHeader();
    const query = cleanFolder
      ? `?folder=${encodeURIComponent(cleanFolder)}`
      : '';
    const response = await fetch(`/api/imagekit/list${query}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...authHeaders,
      },
    });
    if (!response.ok) return { files: DEFAULT_IMAGEKIT_ASSETS };
    const data = (await response.json()) as {
      files?: Array<Record<string, unknown>>;
    };
    if (!Array.isArray(data.files) || data.files.length === 0) {
      return { files: DEFAULT_IMAGEKIT_ASSETS };
    }
    const mapped = data.files
      .filter((item) => typeof item.url === 'string' && item.url)
      .map((item) => ({
        fileId: String(item.fileId ?? item.name ?? ''),
        name: String(item.name ?? 'image'),
        url: String(item.url),
        thumbnail: String(item.thumbnail ?? item.url),
        thumbnailUrl: String(item.thumbnail ?? item.url),
        filePath: String(item.filePath ?? ''),
        folder: cleanFolder || 'council',
        createdAt:
          typeof item.createdAt === 'string' ? item.createdAt : undefined,
      }));
    return {
      files: mapped.length > 0 ? mapped : DEFAULT_IMAGEKIT_ASSETS,
    };
  } catch {
    return { files: DEFAULT_IMAGEKIT_ASSETS };
  }
}

/**
 * Validates file MIME type, size (<= 10 MB), and target folder allowlist,
 * fetches a short-lived signature from `/api/imagekit/auth` (authenticated via Firebase ID token),
 * and uploads the file directly to ImageKit's upload API (`https://upload.imagekit.io/api/v1/files/upload`).
 */
export async function uploadToImageKit(
  file: File,
  folder = 'council'
): Promise<ImageKitUploadResult> {
  if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.type)) {
    throw new Error(
      `Unsupported image format (${file.type || 'unknown'}). Allowed: JPEG, PNG, WebP, GIF.`
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Image exceeds the 10 MB maximum file size limit.');
  }

  const cleanSubfolder = folder
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/^smart-council\/?/, '');

  const validatedSubfolder = ALLOWED_IMAGEKIT_FOLDERS.has(cleanSubfolder)
    ? cleanSubfolder
    : 'council';

  const authHeaders = await getAuthBearerHeader();
  const authResponse = await fetch(
    `/api/imagekit/auth?folder=${encodeURIComponent(validatedSubfolder)}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...authHeaders,
      },
    }
  );

  const authData = (await authResponse.json()) as {
    token?: string;
    expire?: number;
    signature?: string;
    publicKey?: string;
    folder?: string;
    error?: string;
  };

  if (
    !authResponse.ok ||
    !authData.token ||
    !authData.expire ||
    !authData.signature ||
    !authData.publicKey
  ) {
    throw new Error(
      authData.error ||
        'Unable to obtain signed upload credentials from server.'
    );
  }

  const safeName =
    file.name.replace(/[^a-zA-Z0-9._-]/g, '_') || `ssc-${Date.now()}.jpg`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('fileName', safeName);
  formData.append('publicKey', authData.publicKey);
  formData.append('signature', authData.signature);
  formData.append('expire', String(authData.expire));
  formData.append('token', authData.token);
  formData.append(
    'folder',
    authData.folder || `/smart-council/${validatedSubfolder}`
  );
  formData.append('useUniqueFileName', 'true');

  const uploadRes = await fetch(
    'https://upload.imagekit.io/api/v1/files/upload',
    {
      method: 'POST',
      body: formData,
    }
  );

  const uploadData = (await uploadRes.json()) as {
    url?: string;
    filePath?: string;
    name?: string;
    fileId?: string;
    message?: string;
  };

  if (!uploadRes.ok || !uploadData.url) {
    throw new Error(
      uploadData.message || 'Direct upload to ImageKit failed.'
    );
  }

  return {
    url: uploadData.url,
    filePath: uploadData.filePath || '',
    name: uploadData.name || safeName,
    fileId: uploadData.fileId || '',
  };
}
