# craw-music — TikTok Music Player (Backend)

Website phát nhạc từ URL TikTok: dán link → hệ thống tải & extract audio chất
lượng tốt nhất TikTok cung cấp → lưu cache → phát trên trình player.

Dự án Next.js (App Router, TypeScript) làm cả frontend lẫn API. Phần backend
(validate URL, cache, media processor, API routes) nằm ở thư mục `lib/` và
`app/api/`.

## Yêu cầu hệ thống

- **Node.js 18/20+**
- **ffmpeg** — dùng để tách audio (yt-dlp gọi nội bộ)
- **yt-dlp** — tải metadata + audio từ TikTok

> ⚠️ Lưu ý pháp lý: tải & phát lại nội dung TikTok có thể vi phạm bản quyền và
> Điều khoản dịch vụ của TikTok tuỳ khu vực. Chỉ dùng cho mục đích cá nhân /
> thử nghiệm. Spec thuần tuý kỹ thuật; người dùng chịu trách nhiệm tuân thủ luật.

## Chạy local

1. Cài ffmpeg:
   ```bash
   # macOS
   brew install ffmpeg
   # Ubuntu / Debian
   sudo apt-get install -y ffmpeg
   ```
2. Cài yt-dlp **kèm `curl_cffi`** (bắt buộc — TikTok hiện yêu cầu impersonation,
   thiếu `curl_cffi` sẽ báo `Requested format is not available`):
   ```bash
   pip install yt-dlp curl_cffi
   # hoặc trong một venv:
   # python3 -m venv .venv && .venv/bin/pip install yt-dlp curl_cffi
   # rồi set YTDLP_PATH=.venv/bin/yt-dlp
   ```
   Kiểm tra: `yt-dlp --version` phải chạy được và không báo
   `impersonate target is not available`.
3. Cài dependencies & chạy dev:
   ```bash
   npm install
   npm run dev
   ```
4. Mở http://localhost:3000

## Biến môi trường

| Biến             | Mặc định     | Ý nghĩa                                              |
| ---------------- | ------------ | ---------------------------------------------------- |
| `CACHE_DIR`      | `./cache`    | Thư mục lưu file audio đã xử lý. Cần ổ đĩa bền.      |
| `CACHE_TTL_DAYS` | `7`          | Xoá file cũ hơn số ngày này.                         |
| `CACHE_MAX_GB`   | `5`          | Khi tổng dung lượng vượt mức, xoá theo LRU.          |
| `YTDLP_PATH`     | `yt-dlp`     | Đường dẫn binary yt-dlp (phải có `curl_cffi` để impersonate TikTok). |

Ví dụ:
```bash
export CACHE_DIR=/data/cache
export CACHE_TTL_DAYS=7
export CACHE_MAX_GB=5
export YTDLP_PATH=yt-dlp
npm run dev
```

## API

### `POST /api/process`
Body: `{ "url": "https://www.tiktok.com/@user/video/123" }`

- 200: `{ "ok": true, "data": { "audioUrl": "/api/audio/<key>", "title", "author", "cover", "duration" } }`
- 400: `{ "ok": false, "error": "..." }`

Các request trùng URL (cùng cacheKey) được gộp chung một job (debounce) để
không chạy yt-dlp nhiều lần.

### `GET /api/audio/[key]`
Stream file audio `.m4a` (Content-Type `audio/mp4`). 404 nếu thiếu.

## Docker

```bash
docker build -t craw-music .
docker run -d --name craw-music \
  -p 3000:3000 \
  -v craw-cache:/app/cache \
  craw-music
```

Hoặc dùng `docker-compose`:
```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - cache:/app/cache
    environment:
      - CACHE_TTL_DAYS=7
      - CACHE_MAX_GB=5
volumes:
  cache:
```

## Triển khai (Deployment)

Deploy trên host có **ổ đĩa bền** và chạy được binary: **Railway / Render /
Fly.io / Docker VPS**. Mount volume cho thư mục cache (`CACHE_DIR`).

**Không dùng Vercel serverless** cho MVP: filesystem read-only, timeout ngắn,
và khó chạy binary yt-dlp/ffmpeg. Có thể cân nhắc sau này nếu tách riêng worker.

### Fly.io (khuyên dùng — có volume free 3GB, hỗ trợ ổ đĩa bền cho cache)

1. Cài Fly CLI: `brew install flyctl` (hoặc xem https://fly.io/docs/hands-on/install/).
2. Đăng nhập: `fly auth login`.
3. (Tùy chọn) Đổi tên app trong `fly.toml` (`app = "..."`) cho unique.
4. Tạo volume cho cache (chỉ làm 1 lần):
   ```bash
   fly volumes create craw_cache --region sin --size 3
   ```
5. Deploy:
   ```bash
   fly deploy
   ```
6. Mở app: `fly open` (hoặc `fly apps open`).

Lưu ý:
- App cấu hình **auto-stop khi rảnh** để tiết kiến free allowance; request đầu
  sau khi wake sẽ chậm ~20–30s (đang tải lại + xử lý TikTok).
- Volume `craw_cache` gắn tại `/app/cache` → cache audio **bền**, không mất khi
  restart (quan trọng vì mỗi lần xử lý TikTok tốn thời gian tải).
- yt-dlp nằm trong image; để luôn mới chạy `fly ssh console` rồi `yt-dlp -U`,
  hoặc thêm cron trong container.
- Free tier: 3 máy 256MB-shared + 3GB volume. Nếu cần RAM hơn, sửa `memory`
  trong `fly.toml` (tốn thêm trong giới hạn tài khoản).

Để yt-dlp luôn mới (TikTok hay đổi API), chạy định kỳ:
```bash
yt-dlp -U
```
Trong container có thể thêm cron hoặc chạy trong startup script.

## Cấu trúc code (backend)

```
lib/
  tiktok/validate.ts     # validate + normalize URL, cacheKey = sha256(url)
  cache/index.ts         # FileCacheStore: get/set/evictOld (TTL + LRU)
  media/processor.ts     # MediaProcessor: yt-dlp + ffmpeg, debounce
app/api/process/route.ts # POST: nhận URL → cache/process → JSON
app/api/audio/[key]/route.ts # GET: stream file audio
```

Thiết kế tách module: sau này đổi sang Redis + BullMQ (Hướng B) hoặc
R2/S3 + CDN (Hướng C) chỉ cần thay implementation của `CacheStore` /
`MediaProcessor` mà không đổi code gọi.
