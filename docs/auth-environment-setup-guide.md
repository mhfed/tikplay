# Hướng dẫn lấy và cấu hình các key xác thực TikPlay

Tài liệu này hướng dẫn lấy các biến môi trường cần thiết để bật đăng nhập bằng email (magic link), Google OAuth và PostgreSQL cho TikPlay.

> **Quan trọng:** Không commit các secret vào Git, không gửi secret qua chat công khai, và không ghi secret trực tiếp vào [`fly.toml`](../fly.toml) hoặc file frontend.

---

## 1. Các biến môi trường cần có

### Bắt buộc cho production

| Biến                 | Dùng cho                | Lấy ở đâu                        |
| -------------------- | ----------------------- | -------------------------------- |
| `DATABASE_URL`       | Kết nối PostgreSQL      | Neon, Supabase hoặc Fly Postgres |
| `BETTER_AUTH_SECRET` | Ký và mã hóa session    | Tự sinh bằng OpenSSL             |
| `BETTER_AUTH_URL`    | URL public của ứng dụng | Domain production của bạn        |
| `RESEND_API_KEY`     | Gửi magic link          | Resend                           |
| `AUTH_EMAIL_FROM`    | Địa chỉ gửi email       | Domain đã verify trên Resend     |

### Tùy chọn cho Google OAuth

| Biến                   | Dùng cho                  | Lấy ở đâu            |
| ---------------------- | ------------------------- | -------------------- |
| `GOOGLE_CLIENT_ID`     | Nhận diện ứng dụng OAuth  | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Secret của ứng dụng OAuth | Google Cloud Console |

### Feature flags

| Biến                      | Giá trị đề xuất | Tác dụng                               |
| ------------------------- | --------------: | -------------------------------------- |
| `FLAG_AUTH_ENABLED`       |          `true` | Bật giao diện xác thực                 |
| `FLAG_AUTH_MAGIC_LINK`    |          `true` | Bật đăng nhập qua email                |
| `FLAG_AUTH_GOOGLE`        |          `true` | Bật Google OAuth                       |
| `FLAG_AUTH_IMPORT`        |          `true` | Bật import dữ liệu guest sau đăng nhập |
| `FLAG_AUTH_ACCOUNT_PAGES` |          `true` | Bật các trang tài khoản                |
| `FLAG_AUTH_PRIVACY`       |          `true` | Bật export/xóa dữ liệu                 |
| `FLAG_PERSONALIZATION`    |          `true` | Bật trang cá nhân hóa                  |

Các flag được đọc trong [`lib/feature-flags.ts`](../lib/feature-flags.ts:32). Nên bật từng nhóm theo rollout, không bật toàn bộ ngay lần đầu deploy.

---

## 2. Tạo PostgreSQL và lấy `DATABASE_URL`

Ứng dụng lưu user, session, playlist, favorite và dữ liệu cá nhân trong PostgreSQL.

### Cách A: Neon

