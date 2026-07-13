# Thiết kế: Website phát nhạc từ URL TikTok (clone audio chất lượng tốt nhất)

- **Ngày:** 2026-07-13
- **Tác giả:** brainstorm với user
- **Trạng thái:** Đã chốt thiết kế, chuyển sang implement

## 1. Mục tiêu & Tầm vực

Xây dựng website **công khai, ẩn danh** (không cần đăng ký): người dùng dán URL TikTok →
hệ thống tải & extract audio chất lượng tốt nhất TikTok cung cấp → lưu cache → phát nhạc
trên một trình player đầy đủ tính năng (playlist, hàng đợi, lịch sử, tìm kiếm).

### Giới hạn "chất lượng max" (thực tế kỹ thuật)
- TikTok **không lưu audio gốc lossless**. Audio thường bị re-encode về **~128kbps AAC**,
  thỉnh thoảng bản nhạc gốc upload cao hơn một chút.
- "Chất lượng max" = lấy **stream audio có bitrate cao nhất TikTok phục vụ cho video đó**,
  rồi extract bằng ffmpeg **giữ nguyên chất lượng nguồn** (`--audio-quality 0`).
  **Không thể upscale** vượt quá chất lượng TikTok có.
- Luôn kèm metadata: `title`, `uploader/author`, `thumbnail` (ảnh bìa), `duration`.

### Lưu ý pháp lý (quan trọng)
- Tải & phát lại nội dung TikTok có thể vi phạm **bản quyền** và **Điều khoản dịch vụ (ToS)
  của TikTok**, tuỳ khu vực pháp lý.
- Khuyến nghị: (a) chỉ dùng cho mục đích cá nhân/thử nghiệm; (b) thêm thông báo "nội dung
  thuộc bản quyền chủ sở hữu, dùng để học tập"; (c) hỗ trợ cơ chế gỡ xuống (takedown) nếu
  triển khai công khai; (d) không thương mại hoá trái phép.
- Spec này thuần tuý trình bày kỹ thuật; user chịu trách nhiệm tuân thủ luật hiện hành.

## 2. Cách tiếp cận đã chọn

- **Công nghệ:** Next.js (App Router, TypeScript) làm cả frontend + API.
- **Lấy audio:** thư viện **yt-dlp** (tự host, chạy qua child process) + **ffmpeg** extract.
- **Cache:** **Hướng A (MVP)** — filesystem local, tự dọn theo TTL/LRU; nhưng thiết kế tách
  module để sau này dễ nâng lên **Hướng B (Redis + BullMQ job queue)** hoặc **Hướng C
  (Cloudflare R2 / S3 + CDN)** mà không đổi code gọi.
- **Playlist / lịch sử:** lưu trong `localStorage` trình duyệt (web ẩn danh, không cần DB).

## 3. Kiến trúc tổng quan

```
[User] ──dán URL──► [Next.js Frontend]
                         │ POST /api/process {url}
                         ▼
                   [Next.js API Route]
                         │
            ┌────────────┴─────────────┐
            ▼                          ▼
      [Cache Store]              [Media Processor]
    (lib/cache, fs)            (lib/media: yt-dlp+ffmpeg)
            │                          │
            └──────────┬───────────────┘
                       ▼
                 [Trả file audio + metadata]
                       │
                       ▼
              [Player phát, thêm vào playlist]
```

### Module & ranh giới
- **`lib/media/`** — `MediaProcessor`: bọc yt-dlp + ffmpeg. Điểm duy nhất cần đổi khi nâng
  cấp queue/cloud. API: `process(url): Promise<{audioPath, meta}>`.
- **`lib/cache/`** — interface `get(key)`, `set(key, file)`, `evictOld()`. Hiện filesystem,
  sau này swap R2/S3 không đổi chỗ gọi.
- **`lib/tiktok/`** — validate URL, chuẩn hoá (bỏ query param thừa), `cacheKey = sha256(url)`.
- **`app/api/process/route.ts`** — nhận URL, gọi cache → processor → trả JSON.
- **Frontend** — input, player, playlist, history, search (state trong localStorage).

## 4. Luồng xử lý (Data Flow)

