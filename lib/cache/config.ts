export const DEFAULT_CACHE_MAX_GB = 5;
export const DEFAULT_MIN_FREE_MB = 256;

export function isValidCacheMaxGb(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function resolveCacheMaxGb(
  savedMaxGb: number | undefined,
  environmentMaxGb = Number(process.env.CACHE_MAX_GB),
): number {
  if (isValidCacheMaxGb(savedMaxGb)) return savedMaxGb;
  if (isValidCacheMaxGb(environmentMaxGb)) return environmentMaxGb;
  return DEFAULT_CACHE_MAX_GB;
}
