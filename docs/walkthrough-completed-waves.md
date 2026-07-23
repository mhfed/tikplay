# TikPlay — Walkthrough: Multi-user Authentication & Personal Data System

> **Trạng thái:** ✅ Hoàn thành tất cả 6 Waves (Issues #10–#37)
> **Ngày hoàn thành:** 2026-07-23

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Kiến trúc tổng thể](#2-kiến-trúc-tổng-thể)
3. [Wave 0 — P0 Security Blockers (#10–#12)](#3-wave-0--p0-security-blockers-10-12)
4. [Wave 1 — Compatibility Spike & Schema (#13–#14)](#4-wave-1--compatibility-spike--schema-13-14)
5. [Wave 2 — Auth/Session Foundation (#15–#17)](#5-wave-2--authsession-foundation-15-17)
6. [Wave 3 — Repositories, Migration & Personal APIs (#18–#24)](#6-wave-3--repositories-migration--personal-apis-18-24)
7. [Wave 4 — Auth/Account/Personalization UX (#25–#31)](#7-wave-4--authaccountpersonalization-ux-25-31)
8. [Wave 5 — Quality, Security & Rollout (#32–#37)](#8-wave-5--quality-security--rollout-32-37)
9. [Danh sách file đã tạo](#9-danh-sách-file-đã-tạo)
10. [Kết quả verification](#10-kết-quả-verification)
11. [Sơ đồ dependency](#11-sơ-đồ-dependency)

---

## 1. Tổng quan

**TikPlay** là một Next.js App Router music player cho phép người dùng tìm kiếm, phát và quản lý nhạc từ TikTok. Dự án ban đầu sử dụng JSON file (`data/tikplay.json`) làm persistence layer, single-user, không có authentication.

Mục tiêu của toàn bộ workstream là **multi-user authentication**, **personal data management**, **authorization**, và **UX** — triển khai qua 6 Waves với tổng cộng **28 issues** (#10–#37).

### Công nghệ chính

| Thành phần         | Công nghệ                           |
| ------------------ | ----------------------------------- |
| Framework          | Next.js 16 App Router               |
| Auth               | Better Auth (Drizzle adapter)       |
| Database           | PostgreSQL qua Drizzle ORM          |
| Legacy persistence | JSON file (`data/tikplay.json`)     |
| Testing            | Playwright E2E, Vitest script tests |
| Linting/Format     | Biome                               |
| Background         | Telemetry, Feature Flags            |

---

## 2. Kiến trúc tổng thể

```
┌──────────────────────────────────────────────┐
│                 Next.js App                   │
│  ┌─────────────┐  ┌──────────────────────┐   │
│  │  Route Layer │  │   Client Components  │   │
│  │  (API routes)│  │  (Auth UX, Account)  │   │
│  └──────┬──────┘  └──────────┬───────────┘   │
│         │                    │                │
│  ┌──────▼────────────────────▼───────────┐   │
│  │         lib/ (Server Logic)           │   │
│  │  ┌────────┐ ┌──────────┐ ┌────────┐  │   │
│  │  │ Auth   │ │ Catalog  │ │Personal│  │   │
│  │  │ Server │ │ (dual    │ │ (PG)   │  │   │
│  │  │        │ │  backend)│ │        │  │   │
│  │  └────────┘ └──────────┘ └────────┘  │   │
│  │  ┌────────┐ ┌──────────┐ ┌────────┐  │   │
│  │  │Telemetry│ │Feature   │ │DB      │  │   │
│  │  │        │ │Flags     │ │(JSON+PG)│  │   │
│  │  └────────┘ └──────────┘ └────────┘  │   │
│  └──────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

### Data flow pattern

1. **Catalog routes** (`/api/tracks`, `/api/categories`, `/api/sources`): Thử PostgreSQL trước → fallback JSON DB nếu `DATABASE_URL` không được cấu hình
2. **Personal routes** (`/api/favorites`, `/api/playlists`, `/api/profile`, ...): Yêu cầu PostgreSQL + session hợp lệ
3. **Auth routes** (`/api/auth/[...all]`): Better Auth handles magic link, Google OAuth, session management
4. **Legacy mutation routes** (`POST/PATCH/DELETE /api/tracks`): Yêu cầu admin bearer token hoặc session

---

## 3. Wave 0 — P0 Security Blockers (#10–#12)

### Vấn đề

Ba lỗ hổng bảo mật nghiêm trọng ngăn cản việc deploy multi-user auth:

- **RB-01**: Admin authentication dùng static bearer/header token (`lib/adminAuth.ts`)
- **RB-02**: YouTube cookies endpoint (`/api/admin/youtube-cookies`) không được bảo vệ
- **RB-03**: Destructive health endpoint (`POST /api/tracks/health`) đang public

### Giải pháp

| Issue | File                                                                               | Mô tả                                                                                           |
| ----- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| #10   | [`lib/adminAuth.ts`](lib/adminAuth.ts)                                             | `isAdminRequest()` kiểm tra bearer token; `isAdminSessionRequest()` kiểm tra session admin role |
| #11   | [`app/api/admin/youtube-cookies/route.ts`](app/api/admin/youtube-cookies/route.ts) | Thêm `isAdminRequest()` guard cho cả GET và POST                                                |
| #12   | [`app/api/tracks/health/route.ts`](app/api/tracks/health/route.ts)                 | `POST /api/tracks/health` yêu cầu admin auth                                                    |

### Test

- [`e2e/admin-route-security.spec.ts`](e2e/admin-route-security.spec.ts) — 8 tests (5 active, 3 skip khi không có DATABASE_URL):
  - `rejects anonymous global track POST/PATCH/DELETE`
  - **`keeps the global track catalog public`** — đảm bảo catalog vẫn public dù Postgres không available (JSON DB fallback)
  - `rejects anonymous YouTube cookie reads and writes`
  - `rejects invalid authorized track mutations safely`
  - `rejects invalid cookie payload without echoing secrets`
  - `operational bearer requests do not require a browser Origin`

---

## 4. Wave 1 — Compatibility Spike & Schema (#13–#14)

### Compatibility Spike (#13)

Investigate và chốt công nghệ cho auth system.

**Kết luận:** Chọn **Better Auth** + **Drizzle ORM** + **node-postgres (`pg`)**.

Lý do:

- Better Auth có sẵn Drizzle adapter, magic link, Google OAuth, session management
- Drizzle ORM nhẹ, type-safe, phù hợp Next.js server component
- `pg` là driver PostgreSQL phổ biến nhất, tương thích Drizzle

Link: [`docs/auth-compatibility-spike.md`](docs/auth-compatibility-spike.md)

### Schema & Migration (#14)

- [`lib/db/postgres/schema.ts`](lib/db/postgres/schema.ts) — Toàn bộ schema PostgreSQL (~630 dòng):
  - **Auth tables**: `users`, `accounts`, `sessions`, `verifications`
  - **User tables**: `userPreferences`, `guestImports`, `authAuditEvents`
  - **Catalog tables**: `tracks`, `userLibraryTracks`, `favorites`
  - **Playlist tables**: `playlists`, `playlistTracks`
  - **Operational tables**: `autoRules`, `listeningEvents`, `dataMigrations`, `copyrightReports`, `blockedMedia`
- [`drizzle/0000_rare_terror.sql`](drizzle/0000_rare_terror.sql) — Migration khởi tạo
- [`drizzle.config.ts`](drizzle.config.ts) — Drizzle kit config

Link: [`docs/auth-foundation-plan.md`](docs/auth-foundation-plan.md)

---

## 5. Wave 2 — Auth/Session Foundation (#15–#17)

### Better Auth Server (#15)

- [`lib/auth/server.ts`](lib/auth/server.ts) — `defineAuth()` function cấu hình Better Auth với:
  - Drizzle adapter (PostgreSQL)
  - Magic link authentication (qua Resend)
  - Google OAuth provider
  - Session cookie management
  - Custom session hooks
- [`lib/auth/config.ts`](lib/auth/config.ts) — `readAuthRuntimeConfig()` đọc và validate tất cả env vars cần thiết:
  - `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - `RESEND_API_KEY`, `RESEND_FROM`
  - Trusted origins parsing, return path normalization
- [`lib/auth/mailer.ts`](lib/auth/mailer.ts) — Magic link email template + Resend integration

### Session & Authorization (#16)

- [`lib/auth/session.ts`](lib/auth/session.ts) — Server-side session helpers:
  - `getOptionalSession()` — lấy session nếu có (không throw)
  - `requireSession()` — yêu cầu session, trả về 401 nếu thiếu
  - `requireRole()` — kiểm tra role (admin)
  - `authErrorResponse()` — standardized error response
  - `privateJson()` — response wrapper cho private endpoints
- [`lib/auth/session-management.ts`](lib/auth/session-management.ts) — Session lifecycle:
  - `listOwnedSessions()` — danh sách sessions của user
  - `revokeOwnedSession()` — thu hồi một session
  - `revokeOtherOwnedSessions()` — thu hồi tất cả session trừ session hiện tại
  - `logoutCurrentSession()` — logout

### Client Auth (#17)

- [`lib/auth/client.ts`](lib/auth/client.ts) — `createAuthClient()`:
  - Dùng trong client components
  - Expose `signIn`, `signUp`, `signOut` methods (Better Auth client)

Key files: [`lib/auth/index.ts`](lib/auth/index.ts) — barrel exports

---

## 6. Wave 3 — Repositories, Migration & Personal APIs (#18–#24)

### Repository Layer (#18)

- [`lib/db/postgres/repositories.ts`](lib/db/postgres/repositories.ts) — Repository pattern chia thành các module:
  - **`catalogRepository`**: `list()`, `search()`, `listByIds()`, `listCategories()`, `listByCategory()`, `listSources()`, `listBySource()`, `findById()`
  - **`libraryRepository`**: `list()`, `setSaved()` — quản lý thư viện user
  - **`favoritesRepository`**: `list()`, `set()` — quản lý yêu thích
  - **`playlistsRepository`**: `listOwned()`, `create()`, `rename()`, `remove()`, `reorder()`, `listTracks()`, `addTrack()`, `removeTrack()`, `reorderTracks()` — CRUD playlist + track management
  - **`autoRulesRepository`**: `list()`, `create()`, `remove()` — auto-rule management
  - **`preferencesRepository`**: `get()`, `update()` — user preferences
  - **`listeningRepository`**: `record()`, `clear()`, `purgeExpired()`, `recent()`, `stats()` — listening history
  - **`favoriteTrackIds()`**: batch favorite check utility
- [`lib/db/postgres/client.ts`](lib/db/postgres/client.ts) — Connection pool singleton, `createRuntime()`, `closePostgres()`

### Dual-backend catalog API (#18)

- [`lib/api/catalog.ts`](lib/api/catalog.ts) — Shared catalog utilities:
  - `toCatalogTrack()` — Postgres → response shape
  - `toCatalogTrackFromDbRow()` — JSON DB → response shape
  - `hasDatabaseUrl()` — runtime Postgres availability check
  - `getJsonCatalog()` — JSON DB fallback reader
  - `publicCatalogJson()`, `publicCatalogError()` — response helpers

### Migration Tooling (#19)

- [`scripts/legacy-json-core.ts`](scripts/legacy-json-core.ts) — Core migration logic đọc từ JSON DB
- [`scripts/migrate-legacy-json.ts`](scripts/migrate-legacy-json.ts) — CLI migration script
- [`drizzle/0001_legacy_json_migration.sql`](drizzle/0001_legacy_json_migration.sql) — `dataMigrations` tracking table
- [`scripts/legacy-json-core.test.ts`](scripts/legacy-json-core.test.ts) — Unit tests
- [`scripts/legacy-json-contract.test.ts`](scripts/legacy-json-contract.test.ts) — Contract tests
- [`docs/legacy-json-migration.md`](docs/legacy-json-migration.md) — Migration plan

### Public Catalog APIs (#20)

Các route catalog sử dụng **dual-backend pattern**: thử PostgreSQL trước, fallback sang JSON DB:

| Route           | File                                                         | Endpoint                      |
| --------------- | ------------------------------------------------------------ | ----------------------------- |
| /api/tracks     | [`app/api/tracks/route.ts`](app/api/tracks/route.ts)         | `GET` search/list/batch-by-id |
| /api/categories | [`app/api/categories/route.ts`](app/api/categories/route.ts) | `GET` list/by-slug            |
| /api/sources    | [`app/api/sources/route.ts`](app/api/sources/route.ts)       | `GET` list/by-source          |

### Personal Data APIs (#21–#24)

Tất cả personal routes yêu cầu `requireSession()` và dùng repositories:

| Issue | Route                      | File                                                                               | Tính năng                       |
| ----- | -------------------------- | ---------------------------------------------------------------------------------- | ------------------------------- |
| #21   | /api/playlists             | [`app/api/playlists/route.ts`](app/api/playlists/route.ts)                         | CRUD playlists + ownership      |
| #21   | /api/playlists/[id]/tracks | [`app/api/playlists/[id]/tracks/route.ts`](app/api/playlists/[id]/tracks/route.ts) | Track management trong playlist |
| #21   | /api/auto-rules            | [`app/api/auto-rules/route.ts`](app/api/auto-rules/route.ts)                       | Auto-rule CRUD                  |
| #22   | /api/library/tracks        | [`app/api/library/tracks/route.ts`](app/api/library/tracks/route.ts)               | Saved tracks                    |
| #22   | /api/favorites             | [`app/api/favorites/route.ts`](app/api/favorites/route.ts)                         | Favorite tracks                 |
| #22   | /api/tracks/play           | [`app/api/tracks/play/route.ts`](app/api/tracks/play/route.ts)                     | Listening events                |
| #22   | /api/tracks/stats          | [`app/api/tracks/stats/route.ts`](app/api/tracks/stats/route.ts)                   | Thống kê nghe                   |
| #23   | /api/import/preview        | [`app/api/import/preview/route.ts`](app/api/import/preview/route.ts)               | Guest import preview            |
| #23   | /api/import/commit         | [`app/api/import/commit/route.ts`](app/api/import/commit/route.ts)                 | Guest import commit             |
| #23   | /api/import/status/[id]    | [`app/api/import/status/[id]/route.ts`](app/api/import/status/[id]/route.ts)       | Import status                   |
| #24   | /api/profile               | [`app/api/profile/route.ts`](app/api/profile/route.ts)                             | Profile CRUD                    |
| #24   | /api/preferences           | [`app/api/preferences/route.ts`](app/api/preferences/route.ts)                     | User preferences                |
| #24   | /api/privacy/export        | [`app/api/privacy/export/route.ts`](app/api/privacy/export/route.ts)               | Data export                     |
| #24   | /api/privacy/deletion      | [`app/api/privacy/deletion/route.ts`](app/api/privacy/deletion/route.ts)           | Account deletion                |
| #24   | /api/privacy/history       | [`app/api/privacy/history/route.ts`](app/api/privacy/history/route.ts)             | Listening history privacy       |
| #24   | /api/privacy/sessions      | [`app/api/privacy/sessions/route.ts`](app/api/privacy/sessions/route.ts)           | Session management privacy      |

### Supporting files (#20)

- [`lib/api/personal.ts`](lib/api/personal.ts) — Helpers: `isUuid()`, `requireAuthAndBody()`, error responses
- [`drizzle/0002_guest_import_api.sql`](drizzle/0002_guest_import_api.sql) — Guest import tables
- [`drizzle/0003_privacy_deletion.sql`](drizzle/0003_privacy_deletion.sql) — Privacy & deletion tables
- [`lib/db/postgres/guest-import-repository.ts`](lib/db/postgres/guest-import-repository.ts) — Guest import DB operations
- [`lib/db/postgres/guest-import.ts`](lib/db/postgres/guest-import.ts) — Guest import business logic
- [`lib/db/postgres/privacy-repository.ts`](lib/db/postgres/privacy-repository.ts) — Privacy/export DB operations
- `scripts/purge-deleted-users.ts` — Cleanup script
- `scripts/purge-listening-events.ts` — Retention cleanup

### Tests

- [`scripts/wave3-api-contract.test.ts`](scripts/wave3-api-contract.test.ts) — 5 tests

---

## 7. Wave 4 — Auth/Account/Personalization UX (#25–#31)

### Auth Providers (#25–#27)

Three provider components form the auth UX backbone:

```
App Root
  └─ AuthSessionProvider     — Session context, user state, loading/error
       └─ AuthFlowProvider   — Auth state machine (sign-in, sign-up, guest import offer)
            └─ AuthSurfaceHost — Modal/sheet rendering for auth flows
```

| File                                                                                 | Component             | Chức năng                                                           |
| ------------------------------------------------------------------------------------ | --------------------- | ------------------------------------------------------------------- |
| [`components/auth/AuthSessionProvider.tsx`](components/auth/AuthSessionProvider.tsx) | `AuthSessionProvider` | Session context, polling, user state, protected action handling     |
| [`components/auth/AuthFlowProvider.tsx`](components/auth/AuthFlowProvider.tsx)       | `AuthFlowProvider`    | Auth state machine: guest, authenticating, importing, authenticated |
| [`components/auth/AuthSurfaceHost.tsx`](components/auth/AuthSurfaceHost.tsx)         | `AuthSurfaceHost`     | Auth modal/sheet với backdrop, keyboard support (Escape)            |

### Guest Import UX (#28)

| File                                                                           | Component         | Chức năng                                                           |
| ------------------------------------------------------------------------------ | ----------------- | ------------------------------------------------------------------- |
| [`components/guest/GuestImportFlow.tsx`](components/guest/GuestImportFlow.tsx) | `GuestImportFlow` | Preview → confirm → progress → done; handle conflicts, retry, defer |

### Account Shell & Routes (#29–#30)

| File                                                                               | Component/Route        | Chức năng                                                                                          |
| ---------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------- |
| [`components/account/AccountShell.tsx`](components/account/AccountShell.tsx)       | `AccountShell`         | Account layout với sidebar navigation (Profile, Preferences, Sessions, Privacy)                    |
| [`components/account/AccountForms.tsx`](components/account/AccountForms.tsx)       | `AccountForms`         | Profile form (name, email, avatar) + Preferences form (language, personalization opt-out, quality) |
| [`components/account/SessionsPrivacy.tsx`](components/account/SessionsPrivacy.tsx) | `SessionsPrivacy`      | Session list + revoke; Privacy section (export data, delete account)                               |
| [`app/account/profile/page.tsx`](app/account/profile/page.tsx)                     | `/account/profile`     | Profile page                                                                                       |
| [`app/account/preferences/page.tsx`](app/account/preferences/page.tsx)             | `/account/preferences` | Preferences page                                                                                   |
| [`app/account/sessions/page.tsx`](app/account/sessions/page.tsx)                   | `/account/sessions`    | Sessions management                                                                                |
| [`app/account/privacy/page.tsx`](app/account/privacy/page.tsx)                     | `/account/privacy`     | Privacy/data management                                                                            |

### Personalized Home (#31)

| File                                                                           | Component          | Chức năng                                                                        |
| ------------------------------------------------------------------------------ | ------------------ | -------------------------------------------------------------------------------- |
| [`components/home/PersonalizedHome.tsx`](components/home/PersonalizedHome.tsx) | `PersonalizedHome` | Home module framework: reason codes, opt-out handling, "insufficient data" state |

### Ranking engine

- [`lib/personalization/ranking.ts`](lib/personalization/ranking.ts) — `computeRankingSignals()`, `tracksByAffinity()` — xếp hạng tracks dựa trên listening history

### Tests

- [`scripts/wave4-personalization-contract.test.ts`](scripts/wave4-personalization-contract.test.ts) — 2 tests
- [`scripts/guest-import-contract.test.ts`](scripts/guest-import-contract.test.ts) — 5 tests
- [`scripts/guest-import.test.ts`](scripts/guest-import.test.ts) — 5 tests
- [`scripts/privacy-contract.test.ts`](scripts/privacy-contract.test.ts) — 4 tests
- [`scripts/personalization-ranking.test.ts`](scripts/personalization-ranking.test.ts) — 6 tests

Link: [`docs/auth-ux-plan.md`](docs/auth-ux-plan.md)

---

## 8. Wave 5 — Quality, Security & Rollout (#32–#37)

### Test Hooks (#32)

- [`lib/auth/test-hooks.ts`](lib/auth/test-hooks.ts) — Test utilities: `createTestUser()`, `createTestSession()`, `cleanupTestUser()`
- [`scripts/test-hooks-production-guard.test.ts`](scripts/test-hooks-production-guard.test.ts) — Guard test: test hooks không được import ở production
- [`scripts/register-server-only-stub.cjs`](scripts/register-server-only-stub.cjs) — Stub cho `server-only` package khi test
- [`scripts/server-only-stub.cjs`](scripts/server-only-stub.cjs) — Server-only mock

### Security Regression (#33)

- [`scripts/security-regression.test.ts`](scripts/security-regression.test.ts) — 6 tests:
  - Admin route access denied cho anonymous
  - Auth required cho personal endpoints
  - Admin role check
  - Session token validation
  - Cross-user data isolation

### Two-User Isolation (#34)

- [`scripts/two-user-isolation.test.ts`](scripts/two-user-isolation.test.ts) — 8 tests:
  - User A/B không thể nhìn thấy favorites, library, playlists, auto-rules, profile, preferences, listening history của nhau
  - Admin không thể impersonate user data

### Migration Rehearsal (#35)

- [`scripts/migration-rehearsal.test.ts`](scripts/migration-rehearsal.test.ts) — 5 tests:
  - Dry-run mode
  - Import thành công
  - Import idempotent
  - Import tracking
  - No duplicate import

### Telemetry (#36)

- [`lib/telemetry/index.ts`](lib/telemetry/index.ts) — Telemetry system:
  - 30+ event kinds (đăng nhập, import, playlist CRUD, playback, privacy...)
  - Logger interface: `logEvent(event)`, `queryUserEvents(userId)`, `queryByKind(kind)`
  - Audit trail cho bảo mật
  - Severity levels

### Feature Flags & CI Gates (#37)

- [`lib/feature-flags.ts`](lib/feature-flags.ts) — Rollout feature flags:
  - Kill switch: `disableMultiUser()`, `isDegradedMode()`
  - Stage progression: `ENABLE_GUEST_SIGNUP`, `ENABLE_ACCOUNT_PAGES`, `ENABLE_ADMIN_REQUIRES_SESSION`
  - Gating: `requireFlag()`, `gateMiddleware()`

### Docs & Ops

| File                                                                       | Nội dung                                     |
| -------------------------------------------------------------------------- | -------------------------------------------- |
| [`docs/ops-runbook.md`](docs/ops-runbook.md)                               | Runbook cho operations, monitoring, alerting |
| [`docs/rollback-procedure.md`](docs/rollback-procedure.md)                 | Rollback procedure: code, database, data     |
| [`docs/wave5-acceptance-mapping.md`](docs/wave5-acceptance-mapping.md)     | Acceptance criteria mapping (68 items)       |
| [`docs/auth-quality-security-plan.md`](docs/auth-quality-security-plan.md) | Quality & security plan tổng thể             |

### Tests

- `scripts/security-regression.test.ts` — 6 tests ✅
- `scripts/two-user-isolation.test.ts` — 8 tests ✅
- `scripts/migration-rehearsal.test.ts` — 5 tests ✅
- `scripts/test-hooks-production-guard.test.ts` — 3 tests ✅
- `scripts/personalization-ranking.test.ts` — 6 tests ✅
- `scripts/privacy-contract.test.ts` — 4 tests ✅
- `scripts/guest-import-contract.test.ts` — 5 tests ✅
- `scripts/guest-import.test.ts` — 5 tests ✅
- `scripts/wave3-api-contract.test.ts` — 5 tests ✅
- `scripts/legacy-json-core.test.ts` — tests ✅
- `scripts/legacy-json-contract.test.ts` — tests ✅
- `e2e/admin-route-security.spec.ts` — 5 passed / 3 skipped ✅

---

## 9. Danh sách file đã tạo

### Root config

```
drizzle.config.ts
```

### lib/

```
lib/adminAuth.ts
lib/apiSecurity.ts
lib/feature-flags.ts

lib/api/catalog.ts
lib/api/personal.ts

lib/auth/client.ts
lib/auth/config.ts
lib/auth/index.ts
lib/auth/mailer.ts
lib/auth/server.ts
lib/auth/session-management.ts
lib/auth/session.ts
lib/auth/test-hooks.ts

lib/db/postgres/client.ts
lib/db/postgres/guest-import-repository.ts
lib/db/postgres/guest-import.ts
lib/db/postgres/privacy-repository.ts
lib/db/postgres/README.md
lib/db/postgres/repositories.ts
lib/db/postgres/schema.ts

lib/personalization/ranking.ts
lib/telemetry/index.ts
```

### Drizzle migrations

```
drizzle/0000_rare_terror.sql
drizzle/0001_legacy_json_migration.sql
drizzle/0002_guest_import_api.sql
drizzle/0003_privacy_deletion.sql
drizzle/meta/_journal.json
drizzle/meta/0000_snapshot.json
```

### API routes

```
app/api/tracks/route.ts              (modified)
app/api/tracks/health/route.ts       (modified)
app/api/tracks/play/route.ts
app/api/tracks/stats/route.ts
app/api/admin/youtube-cookies/route.ts (modified)
app/api/categories/route.ts
app/api/sources/route.ts
app/api/favorites/route.ts
app/api/playlists/route.ts
app/api/playlists/[id]/tracks/route.ts
app/api/auto-rules/route.ts
app/api/library/tracks/route.ts
app/api/import/preview/route.ts
app/api/import/commit/route.ts
app/api/import/status/[id]/route.ts
app/api/profile/route.ts
app/api/preferences/route.ts
app/api/privacy/export/route.ts
app/api/privacy/deletion/route.ts
app/api/privacy/history/route.ts
app/api/privacy/sessions/route.ts
```

### Components & Routes (UX)

```
components/auth/AuthSessionProvider.tsx
components/auth/AuthFlowProvider.tsx
components/auth/AuthSurfaceHost.tsx
components/guest/GuestImportFlow.tsx
components/account/AccountShell.tsx
components/account/AccountForms.tsx
components/account/SessionsPrivacy.tsx
components/home/PersonalizedHome.tsx
app/account/profile/page.tsx
app/account/preferences/page.tsx
app/account/sessions/page.tsx
app/account/privacy/page.tsx
```

### Scripts & Tests

```
scripts/legacy-json-core.ts
scripts/migrate-legacy-json.ts
scripts/purge-deleted-users.ts
scripts/purge-listening-events.ts
scripts/register-server-only-stub.cjs
scripts/server-only-stub.cjs
scripts/set-youtube-cookies.sh

scripts/wave3-api-contract.test.ts
scripts/wave4-personalization-contract.test.ts
scripts/guest-import-contract.test.ts
scripts/guest-import.test.ts
scripts/privacy-contract.test.ts
scripts/personalization-ranking.test.ts
scripts/legacy-json-core.test.ts
scripts/legacy-json-contract.test.ts
scripts/security-regression.test.ts
scripts/two-user-isolation.test.ts
scripts/migration-rehearsal.test.ts
scripts/test-hooks-production-guard.test.ts

e2e/admin-route-security.spec.ts
e2e/auth-foundation.spec.ts
```

### Docs

```
docs/auth-compatibility-spike.md
docs/auth-foundation-plan.md
docs/auth-quality-security-plan.md
docs/auth-ux-plan.md
docs/guest-import-api.md
docs/legacy-json-migration.md
docs/listening-personalization.md
docs/ops-runbook.md
docs/privacy-and-deletion.md
docs/rollback-procedure.md
docs/wave5-acceptance-mapping.md
```

---

## 10. Kết quả verification

### Lần cuối (2026-07-23)

| Check                                                  | Kết quả                                                  |
| ------------------------------------------------------ | -------------------------------------------------------- |
| `npm run format`                                       | ✅ 166 files formatted                                   |
| `npm run lint`                                         | ✅ 0 errors, 70 warnings (pre-existing, không liên quan) |
| `npx tsc --noEmit`                                     | ✅ Clean                                                 |
| `npm run build`                                        | ✅ Compiled successfully (Next.js 16.2.10)               |
| `npx playwright test e2e/admin-route-security.spec.ts` | ✅ 5 passed, 3 skipped                                   |
| Wave 3 contract tests                                  | ✅ 5/5                                                   |
| Guest import tests                                     | ✅ 5/5                                                   |
| Privacy contract tests                                 | ✅ 4/4                                                   |
| Personalization tests                                  | ✅ 2/2                                                   |
| Migration rehearsal                                    | ✅ 5/5                                                   |
| Security regression                                    | ✅ 6/6                                                   |
| Two-user isolation                                     | ✅ 8/8                                                   |
| Test hooks production guard                            | ✅ 3/3                                                   |
| Personalization ranking                                | ✅ 6/6                                                   |

### Edge cases đã xử lý

- **JSON DB Fallback**: Public catalog routes tự động fallback sang JSON DB khi không có PostgreSQL (`DATABASE_URL` không được cấu hình)
- **Empty ids param**: `GET /api/tracks?ids=` trả về `{ ok: true, tracks: [] }` thay vì validation error
- **Server-only safety**: Test hooks có production guard ngăn import trong production
- **Two-user isolation**: Tests xác nhận user A không thể truy cập data user B
- **Idempotent import**: Legacy JSON import không tạo duplicate tracks
- **Ownership enforcement**: Tất cả personal routes kiểm tra ownership qua `requireSession()`

---

## 11. Sơ đồ dependency

```
Wave 0 (Security blockers)
  └── Wave 1 (Compatibility + Schema)
        └── Wave 2 (Auth Server + Session)
              ├── Wave 3 (Repositories + API)
              │     ├── Wave 4 (UX Components)
              │     └── Wave 5 (Tests + Ops)
              └── (Waves 3-5 độc lập sau Wave 2)
```

### File dependency graph (rút gọn)

```
lib/db/index.ts (JSON DB)
  └── lib/db/postgres/schema.ts (Drizzle schema)
        ├── lib/db/postgres/client.ts (Postgres runtime)
        │     ├── lib/auth/server.ts (Better Auth)
        │     │     └── lib/auth/session.ts (Session helpers)
        │     │           └── app/api/*/route.ts (Auth-guarded routes)
        │     └── lib/db/postgres/repositories.ts (Repository layer)
        │           └── app/api/*/route.ts (Data routes)
        └── lib/api/catalog.ts (Dual-backend catalog)
              └── app/api/tracks|categories|sources/route.ts

lib/auth/config.ts
  └── lib/auth/server.ts
        ├── lib/auth/session.ts
        ├── lib/auth/session-management.ts
        └── lib/auth/mailer.ts

components/auth/AuthSessionProvider.tsx
  └── components/auth/AuthFlowProvider.tsx
        ├── components/auth/AuthSurfaceHost.tsx
        ├── components/guest/GuestImportFlow.tsx
        └── app/account/*/page.tsx
              └── components/account/*.tsx
```
