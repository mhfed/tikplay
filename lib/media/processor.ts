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
  
  /** Concurrency queue to avoid freezing the system with 10x concurrent FFmpeg encodings */
  private queue: Array<() => void> = [];
  private activeJobs = 0;
  private readonly MAX_CONCURRENT = 2; // Process 2 tracks at most simultaneously

  constructor(cache?: FileCacheStore, ytdlpPath?: string) {
    this.ytdlpPath = ytdlpPath ?? process.env.YTDLP_PATH ?? 'yt-dlp';
    this.cache = cache ?? new FileCacheStore();
  }

  /** Request a slot in the concurrency queue */
  private async acquireSlot(): Promise<void> {
    if (this.activeJobs < this.MAX_CONCURRENT) {
      this.activeJobs++;
      return;
    }
    return new Promise(resolve => this.queue.push(resolve));
  }

  /** Release a slot back to the queue */
  private releaseSlot(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.(); // Transfer the slot to the waiting job
    } else {
      this.activeJobs--;
    }
  }

  /**
   * Validate, debounce and process a TikTok URL. Concurrent calls with the
   * same cacheKey resolve to the same underlying job.
   * Throttles active processing to prevent CPU overload from parallel yt-dlp/ffmpeg tasks.
   */
  async process(rawUrl: string): Promise<ProcessResult> {
    const validation = validateTikTokUrl(rawUrl);
    if (!validation.valid || !validation.normalized) {
      throw new Error(validation.error ?? 'URL không hợp lệ');
    }

    const key = cacheKeyFromRaw(rawUrl);
    
    // Quick dedup check before awaiting a queue slot
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    await this.acquireSlot();

    // Check again in case another identical request squeezed through the queue
    if (this.inFlight.has(key)) {
      this.releaseSlot();
      return this.inFlight.get(key)!;
    }

    const job = this.run(validation.normalized, key).finally(() => {
      this.inFlight.delete(key);
      this.releaseSlot();
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
        // TikTok's format list often *claims* acodec: aac on its high-quality
        // bytevc1/h265 muxed formats, but the actual file served for some
        // videos/regions is video-only — ffprobe then finds no audio stream
        // and yt-dlp's ExtractAudio postprocessor hard-fails. TikTok's own
        // "download" format (the watermarked one meant for saving the video)
        // reliably muxes real audio, so prefer it; audio quality is the same
        // regardless of which video codec/watermark it's paired with, and we
        // only keep the extracted audio anyway.
        'download/bestaudio*/best',
        // Without this, yt-dlp sees a same-named file already on disk (e.g.
        // left over from a prior failed attempt) and skips straight to
        // postprocessing it instead of redownloading — silently reusing a
        // stale/bad intermediate file forever.
        '--force-overwrites',
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
    // cache/route so playback UI can hotlink it indefinitely. If the
    // download fails (or returns a CDN blocking black image), clear it
    // so the UI falls back to the generated gradient immediately instead
    // of rendering a black box when the signed URL expires.
    if (cover) {
      await this.cache.saveCover(key, cover.buffer, cover.contentType);
      meta.cover = `/api/cover/${key}`;
    } else {
      meta.cover = '';
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
      
      // TikTok CDN may return a 3.2KB black image when hotlink-blocked
      if (buffer.length < 4000) return null;
      
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

  /**
   * TikTok intermittently serves an anti-bot page with no
   * `__UNIVERSAL_DATA_FOR_REHYDRATION__` blob (more so without curl_cffi
   * impersonation), and its CDN throws transient 5xx / timeouts. These are
   * flaky, not fatal — a retry with a fresh request usually succeeds. Genuine
   * errors (bad URL, private/deleted video) don't match and fail fast.
   */
  private static isTransient(msg: string): boolean {
    return /rehydration|Unable to extract|Requested format is not available|Unable to download webpage|HTTP Error [45]\d\d|timed out|Connection reset|Read timed out|Unexpected response/i.test(
      msg,
    );
  }

  /**
   * Promise wrapper around execFile for yt-dlp, retrying transient TikTok
   * failures a few times with a short backoff.
   */
  private execYtDlp(args: string[], attempts = 3): Promise<string> {
    const defaultArgs = [
      '--add-header', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '--add-header', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      '--add-header', 'Accept-Language: en-US,en;q=0.9',
      '--add-header', 'Sec-Fetch-Mode: navigate'
    ];
    const finalArgs = [...defaultArgs, ...args];

    const attempt = (n: number): Promise<string> =>
      new Promise<string>((resolve, reject) => {
        execFile(
          this.ytdlpPath,
          finalArgs,
          { maxBuffer: 50 * 1024 * 1024 },
          (err, stdout, stderr) => {
            if (err) {
              const msg = stderr || err.message;
              if (n < attempts && MediaProcessor.isTransient(msg)) {
                // Linear backoff (400ms, 800ms, …) between tries.
                setTimeout(() => resolve(attempt(n + 1)), 400 * n);
                return;
              }
              reject(new Error(`yt-dlp thất bại: ${msg.slice(0, 500)}`));
              return;
            }
            resolve(stdout);
          },
        );
      });
    return attempt(1);
  }
}
