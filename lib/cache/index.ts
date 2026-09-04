import {
  existsSync,
  promises as fs,
  mkdirSync,
  readdirSync,
  readFileSync,
  statfsSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { join, sep } from 'node:path';

const DEFAULT_TTL_DAYS = 7;
const DEFAULT_MAX_GB = 5;
const DEFAULT_MIN_FREE_MB = 256;
const STALE_TEMP_TTL_MS = 60 * 60 * 1000;
const PREVIEW_TTL_MS = 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface CacheOptions {
  dir?: string;
  ttlDays?: number;
  maxGb?: number;
  minFreeMb?: number;
}

export interface CacheEvictionOptions {
  /** Keys that must never be evicted during the current operation. */
  protectedKeys?: ReadonlySet<string>;
  /** Keys represented in the library; skip TTL eviction but evict under pressure. */
  referencedKeys?: ReadonlySet<string>;
}

/**
 * Filesystem-backed cache of processed audio. The interface is intentionally
 * small so it can later be swapped for R2/S3/Redis without touching callers.
 */
export interface CacheStore {
  /** Returns the absolute file path if the audio exists, else null. */
  get(key: string): string | null;
  /** Copy a source file into the cache under `key`. */
  set(key: string, srcPath: string): Promise<void>;
  /** Remove audio and every sidecar associated with `key`. */
  remove(key: string): Promise<void>;
  /** Drop expired orphan files, then evict LRU until under the size cap. */
  evictOld(options?: CacheEvictionOptions): Promise<string[]>;
}

/** Cache directory: env override or default `./cache` next to the app. */
export function getCacheDir(): string {
  if (process.env.CACHE_DIR) return process.env.CACHE_DIR;

  const cwd = process.cwd();

  // Next.js standalone mode: server.js calls process.chdir(__dirname),
  // so CWD becomes project-root/.next/standalone/.
  // Cache is at project-root/cache/ (two levels up from CWD).
  if (cwd.includes(`${sep}.next${sep}standalone`)) {
    return join(cwd, '..', '..', 'cache');
  }

  return join(cwd, 'cache');
}

/** Create the cache directory if missing. */
export function ensureCacheDir(dir: string = getCacheDir()): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function audioPath(dir: string, key: string): string {
  return join(dir, `${key}.m4a`);
}

function metaPath(dir: string, key: string): string {
  return join(dir, `${key}.json`);
}

/** Content-type <-> extension for cached cover images (extension picked at write time). */
const COVER_MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const EXT_COVER_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(COVER_MIME_EXT).map(([mime, ext]) => [ext, mime]),
);

function coverExt(contentType: string): string {
  return (
    COVER_MIME_EXT[contentType.split(';')[0].trim().toLowerCase()] || 'jpg'
  );
}

export class FileCacheStore implements CacheStore {
  private dir: string;
  private ttlDays: number;
  private maxBytes: number;
  private minFreeBytes: number;

  constructor(opts: CacheOptions = {}) {
    this.dir = opts.dir || getCacheDir();
    this.ttlDays =
      (opts.ttlDays ?? Number(process.env.CACHE_TTL_DAYS)) || DEFAULT_TTL_DAYS;
    this.maxBytes =
      ((opts.maxGb ?? Number(process.env.CACHE_MAX_GB)) || DEFAULT_MAX_GB) *
      1024 *
      1024 *
      1024;
    const configuredMinFreeMb =
      opts.minFreeMb ?? Number(process.env.CACHE_MIN_FREE_MB);
    const minFreeMb = Number.isFinite(configuredMinFreeMb)
      ? configuredMinFreeMb
      : DEFAULT_MIN_FREE_MB;
    this.minFreeBytes = Math.max(0, minFreeMb) * 1024 * 1024;
    ensureCacheDir(this.dir);
  }

  get(key: string): string | null {
    const p = audioPath(this.dir, key);
    return existsSync(p) ? p : null;
  }

  async set(key: string, srcPath: string): Promise<void> {
    ensureCacheDir(this.dir);
    await fs.copyFile(srcPath, audioPath(this.dir, key));
  }

  async remove(key: string): Promise<void> {
    const audio = audioPath(this.dir, key);
    if (existsSync(audio)) await fs.unlink(audio);
    this.removeSidecars(key);
  }

  /** Persist metadata alongside the audio file for fast reuse. */
  async saveMeta(key: string, meta: unknown): Promise<void> {
    ensureCacheDir(this.dir);
    await fs.writeFile(metaPath(this.dir, key), JSON.stringify(meta), 'utf8');
  }

  /** Read cached metadata, or null if absent / corrupt. */
  getMeta(key: string): unknown | null {
    const p = metaPath(this.dir, key);
    if (!existsSync(p)) return null;
    try {
      return JSON.parse(readFileSync(p, 'utf8'));
    } catch {
      return null;
    }
  }

