# TikPlay — TODO

## Việc cần chủ dự án xử lý sau

Hướng dẫn chi tiết: [`docs/auth-environment-setup-guide.md`](docs/auth-environment-setup-guide.md).

### 1. PostgreSQL

- [ ] Chọn nhà cung cấp PostgreSQL: Neon, Supabase hoặc Fly Postgres.
- [ ] Tạo database production.
- [ ] Lưu connection string vào secret `DATABASE_URL`.
- [ ] Chạy toàn bộ migration trong [`drizzle/`](drizzle/).
- [ ] Chạy thử legacy JSON migration ở chế độ dry-run.
- [ ] Chạy legacy JSON migration thật sau khi kiểm tra kết quả dry-run.
- [ ] Xác nhận migration idempotent và không tạo dữ liệu trùng.
- [ ] Thiết lập backup và kiểm tra restore database.

### 2. Better Auth

- [ ] Sinh `BETTER_AUTH_SECRET` bằng `openssl rand -hex 32`.
- [ ] Lưu `BETTER_AUTH_SECRET` trong secret manager, không commit vào Git.
- [ ] Đặt `BETTER_AUTH_URL` đúng domain production, không có dấu `/` cuối.
- [ ] Kiểm tra trusted origins cho local, staging và production.
- [ ] Xác nhận cookie session hoạt động trên HTTPS production.

### 3. Đăng nhập bằng email magic link

- [ ] Tạo tài khoản Resend.
- [ ] Thêm domain gửi email vào Resend.
- [ ] Cấu hình các DNS record SPF/DKIM theo hướng dẫn của Resend.
- [ ] Chờ domain đạt trạng thái Verified.
- [ ] Tạo `RESEND_API_KEY` với quyền tối thiểu cần thiết.
- [ ] Cấu hình `AUTH_EMAIL_FROM`, ví dụ `TikPlay <noreply@example.com>`.
- [ ] Bật `FLAG_AUTH_ENABLED=true`.
- [ ] Bật `FLAG_AUTH_MAGIC_LINK=true`.
- [ ] Test gửi magic link tới email thật.
- [ ] Test trường hợp email không tồn tại, link hết hạn và link đã sử dụng.
- [ ] Kiểm tra email trong inbox và spam.

> Hiện tại ứng dụng hỗ trợ magic link qua email, chưa hỗ trợ email + mật khẩu. Cấu hình [`emailAndPassword`](lib/auth/server.ts:32) vẫn đang tắt.

### 4. Google OAuth

- [ ] Tạo hoặc chọn Google Cloud project.
- [ ] Cấu hình OAuth consent screen.
- [ ] Thêm scopes tối thiểu: `openid`, `email`, `profile`.
- [ ] Tạo OAuth Client loại Web application.
- [ ] Thêm origin local và production.
- [ ] Thêm callback URL local: `http://localhost:3000/api/auth/callback/google`.
- [ ] Thêm callback URL production: `https://YOUR_DOMAIN/api/auth/callback/google`.
- [ ] Lưu `GOOGLE_CLIENT_ID` trong secret manager.
- [ ] Lưu `GOOGLE_CLIENT_SECRET` trong secret manager.
- [ ] Bật `FLAG_AUTH_GOOGLE=true`.
- [ ] Test đăng nhập Google trên staging trước production.

### 5. Feature flags và rollout

- [ ] Bật auth trước cho internal/staging.
- [ ] Bật `FLAG_AUTH_IMPORT=true` sau khi guest import được kiểm tra.
- [ ] Bật `FLAG_AUTH_ACCOUNT_PAGES=true` sau khi profile/session UI được kiểm tra.
- [ ] Bật `FLAG_AUTH_PRIVACY=true` sau khi export và deletion flow được kiểm tra.
- [ ] Bật `FLAG_PERSONALIZATION=true` sau khi có đủ listening data.
- [ ] Chỉ bật `FLAG_ADMIN_NEW_BOUNDARY=true` sau khi admin session flow ổn định.
- [ ] Chuẩn bị kill switch và kiểm tra degraded mode trước public rollout.

### 6. Fly.io / production secrets

- [ ] Đăng nhập Fly CLI.
- [ ] Cấu hình các secret bằng `fly secrets set`, không ghi secret vào [`fly.toml`](fly.toml).
- [ ] Kiểm tra danh sách secret bằng `fly secrets list`.
- [ ] Deploy staging hoặc canary.
- [ ] Kiểm tra log bằng `fly logs`.
- [ ] Xác nhận volume `/app/cache` được mount và dữ liệu tồn tại sau restart.
- [ ] Xác nhận health check production hoạt động.

### 7. Verification trước khi mở public

- [ ] Chạy `npm run format`.
- [ ] Chạy `npm run lint` và đánh giá các warning còn lại.
- [ ] Chạy `npx tsc --noEmit`.
- [ ] Chạy `npm run build`.
- [ ] Chạy toàn bộ script tests.
- [ ] Chạy toàn bộ Playwright E2E với PostgreSQL test database.
- [ ] Xác nhận ba E2E test trước đây bị skip đã chạy với đầy đủ secrets.
- [ ] Test two-user isolation trên môi trường staging thật.
- [ ] Test revoke session và logout các thiết bị khác.
- [ ] Test export dữ liệu và account deletion end-to-end.
- [ ] Test rollback theo [`docs/rollback-procedure.md`](docs/rollback-procedure.md).

### 8. CI/CD và vận hành

- [ ] Thiết lập GitHub Actions cho format/lint/typecheck/build/tests.
- [ ] Thiết lập migration gate trước deployment.
- [ ] Thiết lập deploy staging trước production.
- [ ] Thiết lập telemetry, dashboard và alert cần thiết.
- [ ] Thiết lập lịch purge listening events.
- [ ] Thiết lập lịch purge các account đã yêu cầu xóa.
- [ ] Xác định người chịu trách nhiệm xử lý incident và rollback.
- [ ] Rotate các secret theo lịch và ngay khi nghi ngờ bị lộ.

### 9. Dọn dẹp sau rollout

- [ ] Theo dõi lỗi auth, email delivery và OAuth callback.
- [ ] Xử lý dần các Biome lint warnings còn tồn tại.
- [ ] Chỉ retire JSON writes sau khi PostgreSQL cutover ổn định và được phê duyệt.
- [ ] Không xóa JSON data cũ trước khi backup và reconciliation hoàn tất.
- [ ] Cập nhật và đóng các GitHub issues #10–#37 sau khi production verification đạt yêu cầu.
