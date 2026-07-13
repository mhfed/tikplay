import { createHash } from 'crypto';

/**
 * Hosts we consider "TikTok". We accept the bare host plus any subdomain under
 * tiktok.com (covers www, m, vt, vm, t, etc.) so future short-domains work too.
 */
const TIKTOK_HOSTS = new Set([
  'tiktok.com',
  'www.tiktok.com',
  'vt.tiktok.com',
  'vm.tiktok.com',
  't.tiktok.com',
]);

export interface ValidationResult {
  valid: boolean;
  /** Canonical URL with query string / hash stripped. */
  normalized?: string;
  error?: string;
}

/**
 * Strip tracking params, query string and hash. We keep protocol + host +
 * pathname only, so two URLs pointing at the same video hash to the same key.
 */
export function normalizeTikTokUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    // Not a parseable URL; return as-is (validation will reject it).
    return trimmed;
  }
}

/** Validate that a string is a usable TikTok URL. */
export function validateTikTokUrl(raw: string): ValidationResult {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, error: 'URL không được để trống' };
  }

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { valid: false, error: 'URL không hợp lệ' };
  }

  const host = url.hostname.toLowerCase();
  const isTikTok = TIKTOK_HOSTS.has(host) || host.endsWith('.tiktok.com');
  if (!isTikTok) {
    return { valid: false, error: 'Chỉ hỗ trợ URL từ TikTok' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { valid: false, error: 'URL phải dùng http hoặc https' };
  }

  return { valid: true, normalized: normalizeTikTokUrl(raw) };
}

/** Stable cache key: sha256 of the normalized URL. */
export function cacheKey(normalizedUrl: string): string {
  return createHash('sha256').update(normalizedUrl).digest('hex');
}

/** Convenience: validate + normalize + hash in one call. */
export function cacheKeyFromRaw(raw: string): string {
  const res = validateTikTokUrl(raw);
  if (!res.valid || !res.normalized) {
    throw new Error(res.error ?? 'URL không hợp lệ');
  }
  return cacheKey(res.normalized);
}
