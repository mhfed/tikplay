# Rollback Procedure — TikPlay (Wave 5)

## Pre-requisites

- Access to Fly.io dashboard: `flyctl dashboard -a craw-music`
- Git history available for the last known-good commit
- `ADMIN_TOKEN` and database access for verification

---

## Rollback Types

### Type A: Application rollback (no schema change)

When a deploy has a runtime bug but no database migration:

1. **Identify the last known-good commit**

   ```bash
   git log --oneline -10
   # Pick commit SHA that was stable
   ```

2. **Deploy the previous image**

   ```bash
   flyctl deploy --app craw-music --image craw-music:<previous-sha>
   ```

   Or use the Fly.io dashboard → select previous release.

3. **Verify**
   ```bash
   curl -f https://craw-music.fly.dev/api/health
   ```

---

### Type B: Feature-flag kill switch (no deploy needed)

For auth-related issues that don't require a full rollback:

1. **Set kill switch**

   ```bash
   flyctl secrets set FLAG_KILL_AUTH=true -a craw-music
   ```

   This immediately disables all auth features and reverts to guest-only mode.

2. **Verify degraded mode**

   ```bash
   curl -s https://craw-music.fly.dev/ | grep -i "degraded"
   ```

3. **To restore** (after fix is deployed):
   ```bash
   flyctl secrets unset FLAG_KILL_AUTH -a craw-music
   ```

---

### Type C: Migration rollback (JSON → PostgreSQL)

If the legacy JSON migration (`scripts/migrate-legacy-json.ts`) produces incorrect data:

1. **Verify backup exists**

   ```bash
   ls -la data/backups/
   # Should see tikplay.json.<timestamp>.bak
   ```

2. **Run rollback**

   ```bash
   npx tsx scripts/migrate-legacy-json.ts --rollback
   ```

   This restores the JSON from the backup created before import.

3. **Verify hash integrity**

   ```bash
   sha256sum data/tikplay.json
   # Compare with backup hash in data/backups/
   ```

4. **Verify application still works**
   ```bash
   curl -f https://craw-music.fly.dev/api/tracks | head -c 200
   ```

---

### Type D: Schema rollback (destructive — use only as last resort)

**WARNING**: Schema rollbacks are destructive. The project's Drizzle migrations are
designed to be additive (see MIG-RBK-001). This procedure applies only if a
non-additive migration was deployed.

1. **Identify the migration to revert**

   ```bash
   ls drizzle/*.sql | sort
   ```

2. **Write a down migration** (example):

   ```sql
   -- drizzle/XXXX_rollback_<name>.sql
   DROP TABLE IF EXISTS <table> CASCADE;
   ```

3. **Apply via Drizzle**

   ```bash
   npx tsx -e "
     import { migrate } from 'drizzle-orm/postgres-js/migrator';
     import { db } from './lib/db/postgres/client';
     migrate(db, { migrationsFolder: './drizzle' });
   "
   ```

4. **Verify**
   ```bash
   # Check the application boots
   npm run build
   ```
   **Then immediately apply a Type A rollback** to match the code with the reverted schema.

---

## Verification Checklist (post-rollback)

| Check                   | Command                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------ | ---------- |
| Health endpoint         | `curl -f https://craw-music.fly.dev/api/health`                                      |
| Tracks load             | `curl -s https://craw-music.fly.dev/api/tracks                                       | jq length` |
| Auth endpoints disabled | `curl -s -o /dev/null -w '%{http_code}' https://craw-music.fly.dev/api/auth/session` |
| No 5xx in logs          | `flyctl logs -a craw-music` (check last 100 lines)                                   |
| Feature flags reset     | Verify `FLAG_KILL_AUTH` is not set                                                   |

---

## Communication Template

When executing a rollback, post in the team channel:

```
[ROLLBACK] <type> — <timestamp>
  Trigger: <reason>
  Commit: <sha>
  Action: <what was done>
  Status: <in-progress / complete / failed>
  Verification: <pass/fail>
```

After rollback is complete and verified, create a GitHub issue with title
`[Rollback] <date> — <summary>` containing:

- The trigger event (monitor alert, user report, etc.)
- Root cause analysis
- Steps taken
- Remediation plan
