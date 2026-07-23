# Privacy and account deletion

Issue #24 uses synchronous, bounded JSON export at `GET /api/privacy/export`. The export is assembled exclusively with the authenticated session user id and includes profile, preferences, library/favorites, owned playlists/rules, listening events, and guest imports; shared catalog tracks are represented only by referenced ids.

`POST /api/privacy/deletion` requires `{ "confirm": true }`. The policy is a 30-day grace period. The request atomically marks the account for deletion and revokes every session, including the requesting session. Revoked sessions are invalid immediately and cannot cancel deletion. A future authenticated recovery flow is intentionally out of scope.

`DELETE /api/privacy/deletion` is retained as a guarded contract for an authenticated recovery flow, but returns an auth failure after a deletion request because all sessions were revoked.

Run the purge worker with `npm run privacy:purge`. It permanently removes personal rows and the user row after `purge_after`; shared `tracks` and media are never deleted. Foreign keys preserve shared catalog data.

History is cleared with `DELETE /api/privacy/history` and `{ "confirm": true }`. Session inventory and revocation are exposed at `/api/privacy/sessions`.