1. User dán URL → frontend gọi `POST /api/process { url }`.
2. API validate + tính `cacheKey = sha256(normalizedUrl)`.
3. `cache.get(cacheKey)`:
   - **Có** → trả URL file audio ngay (phát từ cache).
   - **Chưa** → kiểm tra có job đang chạy cho key này không:
     - Đang chạy → chờ kết quả chung (debounce, tránh chạy yt-dlp trùng).
     - Chưa → chạy Media Processor.
4. Media Processor: `yt-dlp --dump-json` lấy metadata; `yt-dlp -f bestaudio
   --extract-audio --audio-format m4a --audio-quality 0` lấy audio; ffmpeg tách `-vn`
   nếu cần. Lưu `{cacheKey}.m4a` vào cache.
5. Trả `{ audioUrl, title, author, cover, duration }`.
6. Frontend thêm vào playlist, phát.

## 5. Pipeline chi tiết (yt-dlp + ffmpeg)

- Metadata: `yt-dlp --dump-json <url>` → parse `title`, `uploader`, `thumbnail`, `duration`.
- Audio (giữ chất lượng nguồn):
  ```
  yt-dlp -f "bestaudio" --extract-audio --audio-format m4a \
         --audio-quality 0 <url> -o <cacheKey>.m4a
  ```
- Nếu TikTok chỉ có stream kết hợp → ffmpeg tự tách audio (`-vn`).
- Output `.m4a` (AAC) phát native trên trình duyệt, nhẹ. Tuỳ chọn thêm `.mp3` để tương thích.

## 6. Cache & dọn rác

- Thư mục `./cache` (trên volume bền), file `{sha256(url)}.m4a`.
- **TTL:** file > 7 ngày → xoá (cron mỗi giờ hoặc dọn khi khởi động).
- **Giới hạn dung lượng:** tổng > 5GB → xoá theo LRU.
- Interface tách biệt → đổi sang R2/S3 sau này không ảnh hưởng code gọi.

## 7. Frontend (player đầy đủ)

- **Input:** ô dán URL TikTok, nút "Phát"/"Thêm vào playlist".
- **Player:** ảnh bìa, tiêu đề, tác giả, thanh tiến độ, âm lượng, play/pause, next/prev.
- **Playlist:** danh sách các bài đã dán, phát tuần tự, xáo trộn (shuffle), lặp (repeat).
- **Lịch sử:** các URL đã xử lý (localStorage).
- **Tìm kiếm:** lọc trong playlist/lịch sử theo tiêu đề/tác giả.
- State: `localStorage` key `tiktok-player:playlist` & `:history`.

## 8. Xử lý lỗi & trường hợp đặc biệt

- URL không phải TikTok → báo lỗi rõ ràng.
- Video bị xoá / riêng tư / bị chặn vùng → yt-dlp lỗi → trả message thân thiện.
- TikTok đổi API → yt-dlp fail → log + gợi ý `yt-dlp -U` (tự động update trong container).
- Timeout xử lý (video dài) → job timeout, user thử lại.
- Trùng URL đang xử lý → debounce chờ chung.
- File cache hỏng → xoá & thử tải lại.

## 9. Testing

- **Unit:** `lib/tiktok` (validate/normalize), `lib/cache` (get/set/evict mock fs).
- **Integration:** API route với URL TikTok mẫu (có thể mock yt-dlp bằng fixture).
- **E2E (Playwright):** dán URL → nhận audioUrl → player phát được.
- **Manual:** 5 URL TikTok khác nhau (video thường, sounds gốc, video dài, private).

## 10. Triển khai (Deployment)

- **MVP:** host có ổ đĩa bền & chạy được binary: **Railway / Render / Fly.io / Docker VPS**.
  Cài sẵn `yt-dlp` + `ffmpeg` (Dockerfile: `apt install ffmpeg`, `pip install yt-dlp`,
  chạy `yt-dlp -U` định kỳ). Mount volume cho `./cache`.
- **Không dùng Vercel serverless** cho MVP (filesystem read-only, timeout ngắn, khó chạy
  binary). Có thể dùng sau này nếu tách processor ra worker riêng.
- Env: `CACHE_DIR`, `CACHE_TTL_DAYS`, `CACHE_MAX_GB`, `YTDLP_PATH`.

## 11. Lộ trình nâng cấp (sau MVP)

1. **Hướng B:** Redis + BullMQ → chịu tải, retry, progress bar.
2. **Hướng C:** R2/S3 cache + CDN → scale, bền vững.
3. Tính năng: tải xuống (download), chia sẻ link, chuyển đổi định dạng.
