import { createHash } from 'node:crypto';

export type MediaSource = 'tiktok' | 'youtube';

export interface MediaValidationResult {
  valid: boolean;
  source?: MediaSource;
  normalized?: string;
  error?: string;
}

const TIKTOK_HOSTS = new Set([
  'tiktok.com',
  'www.tiktok.com',
  'vt.tiktok.com',
  'vm.tiktok.com',
  't.tiktok.com',
]);

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);

export const MEDIA_SOURCE_LABELS: Record<MediaSource, string> = {
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

export function normalizeTikTokUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);

    // TikTok photo posts contain a regular audio track, but yt-dlp's TikTok
    // extractor only recognizes the canonical `/video/:id` route. The video
    // endpoint returns the same post metadata and exposes its audio-only format.
    // Canonicalizing here also ensures validation, cache keys, metadata, and the
    // download all use the extractor-compatible URL.
    const pathname = url.pathname.replace(
      /^(\/@[^/]+)\/photo\/(\d+)(\/?)$/,
      '$1/video/$2$3',
    );

    return `${url.protocol}//${url.host}${pathname}`;
  } catch {
    return trimmed;
  }
}

export function normalizeYouTubeUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    const protocol = url.protocol === 'http:' ? 'http:' : 'https:';

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id ? `${protocol}//youtu.be/${id}` : trimmed;
    }

    const videoId = url.searchParams.get('v');
    if (videoId) return `${protocol}//www.youtube.com/watch?v=${videoId}`;

    const parts = url.pathname.split('/').filter(Boolean);
    const [kind, id] = parts;
    if (kind && id && ['embed', 'live', 'shorts'].includes(kind)) {
      return `${protocol}//www.youtube.com/${kind}/${id}`;
    }

    return `${protocol}//${url.host}${url.pathname}`;
  } catch {
    return trimmed;
  }
}

export function validateMediaUrl(raw: string): MediaValidationResult {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, error: 'URL không được để trống' };
  }

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { valid: false, error: 'URL không hợp lệ' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { valid: false, error: 'URL phải dùng http hoặc https' };
  }

  const host = url.hostname.toLowerCase();
  const isTikTok = TIKTOK_HOSTS.has(host) || host.endsWith('.tiktok.com');
  if (isTikTok) {
    return {
      valid: true,
      source: 'tiktok',
      normalized: normalizeTikTokUrl(raw),
    };
  }

  const isYouTube = YOUTUBE_HOSTS.has(host) || host.endsWith('.youtube.com');
  if (isYouTube) {
    return {
      valid: true,
      source: 'youtube',
      normalized: normalizeYouTubeUrl(raw),
    };
  }

  return { valid: false, error: 'Chỉ hỗ trợ URL từ TikTok hoặc YouTube' };
}

export function cacheKey(normalizedUrl: string): string {
  return createHash('sha256').update(normalizedUrl).digest('hex');
}

export function cacheKeyFromRaw(raw: string): string {
  const res = validateMediaUrl(raw);
  if (!res.valid || !res.normalized) {
    throw new Error(res.error ?? 'URL không hợp lệ');
  }
  return cacheKey(res.normalized);
}
