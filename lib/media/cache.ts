import { createHash } from 'node:crypto';
import { validateMediaUrl } from './source';

/**
 * Deterministic cache key from a normalized URL.
 * SHA-256 (64 chars) is well within macOS filename limits (255 chars).
 * Cached data on disk uses this as the key, so the algorithm is stable.
 */
export function cacheKey(normalizedUrl: string): string {
  return createHash('sha256').update(normalizedUrl).digest('hex');
}

/**
 * Validate a raw URL first, then derive its cache key.
 * Throws if the URL isn't valid.
 */
export function cacheKeyFromRaw(rawUrl: string): string {
  const result = validateMediaUrl(rawUrl);
  if (!result.valid) {
    throw new Error(result.error ?? 'URL không hợp lệ');
  }
  return cacheKey(result.normalized!);
}
