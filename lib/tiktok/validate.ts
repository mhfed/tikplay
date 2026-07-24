import {
  normalizeTikTokUrl,
  type MediaValidationResult as ValidationResult,
  validateMediaUrl,
} from '../media/source';

/**
 * Hosts we consider "TikTok". We accept the bare host plus any subdomain under
 * tiktok.com (covers www, m, vt, vm, t, etc.) so future short-domains work too.
 */
export type { ValidationResult };

/**
 * Strip tracking params, query string and hash. We keep protocol + host +
 * pathname only, so two URLs pointing at the same video hash to the same key.
 */
export { normalizeTikTokUrl };

/** Validate that a string is a usable TikTok URL. */
export function validateTikTokUrl(raw: string): ValidationResult {
  const res = validateMediaUrl(raw);
  if (res.valid && res.source !== 'tiktok') {
    return { valid: false, error: 'Chỉ hỗ trợ URL từ TikTok' };
  }
  return res;
}
