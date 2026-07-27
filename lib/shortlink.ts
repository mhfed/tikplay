import { getDb, saveDb } from './db/index';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const CODE_LENGTH = 6;

/**
 * Generate a random base62 short code.
 * Collision probability for 6 chars out of 62^6 (~56B) is negligible for our scale,
 * but we still check uniqueness before persisting.
 */
function generateRandomCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += BASE62[Math.floor(Math.random() * BASE62.length)];
  }
  return code;
}

/** Generate a unique short code that doesn't collide with existing entries. */
export function generateShortCode(): string {
  const db = getDb();
  const existing = new Set(db.shortLinks.map((row) => row.code));
  let code: string;
  do {
    code = generateRandomCode();
  } while (existing.has(code));
  return code;
}

export type ShortLinkTargetType = 'track' | 'playlist';

/**
 * Create a new short link entry in the DB.
 * Returns the generated short code.
 */
export function createShortLink(
  targetType: ShortLinkTargetType,
  targetId: number,
): string {
  const db = getDb();
  const code = generateShortCode();
  db.shortLinks.push({
    code,
    target_type: targetType,
    target_id: targetId,
    created_at: Date.now(),
  });
  saveDb();
  return code;
}

/**
 * Find an existing short link for the given target, or create one.
 * Returns the short code.
 */
export function getOrCreateShortLink(
  targetType: ShortLinkTargetType,
  targetId: number,
): string {
  const db = getDb();
  const existing = db.shortLinks.find(
    (row) => row.target_type === targetType && row.target_id === targetId,
  );
  if (existing) return existing.code;
  return createShortLink(targetType, targetId);
}

/**
 * Resolve a short code to its target URL path.
 * Returns the URL path (e.g. "/track/my-song") or null if not found.
 */
export function resolveShortCode(code: string): string | null {
  const db = getDb();
  const row = db.shortLinks.find((r) => r.code === code);
  if (!row) return null;

  switch (row.target_type) {
    case 'track': {
      const track = db.tracks.find((t) => t.id === row.target_id);
      if (!track) return null;
      return `/track/${track.slug ?? track.id}`;
    }
    case 'playlist': {
      const playlist = db.playlists.find((p) => p.id === row.target_id);
      if (!playlist) return null;
      if (row.target_id === -1) return '/library/favorites';
      if (row.target_id === 1) return '/library';
      return `/library/${row.target_id}`;
    }
    default:
      return null;
  }
}

/**
 * Extract the origin from a server-side Request object.
 * This uses the Origin header first, then falls back to Host + protocol
 * headers which are set by reverse proxies like Fly.io.
 */
export function originFromRequest(request: Request): string {
  const origin = request.headers.get('origin');
  if (origin) return origin;

  const host =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    'localhost:3000';
  const proto =
    request.headers.get('x-forwarded-proto') ||
    (host.includes('localhost') || host.includes('127.0.0.1')
      ? 'http'
      : 'https');
  return `${proto}://${host}`;
}

/**
 * Build the full short URL for a given short code.
 *
 * On the client side (`window` is defined) the origin is read from the
 * browser. On the server side an explicit `origin` must be passed (usually
 * derived from the incoming request via {@link originFromRequest}).
 */
export function shortUrl(code: string, origin?: string): string {
  const resolved =
    origin ??
    (typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_ORIGIN || 'http://localhost:3000');
  return `${resolved}/s/${code}`;
}
