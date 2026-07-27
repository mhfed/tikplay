import { execFile } from 'node:child_process';
import { isTikTokProfileUrl } from './source';

export interface ProfileScanResult {
  profile: {
    username: string;
    url: string;
  };
  items: ProfileTrackItem[];
  totalCount: number;
}

export interface ProfileTrackItem {
  id: string;
  url: string;
  title: string;
  author: string;
  duration: number; // in seconds
  thumbnail: string;
  viewCount?: number;
}

interface CacheEntry {
  result: ProfileScanResult;
  expiresAt: number;
}

export class ProfileScanner {
  private ytdlpPath: string;
  private cache = new Map<string, CacheEntry>();

  constructor(ytdlpPath?: string) {
    this.ytdlpPath = ytdlpPath ?? process.env.YTDLP_PATH ?? 'yt-dlp';
  }

  async scanTikTok(url: string): Promise<ProfileScanResult> {
    if (!isTikTokProfileUrl(url)) {
      throw new Error('URL TikTok profile không hợp lệ');
    }

    const _url = new URL(url);
    // Chuẩn hóa url để cache key đúng, loại bỏ query params và fragments
    _url.search = '';
    _url.hash = '';
    const normalizedUrl = _url.toString();

    // Check cache (TTL = 5 minutes)
    const cached = this.cache.get(normalizedUrl);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    const result = await this.executeScan(normalizedUrl);

    // Save to cache
    this.cache.set(normalizedUrl, {
      result,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    // Dọn dẹp cache cũ
    this.cleanupCache();

    return result;
  }

  private executeScan(url: string): Promise<ProfileScanResult> {
    return new Promise((resolve, reject) => {
      // Dùng --flat-playlist để lấy list nhanh nhất, KHÔNG tải video/metadata chi tiết
      // Dùng --dump-json để lấy dữ liệu json
      const args = [
        '--flat-playlist',
        '--dump-json',
        '--ignore-errors',
        '--no-warnings',
        '--playlist-end',
        '50',
        '--js-runtimes',
        'deno:/usr/local/bin/deno',
        '--add-header',
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        url,
      ];

      execFile(
        this.ytdlpPath,
        args,
        { maxBuffer: 100 * 1024 * 1024 }, // Có thể nhiều dòng JSON
        (err, stdout, stderr) => {
          // Bỏ qua err code nếu yt-dlp trả về thông tin thành công dù có một số lỗi (--ignore-errors cho phép điều này)
          // Lỗi thật sự khi stdout rỗng.

          if (!stdout || stdout.trim().length === 0) {
            reject(
              new Error(
                stderr ||
                  err?.message ||
                  'Không thể quét profile. Profile có thể riêng tư hoặc không tồn tại.',
              ),
            );
            return;
          }

          try {
            const lines = stdout.trim().split('\n');
            const items: ProfileTrackItem[] = [];

            // Extract username from url (e.g. /@username)
            const parsedUrl = new URL(url);
            const pathname = parsedUrl.pathname.replace(/\/+$/, '');
            const username = pathname.replace(/^\/@/, '');

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const item = JSON.parse(line);
                items.push({
                  id: item.id || '',
                  url: item.url || '',
                  title: item.title || 'Không rõ tiêu đề',
                  author:
                    item.uploader ||
                    item.creator ||
                    item.channel ||
                    username ||
                    'Không rõ',
                  duration:
                    typeof item.duration === 'number' ? item.duration : 0,
                  thumbnail: item.thumbnail || '',
                  viewCount: item.view_count,
                });
              } catch (_e) {
                // Bỏ qua dòng lỗi parse JSON
              }
            }

            if (items.length === 0) {
              reject(new Error('Không tìm thấy video nào trong profile này'));
              return;
            }

            resolve({
              profile: {
                username,
                url,
              },
              items,
              totalCount: items.length,
            });
          } catch (_error) {
            reject(new Error('Lỗi khi phân tích dữ liệu profile'));
          }
        },
      );
    });
  }

  private cleanupCache() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }
}