1. Truy cập [Neon Console](https://console.neon.tech/).
2. Đăng nhập hoặc tạo tài khoản.
3. Chọn **Create project**.
4. Đặt tên project, ví dụ `tikplay`.
5. Chọn region gần người dùng, ví dụ Singapore nếu có.
6. Mở **Dashboard** hoặc **Connect**.
7. Chọn driver PostgreSQL/Node.js.
8. Copy connection string dạng:

```text
postgresql://user:password@ep-example.ap-southeast-1.aws.neon.tech/tikplay?sslmode=require
```

9. Lưu giá trị đó vào `DATABASE_URL`.

### Cách B: Supabase

1. Truy cập [Supabase Dashboard](https://supabase.com/dashboard).
2. Chọn **New project**.
3. Đặt tên project và database password.
4. Mở **Project Settings → Database**.
5. Trong phần **Connection string**, chọn **URI**.
6. Copy URI và thay phần placeholder password bằng password database thật.
7. Dùng pooler connection nếu môi trường serverless yêu cầu.

Ví dụ:

```text
postgresql://postgres.PROJECT_REF:password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

### Chạy migration

Sau khi có `DATABASE_URL`, chạy từ thư mục project:

```bash
export DATABASE_URL='postgresql://...'
npx drizzle-kit migrate
```

Nếu migration command của project không nhận database URL, kiểm tra cấu hình tại [`drizzle.config.ts`](../drizzle.config.ts:1), sau đó chạy các migration SQL trong thư mục [`drizzle/`](../drizzle/).

Không chạy migration production bằng user chỉ có quyền đọc.

---

## 3. Tạo `BETTER_AUTH_SECRET`

Đây là secret dùng bởi Better Auth để bảo vệ authentication/session. Không dùng mật khẩu cá nhân hoặc chuỗi ngắn.

### macOS/Linux

```bash
openssl rand -hex 32
```

Kết quả sẽ tương tự:

```text
8d3f...64-hex-characters...
```

Dùng toàn bộ kết quả làm `BETTER_AUTH_SECRET`.

### Windows PowerShell

```powershell
[Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Có thể dùng password manager hoặc secret manager để lưu secret này. Nếu thay secret sau khi production chạy, các session hiện tại có thể bị vô hiệu hóa.

---

## 4. Xác định `BETTER_AUTH_URL`

Đây là URL public của TikPlay, không có dấu `/` cuối.

### Local

```env
BETTER_AUTH_URL=http://localhost:3000
```

### Production

```env
BETTER_AUTH_URL=https://music.example.com
```

URL này phải khớp domain mà người dùng truy cập. Nếu deploy trên Fly.io và chưa có custom domain, có thể dùng:

```env
BETTER_AUTH_URL=https://craw-music.fly.dev
```

Cấu hình runtime và trusted origins được xử lý trong [`lib/auth/config.ts`](../lib/auth/config.ts:95).

---

## 5. Tạo `RESEND_API_KEY` để gửi magic link

Magic link hiện dùng Resend qua [`lib/auth/mailer.ts`](../lib/auth/mailer.ts:38).

1. Truy cập [Resend](https://resend.com/).
2. Tạo tài khoản hoặc đăng nhập.
3. Mở **API Keys**.
4. Chọn **Create API Key**.
5. Đặt tên, ví dụ `tikplay-production`.
6. Chọn quyền tối thiểu cần thiết để gửi email.
7. Copy key ngay sau khi tạo — Resend thường chỉ hiển thị đầy đủ một lần.
8. Lưu vào `RESEND_API_KEY`.

Ví dụ:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
```

Nếu key bị lộ, revoke ngay trong Resend rồi tạo key mới.

---

## 6. Cấu hình `AUTH_EMAIL_FROM`

`AUTH_EMAIL_FROM` là địa chỉ xuất hiện ở trường From của email magic link. Domain gửi email nên được verify trên Resend.

### Verify domain trên Resend

1. Trong Resend, mở **Domains**.
2. Chọn **Add Domain**.
3. Nhập domain bạn sở hữu, ví dụ `example.com`.
4. Resend hiển thị các bản ghi DNS cần thêm.
5. Mở DNS provider của domain (Cloudflare, Namecheap, GoDaddy...).
6. Thêm đầy đủ các record SPF/DKIM theo Resend.
7. Quay lại Resend và chọn **Verify DNS Records**.
8. Chờ trạng thái domain chuyển sang **Verified**.

Sau khi verify, cấu hình:

```env
AUTH_EMAIL_FROM=TikPlay <noreply@example.com>
```

Địa chỉ `noreply@example.com` phải thuộc domain đã verify. Không nên dùng địa chỉ giả từ domain chưa verify vì email có thể bị từ chối hoặc vào spam.

> Trong code, [`lib/auth/mailer.ts`](../lib/auth/mailer.ts:65) yêu cầu `apiKey` và `from`; giá trị `from` được lấy từ cấu hình auth runtime.

---

## 7. Tạo Google OAuth keys (tùy chọn)

Chỉ cần làm phần này nếu muốn đăng nhập bằng Google.

### Tạo OAuth Client

1. Mở [Google Cloud Console](https://console.cloud.google.com/).
2. Tạo project mới hoặc chọn project hiện có.
3. Vào **APIs & Services → OAuth consent screen**.
4. Chọn loại **External** nếu người dùng không nằm trong Google Workspace của bạn.
5. Điền app name, email hỗ trợ và developer contact.
6. Thêm scope tối thiểu:
   - `openid`
   - `email`
   - `profile`
7. Nếu app ở chế độ testing, thêm email test users.
8. Vào **APIs & Services → Credentials**.
9. Chọn **Create Credentials → OAuth client ID**.
10. Chọn application type **Web application**.
11. Thêm Authorized JavaScript origins:

```text
http://localhost:3000
https://your-production-domain.com
```

12. Thêm Authorized redirect URI theo callback URL mà Better Auth sử dụng:

```text
http://localhost:3000/api/auth/callback/google
https://your-production-domain.com/api/auth/callback/google
```

13. Chọn **Create**.
14. Copy **Client ID** vào `GOOGLE_CLIENT_ID`.
15. Copy **Client secret** vào `GOOGLE_CLIENT_SECRET`.

Better Auth đọc hai giá trị này trong [`lib/auth/server.ts`](../lib/auth/server.ts:33).

> Nếu Google trả lỗi `redirect_uri_mismatch`, kiểm tra chính xác protocol, domain, port và path callback. Không thêm slash cuối nếu URI đã đăng ký không có slash.

---

## 8. File `.env.local` cho local development

Tạo file `.env.local` ở root project. File này không được commit.

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/tikplay?sslmode=require

# Better Auth
BETTER_AUTH_SECRET=thay-bang-chuoi-64-ky-tu
BETTER_AUTH_URL=http://localhost:3000

# Resend magic link
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
AUTH_EMAIL_FROM=TikPlay <noreply@example.com>

# Google OAuth (optional)
GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx

# Rollout flags
FLAG_AUTH_ENABLED=true
FLAG_AUTH_MAGIC_LINK=true
FLAG_AUTH_GOOGLE=true
FLAG_AUTH_IMPORT=true
FLAG_AUTH_ACCOUNT_PAGES=true
FLAG_AUTH_PRIVACY=true
FLAG_PERSONALIZATION=true
```

Sau đó khởi động lại dev server:

```bash
npm run dev
```

Không dùng `NEXT_PUBLIC_` cho các biến secret như `DATABASE_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY` hoặc `GOOGLE_CLIENT_SECRET`.

---

## 9. Cấu hình secret trên Fly.io

Không đưa secret vào [`fly.toml`](../fly.toml:1). Dùng Fly secrets:

```bash
fly auth login
fly apps list
fly secrets set \
  DATABASE_URL='postgresql://...' \
  BETTER_AUTH_SECRET='...' \
  BETTER_AUTH_URL='https://your-domain.com' \
  RESEND_API_KEY='re_...' \
  AUTH_EMAIL_FROM='TikPlay <noreply@example.com>' \
  GOOGLE_CLIENT_ID='...' \
  GOOGLE_CLIENT_SECRET='...'
```

Bật feature flags:

```bash
fly secrets set \
  FLAG_AUTH_ENABLED='true' \
  FLAG_AUTH_MAGIC_LINK='true' \
  FLAG_AUTH_GOOGLE='true' \
  FLAG_AUTH_IMPORT='true' \
  FLAG_AUTH_ACCOUNT_PAGES='true' \
  FLAG_AUTH_PRIVACY='true' \
  FLAG_PERSONALIZATION='true'
```

Kiểm tra tên secret mà không in giá trị secret:

```bash
fly secrets list
```

Deploy:

```bash
fly deploy
```

Xem log sau deploy:

```bash
fly logs
```

---

## 10. Kiểm tra sau khi cấu hình

### Kiểm tra cơ bản

```bash
npx tsc --noEmit
npm run build
```

### Kiểm tra luồng magic link

1. Mở app production.
2. Chọn đăng nhập.
3. Nhập email thật có thể nhận mail.
4. Kiểm tra inbox và spam.
5. Bấm link trong vòng 15 phút.
6. Xác nhận app hiển thị user đã đăng nhập.
7. Mở trang account và kiểm tra session.

### Kiểm tra lỗi thường gặp

| Lỗi                                          | Nguyên nhân thường gặp                           | Cách xử lý                                  |
| -------------------------------------------- | ------------------------------------------------ | ------------------------------------------- |
| `The authentication email could not be sent` | Resend key sai hoặc domain chưa verify           | Kiểm tra Resend API key/domain/from address |
| `Magic-link authentication requires...`      | Thiếu Resend config                              | Thêm `RESEND_API_KEY` và `AUTH_EMAIL_FROM`  |
| `redirect_uri_mismatch`                      | Callback URL Google không khớp                   | Đăng ký đúng `/api/auth/callback/google`    |
| Database connection error                    | `DATABASE_URL` sai hoặc DB chưa cho phép kết nối | Kiểm tra URL, SSL và network policy         |
| Session không tồn tại                        | Cookie domain/HTTPS hoặc `BETTER_AUTH_URL` sai   | Kiểm tra domain, HTTPS và restart app       |
| Email không đến                              | Domain chưa verify hoặc email vào spam           | Verify DNS, kiểm tra sender và spam folder  |

---

## 11. Checklist deploy

- [ ] Đã tạo PostgreSQL production.
- [ ] Đã chạy các migration trong [`drizzle/`](../drizzle/).
- [ ] Đã tạo `BETTER_AUTH_SECRET` ngẫu nhiên.
- [ ] `BETTER_AUTH_URL` trỏ đúng domain production.
- [ ] Resend domain đã verified.
- [ ] `AUTH_EMAIL_FROM` dùng domain verified.
- [ ] Đã tạo và lưu `RESEND_API_KEY`.
- [ ] Google OAuth redirect URI đã đăng ký nếu dùng Google.
- [ ] Secrets đã lưu bằng `fly secrets set` hoặc secret manager.
- [ ] Không có secret trong Git hoặc client bundle.
- [ ] Đã test magic link end-to-end.
- [ ] Đã kiểm tra revoke secret procedure.
- [ ] Đã giữ feature flags ở rollout stage phù hợp.

---

## 12. Quy tắc bảo mật

1. Không commit `.env.local`.
2. Không dùng `NEXT_PUBLIC_` cho secret.
3. Không paste `DATABASE_URL`, `BETTER_AUTH_SECRET`, API keys vào issue hoặc log.
4. Dùng secret khác nhau cho local, staging và production.
5. Rotate key ngay khi nghi ngờ bị lộ.
6. Giới hạn quyền của database user và Resend API key.
7. Chỉ bật Google OAuth sau khi kiểm tra redirect URI production.
8. Trước khi bật public rollout, kiểm tra migration, backup và rollback procedure trong [`docs/rollback-procedure.md`](rollback-procedure.md:1).
