export type MediaSource =
  | 'tiktok'
  | 'youtube'
  | 'instagram'
  | 'facebook'
  | 'soundcloud';

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

const INSTAGRAM_HOSTS = new Set([
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
]);

const FACEBOOK_HOSTS = new Set([
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'fb.watch',
]);

const SOUNDCLOUD_HOSTS = new Set([
  'soundcloud.com',
  'www.soundcloud.com',
  'm.soundcloud.com',
  'on.soundcloud.com',
]);

export const MEDIA_SOURCE_LABELS: Record<MediaSource, string> = {
  tiktok: 'TikTok',
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
  soundcloud: 'SoundCloud',
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

export function normalizeInstagramUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    const protocol = url.protocol === 'http:' ? 'http:' : 'https:';

    // Remove tracking parameters
    url.search = '';
    url.hash = '';

    return `${protocol}//www.instagram.com${url.pathname}`;
  } catch {
    return trimmed;
  }
}

export function normalizeFacebookUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    const protocol = url.protocol === 'http:' ? 'http:' : 'https:';

    if (host === 'fb.watch') {
      return `${protocol}//fb.watch${url.pathname}`;
    }

    // Keep ?v= parameter for Facebook video URLs, remote other tracking params
    const videoId = url.searchParams.get('v');
    if (videoId) {
      return `${protocol}//www.facebook.com${url.pathname}?v=${videoId}`;
    }

    url.search = '';
    url.hash = '';
    return `${protocol}//www.facebook.com${url.pathname}`;
  } catch {
    return trimmed;
  }
}

export function normalizeSoundCloudUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    const protocol = url.protocol === 'http:' ? 'http:' : 'https:';

    if (host === 'on.soundcloud.com') {
      return `${protocol}//on.soundcloud.com${url.pathname}`;
    }

    url.search = '';
    url.hash = '';
    return `${protocol}//soundcloud.com${url.pathname}`;
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

  const isInstagram =
    INSTAGRAM_HOSTS.has(host) || host.endsWith('.instagram.com');
  if (isInstagram) {
    return {
      valid: true,
      source: 'instagram',
      normalized: normalizeInstagramUrl(raw),
    };
  }

  const isFacebook = FACEBOOK_HOSTS.has(host) || host.endsWith('.facebook.com');
  if (isFacebook) {
    return {
      valid: true,
      source: 'facebook',
      normalized: normalizeFacebookUrl(raw),
    };
  }

  const isSoundCloud =
    SOUNDCLOUD_HOSTS.has(host) || host.endsWith('.soundcloud.com');
  if (isSoundCloud) {
    return {
      valid: true,
      source: 'soundcloud',
      normalized: normalizeSoundCloudUrl(raw),
    };
  }

  return {
    valid: false,
    error:
      'Chỉ hỗ trợ URL từ TikTok, YouTube, Instagram, Facebook hoặc SoundCloud',
  };
}
