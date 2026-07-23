# Operations Runbook — TikPlay (Wave 5)

## 1. Initial SLO Targets

| Metric                           | Target | Measurement                                           |
| -------------------------------- | ------ | ----------------------------------------------------- |
| Auth success rate (login)        | ≥99.5% | `auth.success / (auth.success + auth.failure)`        |
| Magic link delivery (Resend)     | ≥99.0% | `magic.delivered / (magic.delivered + magic.bounced)` |
| Session validation latency (p99) | ≤200ms | Tail-latency of `session.validated` events            |
| Import commit success            | ≥99.0% | `import.commit / (import.commit + import.failure)`    |
| API error rate (5xx)             | ≤0.1%  | `system.error` / total requests                       |
| Uptime                           | ≥99.9% | Fly.io health check                                   |

## 2. Telemetry Events

Events emitted via `lib/telemetry/index.ts`. All events are sanitised (emails, tokens,
magic-link URLs redacted). The default sink writes newline-delimited JSON to stdout.

### Auth lifecycle

- `auth.start`, `auth.success`, `auth.failure`, `auth.cancel`, `auth.conflict`

### Magic-link

- `magic.request`, `magic.accepted`, `magic.delivered`, `magic.delayed`,
  `magic.bounced`, `magic.rejected`

### Session

- `session.validated`, `session.expired`, `session.revoked`, `session.denied`

### Authorization

- `authorization.denied`

### Import

- `import.preview`, `import.commit`, `import.status`, `import.hash_mismatch`,
  `import.retry`, `import.failure`

### Privacy

- `privacy.history_clear`, `privacy.deletion_request`, `privacy.deletion_cancel`,
  `privacy.purge`, `privacy.export`

### Admin

- `admin.action`, `admin.denial`

### Database

- `db.pool_saturation`, `db.transaction_error`, `db.migration_status`

### Playback

- `playback.continuity_transition`

### System

- `system.startup`, `system.error`

## 3. Alert Policy

### P0 — Immediate (respond within 15 min)

- `auth.failure` rate > 5% over 5 min window
- `authorization.denied` unusual spike (>10× baseline)
- `system.error` sustained > 1% of requests over 5 min
- Fly.io health check failing

### P1 — Same day (respond within 4 h)

- `magic.bounced` rate > 2% over 1 h window
- `db.pool_saturation` events firing
- `session.expired` / `session.revoked` anomalous patterns

### P2 — Next business day

- `privacy.purge` failures
- `import.failure` recurring
- `db.migration_status` unexpected states

## 4. Synthetic Probes

After deploy, verify:

0. `GET /api/health` returns 200
1. `GET /api/tracks` returns valid JSON array
2. `POST /api/auth/login` with invalid data returns 400/401 (not 500)
3. Static pages (`/`, `/terms`, `/copyright`) serve 200

Probes can be implemented as a GitHub Actions scheduled workflow or external uptime
monitor (e.g. Pingdom, Checkly).

## 5. Retention Policies

| Data                    | Retention     | Mechanism                                             |
| ----------------------- | ------------- | ----------------------------------------------------- |
| Listening events        | 180 days      | `scripts/purge-listening-events.ts` (cron)            |
| Auth audit events       | 365 days      | Table-level cleanup (future)                          |
| Soft-deleted accounts   | 30 days grace | `purgeAfter` column, `scripts/purge-deleted-users.ts` |
| Telemetry logs (stdout) | 30 days       | Fly.io log retention                                  |

## 6. Feature Flags

All flags default to **disabled**. Enable via environment variables:

| Env Variable              | Flag                 | Default |
| ------------------------- | -------------------- | ------- |
| `FLAG_AUTH_ENABLED`       | `auth.enabled`       | `false` |
| `FLAG_AUTH_GOOGLE`        | `auth.google`        | `false` |
| `FLAG_AUTH_MAGIC_LINK`    | `auth.magic_link`    | `false` |
| `FLAG_AUTH_IMPORT`        | `auth.import`        | `false` |
| `FLAG_AUTH_ACCOUNT_PAGES` | `auth.account_pages` | `false` |
| `FLAG_AUTH_PRIVACY`       | `auth.privacy`       | `false` |
| `FLAG_PERSONALIZATION`    | `personalization`    | `false` |
| `FLAG_ADMIN_NEW_BOUNDARY` | `admin.new_boundary` | `false` |

Kill switch: set `FLAG_KILL_AUTH=true` to disable all auth features in degraded mode.

## 7. Environment Variables

Required variables documented in `lib/auth/config.ts`:

- `BETTER_AUTH_URL` — canonical app URL
- `BETTER_AUTH_SECRET` — min 32 chars
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth
- `RESEND_API_KEY` — magic link email delivery
- `AUTH_EMAIL_FROM` — sender address
- `DATABASE_URL` — PostgreSQL connection string
- `ADMIN_TOKEN` — static admin token (transitional, see RB-01)
- `CACHE_DIR` — media cache location (default: `./cache`)
- `DB_PATH` — JSON DB path (default: `./data/tikplay.json`)
