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
import {
  DEFAULT_MIN_FREE_MB,
  isValidCacheMaxGb,
  resolveCacheMaxGb,
} from './config';

const DEFAULT_TTL_DAYS = 7;
const STALE_TEMP_TTL_MS = 60 * 60 * 1000;
const PREVIEW_TTL_MS = 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const CACHE_KEY_PATTERN = /^[a-f0-9]{64}$/;
const PREVIEW_CACHE_KEY_PATTERN = /^preview:[a-f0-9]{64}$/;
const CACHE_FILE_EXTENSIONS = [
  '.m4a',
  '.json',
  '.jpg',
  '.png',
  '.webp',
  '.gif',
];
const TEMPORARY_FILE_PATTERN = /\.(?:part|tmp|ytdl)$/i;

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
  /** Overrides the configured limit for this maintenance run. */
  maxGb?: number;
}

export interface CacheStorageEntry {
  key: string;
  size: number;
  mtimeMs: number;
  referenced: boolean;
}

export interface CacheStorageStatus {
  cacheBytes: number;
  limitBytes: number;
  freeBytes: number | null;
  minFreeBytes: number;
  isOverLimit: boolean;
  isLowDisk: boolean;
  safeCleanupBytes: number;
  safeCleanupFiles: number;
  evictionPlan: CacheStorageEntry[];
}

export interface CacheCleanupResult {
  removedFiles: number;
  freedBytes: number;
}

interface CacheEvictionEntry {
  file: string;
  key: string;
  mtimeMs: number;
  size: number;
  referenced: boolean;
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
  /** Inspect cached media without changing any files. */
  getStorageStatus(options?: CacheEvictionOptions): CacheStorageStatus;
  /** Remove only stale or unreferenced cache data. */
  cleanupSafe(options?: CacheEvictionOptions): Promise<CacheCleanupResult>;
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
    this.maxBytes = resolveCacheMaxGb(opts.maxGb) * 1024 * 1024 * 1024;
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

  getStorageStatus(options: CacheEvictionOptions = {}): CacheStorageStatus {
    const protectedKeys = options.protectedKeys ?? new Set<string>();
    const referencedKeys = options.referencedKeys ?? new Set<string>();
    ensureCacheDir(this.dir);

    const cacheBytes = this.getCacheBytes();
    const limitBytes = this.getMaxBytes(options.maxGb);
    const freeBytes = this.getFreeBytes();
    const safeCleanup = this.getFileTotals(
      this.getSafeCleanupPaths(options, Date.now()),
    );
    const evictionPlan = this.getEvictionEntries(
      protectedKeys,
      referencedKeys,
    ).map(({ key, size, mtimeMs, referenced }) => ({
      key,
      size,
      mtimeMs,
      referenced,
    }));

    return {
      cacheBytes,
      limitBytes,
      freeBytes,
      minFreeBytes: this.minFreeBytes,
      isOverLimit: cacheBytes > limitBytes,
      isLowDisk: freeBytes !== null && freeBytes < this.minFreeBytes,
      safeCleanupBytes: safeCleanup.freedBytes,
      safeCleanupFiles: safeCleanup.removedFiles,
      evictionPlan,
    };
  }

  async cleanupSafe(
    options: CacheEvictionOptions = {},
  ): Promise<CacheCleanupResult> {
    ensureCacheDir(this.dir);
    return this.removeFiles(this.getSafeCleanupPaths(options, Date.now()));
  }

  async evictOld(options: CacheEvictionOptions = {}): Promise<string[]> {
    const protectedKeys = options.protectedKeys ?? new Set<string>();
    const referencedKeys = options.referencedKeys ?? new Set<string>();
    ensureCacheDir(this.dir);
    const now = Date.now();
    this.removeStaleTempFiles(now);
    this.removeExpiredPreviews(now);
    const ttlMs = this.ttlDays * MS_PER_DAY;
    const maxBytes = this.getMaxBytes(options.maxGb);
    const evictedKeys: string[] = [];
    let totalBytes = this.getCacheBytes();
    const entries = this.getEvictionEntries(protectedKeys, referencedKeys);
    const capacityEntries: CacheEvictionEntry[] = [];

    for (const entry of entries) {
      // Expire only files no longer represented by the library. Library tracks
      // remain available until the cache needs to make room for new media.
      if (!entry.referenced && now - entry.mtimeMs > ttlMs) {
        unlinkSync(entry.file);
        this.removeSidecars(entry.key);
        totalBytes -= entry.size;
        evictedKeys.push(entry.key);
        continue;
      }
      capacityEntries.push(entry);
    }

    // If still over the cap, evict least-recently-used (oldest mtime) first.
    if (totalBytes > maxBytes || !this.hasEnoughFreeSpace()) {
      for (const e of capacityEntries) {
        if (totalBytes <= maxBytes && this.hasEnoughFreeSpace()) break;
        unlinkSync(e.file);
        this.removeSidecars(e.key);
        totalBytes -= e.size;
        evictedKeys.push(e.key);
      }
    }

    return evictedKeys;
  }