  /** Persist a downloaded cover image, keyed by content-type-derived extension. */
  async saveCover(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    ensureCacheDir(this.dir);
    await fs.writeFile(
      join(this.dir, `${key}.${coverExt(contentType)}`),
      buffer,
    );
  }

  /** Locate a cached cover for `key`, trying every known extension. */
  getCover(key: string): { path: string; contentType: string } | null {
    for (const [ext, contentType] of Object.entries(EXT_COVER_MIME)) {
      const p = join(this.dir, `${key}.${ext}`);
      if (existsSync(p)) return { path: p, contentType };
    }
    return null;
  }

  async evictOld(options: CacheEvictionOptions = {}): Promise<string[]> {
    const protectedKeys = options.protectedKeys ?? new Set<string>();
    const referencedKeys = options.referencedKeys ?? new Set<string>();
    ensureCacheDir(this.dir);
    const now = Date.now();
    this.removeStaleTempFiles(now);
    this.removeExpiredPreviews(now);
    const files = readdirSync(this.dir).filter((f) => f.endsWith('.m4a'));
    const ttlMs = this.ttlDays * MS_PER_DAY;

    const entries: {
      file: string;
      mtime: number;
      size: number;
      referenced: boolean;
    }[] = [];
    const evictedKeys: string[] = [];
    let totalBytes = 0;

    for (const f of files) {
      const full = join(this.dir, f);
      const st = statSync(full);
      const key = f.slice(0, -'.m4a'.length);
      const protectedEntry = protectedKeys.has(key);
      const referencedEntry = referencedKeys.has(key);

      // Expire only files no longer represented by the library. Library tracks
      // remain available until the cache needs to make room for new media.
      if (!protectedEntry && !referencedEntry && now - st.mtimeMs > ttlMs) {
        unlinkSync(full);
        this.removeSidecars(key);
        evictedKeys.push(key);
        continue;
      }
      totalBytes += st.size;
      if (!protectedEntry) {
        entries.push({
          file: full,
          mtime: st.mtimeMs,
          size: st.size,
          referenced: referencedEntry,
        });
      }
    }

    // If still over the cap, evict least-recently-used (oldest mtime) first.
    if (totalBytes > this.maxBytes || !this.hasEnoughFreeSpace()) {
      // Prefer removing orphaned cache files before removing saved library
      // tracks. Within each group, evict the oldest file first.
      entries.sort(
        (a, b) =>
          Number(a.referenced) - Number(b.referenced) || a.mtime - b.mtime,
      );
      for (const e of entries) {
        if (totalBytes <= this.maxBytes && this.hasEnoughFreeSpace()) break;
        unlinkSync(e.file);
        const key = e.file.slice(this.dir.length + 1, -'.m4a'.length);
        this.removeSidecars(key);
        totalBytes -= e.size;
        evictedKeys.push(key);
      }
    }

    return evictedKeys;
  }

  private hasEnoughFreeSpace(): boolean {
    try {
      const stats = statfsSync(this.dir);
      return stats.bavail * stats.bsize >= this.minFreeBytes;
    } catch {
      // The cache size limit still protects the filesystem if statfs is not
      // available on a particular deployment target.
      return true;
    }
  }

  private removeExpiredPreviews(now: number): void {
    const previewDir = join(this.dir, 'preview');
    if (!existsSync(previewDir)) return;

    for (const file of readdirSync(previewDir)) {
      const full = join(previewDir, file);
      try {
        if (now - statSync(full).mtimeMs > PREVIEW_TTL_MS) {
          unlinkSync(full);
        }
      } catch {
        // A concurrent preview may have removed or replaced this file.
      }
    }
  }

  private removeStaleTempFiles(now: number): void {
    const temporaryFile = /\.(?:part|tmp|ytdl)$/i;
    for (const file of readdirSync(this.dir)) {
      if (!temporaryFile.test(file)) continue;

      const full = join(this.dir, file);
      try {
        if (now - statSync(full).mtimeMs > STALE_TEMP_TTL_MS) {
          unlinkSync(full);
        }
      } catch {
        // A concurrent download may have removed or replaced this fragment.
      }
    }
  }

  /** Remove the meta + cover files that ride alongside an evicted audio file. */
  private removeSidecars(key: string): void {
    const meta = metaPath(this.dir, key);
    if (existsSync(meta)) unlinkSync(meta);
    for (const ext of Object.keys(EXT_COVER_MIME)) {
      const p = join(this.dir, `${key}.${ext}`);
      if (existsSync(p)) unlinkSync(p);
    }
  }
}
