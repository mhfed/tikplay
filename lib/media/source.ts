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

/** Platform brand colors for source badges.
 *  Each entry uses a tinted background (10% opacity) and a vivid text color so
 *  they read well on the dark theme. */
export const SOURCE_BADGE_COLORS: Record<
  MediaSource,
  { bg: string; text: string }
> = {
  tiktok: { bg: 'rgba(255,0,80,0.15)', text: '#ff3377' },
  youtube: { bg: 'rgba(255,0,0,0.15)', text: '#ff4444' },
  instagram: { bg: 'rgba(228,64,95,0.15)', text: '#e4405f' },
  facebook: { bg: 'rgba(24,119,242,0.15)', text: '#4d8bf5' },
  soundcloud: { bg: 'rgba(255,119,0,0.15)', text: '#ff8800' },
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

    // Keep ?v= parameter for Facebook video URLs, remove other tracking params
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

export function isTikTokProfileUrl(url: string | URL): boolean {
  try {
    const parsed = typeof url === 'string' ? new URL(url) : url;
    if (
      !TIKTOK_HOSTS.has(parsed.hostname.toLowerCase()) &&
      !parsed.hostname.toLowerCase().endsWith('.tiktok.com')
    ) {
      return false;
    }
    const pathname = parsed.pathname.replace(/\/+$/, '');
    return /^\/@[\w.-]+(\/)?$/.test(pathname);
  } catch {
    return false;
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

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function sha256Hex(msg: string): string {
  const data = new TextEncoder().encode(msg);
  const len = data.length;
  const bitLen = len * 8;
  const blocks = Math.ceil((len + 9) / 64);
  const totalLen = blocks * 64;
  const buf = new Uint8Array(totalLen);
  buf.set(data);
  buf[len] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(totalLen - 4, bitLen >>> 0, false);
  view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let offset = 0; offset < totalLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 =
        ((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^
        ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^
        (w[i - 15] >>> 3);
      const s1 =
        ((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^
        ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^
        (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 =
        ((e >>> 6) | (e << 26)) ^
        ((e >>> 11) | (e << 21)) ^
        ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 =
        ((a >>> 2) | (a << 30)) ^
        ((a >>> 13) | (a << 19)) ^
        ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const hex = (n: number) => n.toString(16).padStart(8, '0');
  return `${hex(h0)}${hex(h1)}${hex(h2)}${hex(h3)}${hex(h4)}${hex(h5)}${hex(h6)}${hex(h7)}`;
}

export function cacheKey(normalizedUrl: string): string {
  // SHA-256 (64 chars) is well within macOS filename limits (255 chars).
  // Cached data on disk uses this as the key, so the algorithm is stable.
  return sha256Hex(normalizedUrl);
}

export function cacheKeyFromRaw(rawUrl: string): string {
  const result = validateMediaUrl(rawUrl);
  if (!result.valid) {
    throw new Error(result.error ?? 'URL không hợp lệ');
  }
  return cacheKey(result.normalized!);
}
