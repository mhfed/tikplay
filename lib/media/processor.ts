import { execFile } from 'child_process';
import { join } from 'path';
import {
  cacheKeyFromRaw,
  validateTikTokUrl,
} from '../tiktok/validate';
import {
  FileCacheStore,
  getCacheDir,
  ensureCacheDir,
} from '../cache';

export interface TrackMeta {
  title: string;
  author: string;
  cover: string;
  /** Duration in seconds. */
  duration: number;
}

export interface ProcessResult {
  audioKey: string;
  meta: TrackMeta;
}

/**
 * Wraps `yt-dlp` + `ffmpeg` (called internally by yt-dlp) to download and
 * extract the best available audio from a TikTok URL, caching the result on
 * disk. This is the single module that would change if we later move to a job
 * queue (BullMQ) or cloud storage (R2/S3).
 */
export class MediaProcessor {
  private ytdlpPath: string;
  private cache: FileCacheStore;
  /** In-flight jobs keyed by cacheKey so concurrent identical URLs share one. */
  private inFlight = new Map<string, Promise<ProcessResult>>();

  constructor(cache?: FileCacheStore, ytdlpPath?: string) {
    this.ytdlpPath = ytdlpPath ?? process.env.YTDLP_PATH ?? 'yt-dlp';
    this.cache = cache ?? new FileCacheStore();
  }

  /**
   * Validate, debounce and process a TikTok URL. Concurrent calls with the
   * same cacheKey resolve to the same underlying job.
   */
  async process(rawUrl: string): Promise<ProcessResult> {
    const validation = validateTikTokUrl(rawUrl);
    if (!validation.valid || !validation.normalized) {
      throw new Error(validation.error ?? 'URL không hợp lệ');
    }

    const key = cacheKeyFromRaw(rawUrl);
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const job = this.run(validation.normalized, key).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, job);
    return job;
  }

  private async run(url: string, key: string): Promise<ProcessResult> {
    const meta = await this.fetchMetadata(url);

    const cacheDir = getCacheDir();
    ensureCacheDir(cacheDir);
    const outputTemplate = join(cacheDir, `${key}.m4a`);

    await this.execYtDlp([
      '-f',
      'download', // TikTok only ships the real audio track inside the combined
      // "download" format (high-res variants are video-only), so we grab that
      // and let ffmpeg extract the audio. Watermark is irrelevant for audio.
      '--extract-audio',
      '--audio-format',
      'm4a',
      '--audio-quality',
      '0', // keep source quality, no re-encode down
      url,
      '-o',
      outputTemplate,
    ]);

    // Persist metadata so the API can serve it from cache without re-running.
    await this.cache.saveMeta(key, meta);

    return { audioKey: key, meta };
  }

  /** Run `yt-dlp --dump-json` and map the response to our TrackMeta shape. */
  private async fetchMetadata(url: string): Promise<TrackMeta> {
    const out = await this.execYtDlp(['--dump-json', url]);
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(out);
    } catch {
      throw new Error('Không thể đọc metadata từ TikTok');
    }

    const str = (v: unknown): string =>
      typeof v === 'string' ? v : '';

    return {
      title: str(json.title) || 'Không rõ tiêu đề',
      author:
        str(json.uploader) ||
        str(json.creator) ||
        str(json.channel) ||
        'Không rõ tác giả',
      cover: str(json.thumbnail),
      duration: typeof json.duration === 'number' ? json.duration : 0,
    };
  }

  /** Promise wrapper around execFile for yt-dlp. */
  private execYtDlp(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        this.ytdlpPath,
        args,
        { maxBuffer: 50 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err) {
            reject(
              new Error(
                `yt-dlp thất bại: ${(stderr || err.message).slice(0, 500)}`,
              ),
            );
            return;
          }
          resolve(stdout);
        },
      );
    });
  }
}
