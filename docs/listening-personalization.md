# Listening personalization contract

Issue #22 stores listening events under the authenticated session user only. Public catalog and guest playback remain usable; persistence of events requires authentication.

## API

- `POST /api/tracks/play` records an authenticated event using `(user_id, event_id)` idempotency.
- `GET /api/tracks/stats?kind=continue-listening|recent|recommendations&limit=N` returns private, user-scoped modules.
- `DELETE /api/tracks/stats` clears only the authenticated user's listening events. Repeating it is safe.
- `GET /api/preferences` and `PATCH /api/preferences` expose the personalization opt-out.

## Ranking

Ranking is pure and deterministic in `lib/personalization/ranking.ts`. Ties are resolved by score, newest catalog timestamp, then track ID. Responses expose stable reason codes rather than server-authored copy:

- `CONTINUE_PARTIAL`
- `RECENTLY_PLAYED`
- `BECAUSE_CATEGORY`
- `BECAUSE_COMPLETED`
- `EDITORIAL_PERSONALIZATION_OFF`
- `EDITORIAL_INSUFFICIENT_SIGNALS`

When personalization is disabled, no listening event is written and recommendations use the editorial fallback. Insufficient history also uses a deterministic editorial fallback.

## Retention

Run `npm run retention:listening` from cron. It deletes events older than 180 days by default; set `LISTENING_RETENTION_DAYS` only for an explicitly approved operational override. The delete is naturally idempotent.

The PostgreSQL schema uses the existing `listening_events` table, user foreign key, `(user_id, event_id)` uniqueness, and user-leading indexes. No live PostgreSQL connection is required by the pure ranking and structural contract tests.
