import { promises as fs } from 'fs';
import {
  existsSync,
  statSync,
  readdirSync,
  unlinkSync,
  mkdirSync,
  readFileSync,
} from 'fs';
import { join } from 'path';

const DEFAULT_TTL_DAYS = 7;
const DEFAULT_MAX_GB = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface CacheOptions {
  dir?: string;
  ttlDays?: number;
  maxGb?: number;
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
  /** Drop expired files, then evict LRU until under the size cap. */
  evictOld(): Promise<void>;
}

/** Cache directory: env override or default `./cache` next to the app. */
export function getCacheDir(): string {
  return process.env.CACHE_DIR || './cache';
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
  return COVER_MIME_EXT[contentType.split(';')[0].trim().toLowerCase()] || 'jpg';
}

export class FileCacheStore implements CacheStore {
  private dir: string;
  private ttlDays: number;
  private maxBytes: number;

  constructor(opts: CacheOptions = {}) {
    this.dir = opts.dir || getCacheDir();
    this.ttlDays =
      (opts.ttlDays ?? Number(process.env.CACHE_TTL_DAYS)) || DEFAULT_TTL_DAYS;
    this.maxBytes =
      ((opts.maxGb ?? Number(process.env.CACHE_MAX_GB)) || DEFAULT_MAX_GB) *
      1024 *
      1024 *
      1024;
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

  async evictOld(): Promise<void> {
    ensureCacheDir(this.dir);
    const files = readdirSync(this.dir).filter((f) => f.endsWith('.m4a'));
    const now = Date.now();
    const ttlMs = this.ttlDays * MS_PER_DAY;

    const entries: { file: string; mtime: number; size: number }[] = [];
    let totalBytes = 0;

    for (const f of files) {
      const full = join(this.dir, f);
      const st = statSync(full);
      const key = f.slice(0, -'.m4a'.length);
      // Expire by file mtime (when the audio was last written).
      if (now - st.mtimeMs > ttlMs) {
        unlinkSync(full);
        this.removeSidecars(key);
        continue;
      }
      entries.push({ file: full, mtime: st.mtimeMs, size: st.size });
      totalBytes += st.size;
    }

    // If still over the cap, evict least-recently-used (oldest mtime) first.
    if (totalBytes > this.maxBytes) {
      entries.sort((a, b) => a.mtime - b.mtime);
      for (const e of entries) {
        if (totalBytes <= this.maxBytes) break;
        unlinkSync(e.file);
        const key = e.file.slice(this.dir.length + 1, -'.m4a'.length);
        this.removeSidecars(key);
        totalBytes -= e.size;
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