  private hasEnoughFreeSpace(): boolean {
    const freeBytes = this.getFreeBytes();
    return freeBytes === null || freeBytes >= this.minFreeBytes;
  }

  private removeExpiredPreviews(now: number): CacheCleanupResult {
    const previewDir = join(this.dir, 'preview');
    if (!existsSync(previewDir)) return { removedFiles: 0, freedBytes: 0 };

    const result: CacheCleanupResult = { removedFiles: 0, freedBytes: 0 };

    for (const file of readdirSync(previewDir)) {
      const full = join(previewDir, file);
      try {
        const stats = statSync(full);
        if (stats.isFile() && now - stats.mtimeMs > PREVIEW_TTL_MS) {
          const removed = this.removeFiles([full]);
          result.removedFiles += removed.removedFiles;
          result.freedBytes += removed.freedBytes;

          if (file.endsWith('.m4a')) {
            const key = file.slice(0, -'.m4a'.length);
            if (CACHE_KEY_PATTERN.test(key)) {
              const sidecars = this.removeFiles(
                this.sidecarPaths(`preview:${key}`),
              );
              result.removedFiles += sidecars.removedFiles;
              result.freedBytes += sidecars.freedBytes;
            }
          }
        }
      } catch {
        // A concurrent preview may have removed or replaced this file.
      }
    }

    return result;
  }

  private removeStaleTempFiles(now: number): CacheCleanupResult {
    const result: CacheCleanupResult = { removedFiles: 0, freedBytes: 0 };
    for (const file of readdirSync(this.dir)) {
      if (!TEMPORARY_FILE_PATTERN.test(file)) continue;

      const full = join(this.dir, file);
      try {
        const stats = statSync(full);
        if (stats.isFile() && now - stats.mtimeMs > STALE_TEMP_TTL_MS) {
          const removed = this.removeFiles([full]);
          result.removedFiles += removed.removedFiles;
          result.freedBytes += removed.freedBytes;
        }
      } catch {
        // A concurrent download may have removed or replaced this fragment.
      }
    }

    return result;
  }

  /** Remove the meta + cover files that ride alongside an evicted audio file. */
  private removeSidecars(key: string): void {
    this.removeFiles(this.sidecarPaths(key));
  }

  private sidecarPaths(key: string): string[] {
    const meta = metaPath(this.dir, key);
    const paths = [meta];
    for (const ext of Object.keys(EXT_COVER_MIME)) {
      paths.push(join(this.dir, `${key}.${ext}`));
    }
    return paths;
  }

  private getCacheBytes(): number {
    let bytes = 0;
    let files: string[];
    try {
      files = readdirSync(this.dir);
    } catch {
      return 0;
    }
    const counted = new Set<string>();

    for (const file of files) {
      if (!file.endsWith('.m4a')) continue;
      const key = file.slice(0, -'.m4a'.length);
      for (const path of [
        audioPath(this.dir, key),
        ...this.sidecarPaths(key),
      ]) {
        if (counted.has(path)) continue;
        counted.add(path);
        try {
          const stats = statSync(path);
          if (stats.isFile()) bytes += stats.size;
        } catch {
          // A concurrent cache operation may have removed or replaced this file.
        }
      }
    }

    for (const file of files) {
      const full = join(this.dir, file);
      if (counted.has(full)) continue;
      try {
        const stats = statSync(full);
        if (
          stats.isFile() &&
          (this.previewCacheKeyFromFile(file) ||
            TEMPORARY_FILE_PATTERN.test(file))
        ) {
          bytes += stats.size;
        }
      } catch {
        // A concurrent cache operation may have removed or replaced this file.
      }
    }

    const previewDir = join(this.dir, 'preview');
    if (!existsSync(previewDir)) return bytes;
    let previewFiles: string[];
    try {
      previewFiles = readdirSync(previewDir);
    } catch {
      return bytes;
    }
    for (const file of previewFiles) {
      try {
        const stats = statSync(join(previewDir, file));
        if (stats.isFile()) bytes += stats.size;
      } catch {
        // A concurrent preview may have removed or replaced this file.
      }
    }
    return bytes;
  }

  private getMediaBytes(key: string): number {
    return this.getFileTotals([
      audioPath(this.dir, key),
      ...this.sidecarPaths(key),
    ]).freedBytes;
  }

  private previewCacheKeyFromFile(file: string): string | null {
    const extension = CACHE_FILE_EXTENSIONS.find((candidate) =>
      file.endsWith(candidate),
    );
    if (!extension) return null;
    const key = file.slice(0, -extension.length);
    return PREVIEW_CACHE_KEY_PATTERN.test(key) ? key : null;
  }

