import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { ensureCacheDir, FileCacheStore, getCacheDir } from '../cache';
import { cacheKeyFromRaw, validateTikTokUrl } from '../tiktok/validate';

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

    const [, cover] = await Promise.all([
      this.execYtDlp([
        '-f',
        'bestaudio*/best',
        '--extract-audio',
        '--audio-format',
        'm4a',
        '--audio-quality',
        '0', // best encoder quality (loudnorm forces a re-encode anyway)
        // Normalize loudness (EBU R128) so every track plays at the same, hot
        // level: -9 LUFS integrated, -1 dBTP ceiling. Applied in the same
        // ffmpeg pass that extracts the audio.
        '--postprocessor-args',
        'ExtractAudio:-c:a aac -af loudnorm=I=-9:TP=-1:LRA=11',
        url,
        '-o',
        outputTemplate,
      ]),
      this.downloadCover(meta.cover),
    ]);

    // TikTok's cover URL is signed and expires; re-host it under our own
    // cache/route so playback UI can hotlink it indefinitely. Best-effort —
    // if the download fails, leave meta.cover as the raw (eventually-dead)
    // TikTok URL rather than failing the whole crawl.
    if (cover) {
      await this.cache.saveCover(key, cover.buffer, cover.contentType);
      meta.cover = `/api/cover/${key}`;
    }

    // Persist metadata so the API can serve it from cache without re-running.
    await this.cache.saveMeta(key, meta);

    return { audioKey: key, meta };
  }

  /** Best-effort fetch of the TikTok cover image; TikTok gates the CDN on Referer. */
  private async downloadCover(
    url: string,
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    if (!url) return null;
    try {
      const res = await fetch(url, {
        headers: {
          Referer: 'https://www.tiktok.com/',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const buffer = Buffer.from(await res.arrayBuffer());
      return { buffer, contentType };
    } catch {
      return null;
    }
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

    const str = (v: unknown): string => (typeof v === 'string' ? v : '');

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