  private getMaxBytes(maxGb: number | undefined): number {
    return isValidCacheMaxGb(maxGb)
      ? maxGb * 1024 * 1024 * 1024
      : this.maxBytes;
  }

  private getFreeBytes(): number | null {
    try {
      const stats = statfsSync(this.dir);
      return stats.bavail * stats.bsize;
    } catch {
      // A cache cap still limits growth when filesystem statistics are absent.
      return null;
    }
  }

  private getSafeCleanupPaths(
    options: CacheEvictionOptions,
    now: number,
  ): string[] {
    const referencedKeys = options.referencedKeys ?? new Set<string>();
    const protectedKeys = options.protectedKeys ?? new Set<string>();
    const paths = new Set<string>();
    const orphanAudioKeys = new Set<string>();

    let files: string[];
    try {
      files = readdirSync(this.dir);
    } catch {
      return [];
    }

    for (const file of files) {
      const full = join(this.dir, file);
      try {
        const stats = statSync(full);
        if (!stats.isFile()) continue;
        if (
          TEMPORARY_FILE_PATTERN.test(file) &&
          now - stats.mtimeMs > STALE_TEMP_TTL_MS
        ) {
          paths.add(full);
          continue;
        }
        if (!file.endsWith('.m4a')) continue;
        const key = file.slice(0, -'.m4a'.length);
        if (
          CACHE_KEY_PATTERN.test(key) &&
          !referencedKeys.has(key) &&
          !protectedKeys.has(key)
        ) {
          orphanAudioKeys.add(key);
        }
      } catch {
        // A concurrent cache operation may have removed or replaced this file.
      }
    }

    for (const key of orphanAudioKeys) {
      for (const path of [
        audioPath(this.dir, key),
        ...this.sidecarPaths(key),
      ]) {
        paths.add(path);
      }
    }

    const previewDir = join(this.dir, 'preview');
    if (!existsSync(previewDir)) return [...paths];
    let previewFiles: string[];
    try {
      previewFiles = readdirSync(previewDir);
    } catch {
      return [...paths];
    }
    for (const file of previewFiles) {
      const full = join(previewDir, file);
      try {
        const stats = statSync(full);
        if (!stats.isFile() || now - stats.mtimeMs <= PREVIEW_TTL_MS) continue;
        paths.add(full);
        if (!file.endsWith('.m4a')) continue;
        const key = file.slice(0, -'.m4a'.length);
        if (!CACHE_KEY_PATTERN.test(key)) continue;
        for (const sidecar of this.sidecarPaths(`preview:${key}`)) {
          paths.add(sidecar);
        }
      } catch {
        // A concurrent preview may have removed or replaced this file.
      }
    }

    return [...paths];
  }

  private getEvictionEntries(
    protectedKeys: ReadonlySet<string>,
    referencedKeys: ReadonlySet<string>,
  ): CacheEvictionEntry[] {
    let files: string[];
    try {
      files = readdirSync(this.dir);
    } catch {
      return [];
    }

    const entries: CacheEvictionEntry[] = [];
    for (const file of files) {
      if (!file.endsWith('.m4a')) continue;
      const key = file.slice(0, -'.m4a'.length);
      if (protectedKeys.has(key)) continue;
      try {
        const stats = statSync(join(this.dir, file));
        if (!stats.isFile()) continue;
        entries.push({
          file: join(this.dir, file),
          key,
          mtimeMs: stats.mtimeMs,
          size: this.getMediaBytes(key),
          referenced: referencedKeys.has(key),
        });
      } catch {
        // A concurrent cache operation may have removed or replaced this file.
      }
    }

    entries.sort(
      (a, b) =>
        Number(a.referenced) - Number(b.referenced) || a.mtimeMs - b.mtimeMs,
    );
    return entries;
  }

  private getFileTotals(paths: readonly string[]): CacheCleanupResult {
    const result: CacheCleanupResult = { removedFiles: 0, freedBytes: 0 };
    for (const file of paths) {
      try {
        const stats = statSync(file);
        if (!stats.isFile()) continue;
        result.removedFiles++;
        result.freedBytes += stats.size;
      } catch {
        // A concurrent cache operation may have removed or replaced this file.
      }
    }
    return result;
  }

  private removeFiles(paths: readonly string[]): CacheCleanupResult {
    const result: CacheCleanupResult = { removedFiles: 0, freedBytes: 0 };
    for (const file of paths) {
      try {
        const stats = statSync(file);
        if (!stats.isFile()) continue;
        unlinkSync(file);
        result.removedFiles++;
        result.freedBytes += stats.size;
      } catch {
        // A concurrent operation may have removed or replaced this file.
      }
    }
    return result;
  }
}
