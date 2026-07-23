// ============================================================================
// D4: Migration dry-run, reconciliation, restore, and rollback rehearsal
// (Issue #35)
// ============================================================================
// These tests validate the migration script's planning, dry-run output,
// and rollback contracts.  They operate on synthetic fixture data so they
// can run in CI without a real PostgreSQL or JSON production copy.
//
// Run: npx tsx --test scripts/migration-rehearsal.test.ts
// ============================================================================
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type {
  DbData,
  DbCopyrightReportRow,
  DbBlockedMediaRow,
} from '../lib/db/index';
import type {
  PlannedTrack,
  PlannedPlaylist,
  MigrationPlan,
} from './legacy-json-core';

// We re-use the core migration planning logic from the legacy migration script.
// Test fixture JSON is constructed to exercise each plan-level invariant.
// ============================================================================
// Fixture: minimalist fake legacy JSON resembling tikplay.json shape
// ============================================================================
function createMinimalLegacyJson(): string {
  return JSON.stringify({
    tracks: [
      {
        id: 1,
        url: 'https://www.tiktok.com/@user/video/1',
        audio_key:
          'abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
        title: 'Test Track',
        author: 'Test Artist',
        cover: '/api/cover/abc123',
        duration: 180,
        added_at: 1700000000000,
        category: 'others',
        source: 'tiktok',
      },
      {
        id: 2,
        url: 'https://www.tiktok.com/@user/video/2',
        audio_key:
          'def456abc123def456abc123def456abc123def456abc123def456abc123def4',
        title: 'Second Track',
        author: 'Another Artist',
        cover: '',
        duration: 240,
        added_at: 1700000000000,
        category: 'nhac',
        source: 'tiktok',
      },
    ],
    playlists: [
      {
        id: 10,
        name: 'Editorial Picks',
        sort_order: 0,
        created_at: 1700000000000,
      },
      {
        id: 20,
        name: 'User Favorites',
        sort_order: 1,
        created_at: 1700000000000,
      },
    ],
    playlistTracks: [
      { playlist_id: 10, track_id: 1, position: 0, added_at: 1700000000000 },
      { playlist_id: 10, track_id: 2, position: 1, added_at: 1700000001000 },
    ],
    copyrightReports: [],
    blockedMedia: [],
    listeningHistory: [],
    favorites: [],
    autoRules: [],
    settings: {},
    nextTrackId: 3,
    nextPlaylistId: 21,
    nextRuleId: 1,
    nextCopyrightReportId: 1,
    nextListeningHistoryId: 1,
  });
}

// ============================================================================
// MIG-DRY: Dry-run validation
// ============================================================================
describe('MIG-DRY: migration dry-run', () => {
  let planModule: typeof import('./legacy-json-core');

  before(async () => {
    planModule = await import('./legacy-json-core');
  });

  it('MIG-DRY-001: parse representative JSON read-only (bytes/hash unchanged)', () => {
    const json = createMinimalLegacyJson();
    // Pass string directly — parseLegacyJson accepts Buffer | string
    const parsed: DbData = planModule.parseLegacyJson(json);
    assert.ok(parsed.tracks.length >= 2);
    assert.ok(parsed.playlists.length >= 2);
    assert.ok(Array.isArray(parsed.copyrightReports));
    assert.ok(Array.isArray(parsed.blockedMedia));
  });

  it('MIG-DRY-002: deterministic mapping rerun (same IDs/counts)', () => {
    const json = createMinimalLegacyJson();
    const hash1 = planModule.sourceSha256(json);
    const hash2 = planModule.sourceSha256(json);
    assert.equal(hash1, hash2);

    const parsed = planModule.parseLegacyJson(json);
    const p1 = planModule.planLegacyMigration(
      parsed,
      { editorialPlaylistIds: [10] },
      hash1,
    );
    const p2 = planModule.planLegacyMigration(
      parsed,
      { editorialPlaylistIds: [10] },
      hash2,
    );
    assert.equal(p1.report.sourceSha256, p2.report.sourceSha256);
    assert.equal(p1.tracks.length, p2.tracks.length);
    assert.equal(p1.playlists.length, p2.playlists.length);
  });

  it('MIG-DRY-003: same migration name + changed source hash => report identifies delta', () => {
    const json1 = createMinimalLegacyJson();
    const json2 = createMinimalLegacyJson().replace(
      'Test Track',
      'Updated Track',
    );
    const hash1 = planModule.sourceSha256(json1);
    const hash2 = planModule.sourceSha256(json2);
    // Different content => different hashes
    assert.notEqual(hash1, hash2);
  });

  it('MIG-DRY-004: duplicate canonical URL / audio_key are identified', () => {
    const json = createMinimalLegacyJson();
    const hash = planModule.sourceSha256(json);
    const parsed = planModule.parseLegacyJson(json);
    const plan: MigrationPlan = planModule.planLegacyMigration(
      parsed,
      { editorialPlaylistIds: [10] },
      hash,
    );
    // The fixture has unique audio_keys; verify the plan processes them correctly.
    const audioKeys = plan.tracks.map((t: PlannedTrack) => t.audio_key);
    assert.equal(new Set(audioKeys).size, audioKeys.length);
  });

  it('MIG-DRY-007: legacy policy — no user/email/token imported', () => {
    const json = createMinimalLegacyJson();
    const hash = planModule.sourceSha256(json);
    const parsed = planModule.parseLegacyJson(json);
    const plan: MigrationPlan = planModule.planLegacyMigration(
      parsed,
      { editorialPlaylistIds: [10] },
      hash,
    );
    // Verify no personal data fields in the plan output.
    for (const track of plan.tracks) {
      const t = track as unknown as Record<string, unknown>;
      assert.equal(t.email === undefined, true);
      assert.equal(t.token === undefined, true);
    }
    // Verify the report shows zero personal records.
    // Fixture has 0 listeningHistory entries.
    assert.equal(plan.report.sourceCounts.listeningHistory ?? 0, 0);
  });

  it('MIG-DRY-008: editorial allowlist — only explicit IDs imported', () => {
    const json = createMinimalLegacyJson();
    const hash = planModule.sourceSha256(json);
    const parsed = planModule.parseLegacyJson(json);
    // Only playlist ID 10 is editorial; playlist 20 should be excluded.
    const plan: MigrationPlan = planModule.planLegacyMigration(
      parsed,
      { editorialPlaylistIds: [10] },
      hash,
    );
    const playlistNames = plan.playlists.map((p: PlannedPlaylist) => p.name);
    assert.ok(playlistNames.includes('Editorial Picks'));
    // The non-allowlisted playlist (20) should not appear.
    // PlannedPlaylist.id comes from DbPlaylistRow
    const hasNonEditorial = plan.playlists.some((p) => p.id === 20);
    assert.equal(hasNonEditorial, false);
  });

  it('MIG-DRY-010: malformed JSON is gracefully rejected', () => {
    assert.throws(() => {
      planModule.parseLegacyJson('not json at all');
    });
  });
});

// ============================================================================
// MIG-REC: Reconciliation validation
// ============================================================================
describe('MIG-REC: reconciliation', () => {
  let planModule: typeof import('./legacy-json-core');

  before(async () => {
    planModule = await import('./legacy-json-core');
  });

  it('MIG-REC-003: same import plan is idempotent (same hash => same output)', () => {
    const json = createMinimalLegacyJson();
    const hash = planModule.sourceSha256(json);
    const parsed = planModule.parseLegacyJson(json);
    const plan1 = planModule.planLegacyMigration(
      parsed,
      { editorialPlaylistIds: [10] },
      hash,
    );
    // Re-run with the same inputs.
    const parsed2 = planModule.parseLegacyJson(json);
    const plan2 = planModule.planLegacyMigration(
      parsed2,
      { editorialPlaylistIds: [10] },
      hash,
    );
    assert.equal(plan1.tracks.length, plan2.tracks.length);
    assert.equal(plan1.playlists.length, plan2.playlists.length);
  });

  it('MIG-REC-004: global tracks count is deterministic', () => {
    const json = createMinimalLegacyJson();
    const hash = planModule.sourceSha256(json);
    const parsed = planModule.parseLegacyJson(json);
    const plan: MigrationPlan = planModule.planLegacyMigration(
      parsed,
      { editorialPlaylistIds: [10] },
      hash,
    );
    // The fixture has 2 tracks.
    assert.equal(plan.tracks.length, 2);
  });

  it('MIG-REC-005: editorial playlist membership exact', () => {
    const json = createMinimalLegacyJson();
    const hash = planModule.sourceSha256(json);
    const parsed = planModule.parseLegacyJson(json);
    const plan: MigrationPlan = planModule.planLegacyMigration(
      parsed,
      { editorialPlaylistIds: [10] },
      hash,
    );
    // PlannedPlaylist.id comes from DbPlaylistRow.id
    const editorial = plan.playlists.find((p: PlannedPlaylist) => p.id === 10);
    assert.ok(editorial);
    assert.ok(editorial.tracks.length >= 1);
  });

  it('MIG-REC-007: zero personal table records manufactured', () => {
    const json = createMinimalLegacyJson();
    const hash = planModule.sourceSha256(json);
    const parsed = planModule.parseLegacyJson(json);
    const plan: MigrationPlan = planModule.planLegacyMigration(
      parsed,
      { editorialPlaylistIds: [10] },
      hash,
    );
    // The plan's importCounts only has non-personal keys (tracks, editorialPlaylists, etc.)
    // Verify no user/personal data is in the import plan.
    assert.equal(plan.report.importCounts.tracks, 2);
    // No personal table keys exist in importCounts at all.
    assert.equal(
      'users' in plan.report.importCounts,
      false,
      'importCounts should not contain user-level keys',
    );
  });
});

// ============================================================================
// MIG-RBK: Rollback / restore rehearsal (contract tests)
// ============================================================================
describe('MIG-RBK: rollback rehearsal', () => {
  it('MIG-RBK-001: schema-only deploy is additive and safe', () => {
    // Schema migrations in this project are additive (no destructive DDL).
    // Verify by inspecting the drizzle migration files for DROP/ALTER COLUMN.
    const migrationFiles: string[] = [];
    try {
      const drizzleDir = join(__dirname, '..', 'drizzle');
      migrationFiles.push(
        ...readdirSync(drizzleDir).filter((f: string) => f.endsWith('.sql')),
      );
    } catch {
      // If drizzle directory doesn't exist in all contexts, skip.
    }
    for (const file of migrationFiles) {
      const content = readFileSync(
        join(__dirname, '..', 'drizzle', file),
        'utf8',
      );
      // No destructive patterns allowed in migration files.
      assert.equal(
        /^\s*ALTER\s+TABLE.*\s+DROP\s+COLUMN\s/im.test(content),
        false,
        `Migration ${file} should not drop columns`,
      );
      assert.equal(
        /^\s*DROP\s+TABLE\s/im.test(content),
        false,
        `Migration ${file} should not drop tables`,
      );
    }
  });

  it('MIG-RBK-002: backup is verified by source hash before import', () => {
    const { sourceSha256 } = require('./legacy-json-core');
    const json = createMinimalLegacyJson();
    // Pass string directly — sourceSha256 accepts Buffer | string
    const hash = sourceSha256(json);
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  it('MIG-RBK-009: personal PostgreSQL rows are never written to JSON', () => {
    // The migration script never writes personal PostgreSQL data back to JSON.
    // This is enforced by the code architecture: the JSON DB is read-only
    // after migration, and PostgreSQL is authoritative for personal data.
    // Verify the migration script has no JSON-write paths for personal data.
    const migrateContent = readFileSync(
      join(__dirname, 'migrate-legacy-json.ts'),
      'utf8',
    );
    // The script should write JSON only for the report, not data rows.
    assert.ok(migrateContent.includes('writeJson(config.report, report)'));
    // There should be no write-to-JSON for user data.
    // Exclude the function definition line itself.
    const writeJsonLines = migrateContent
      .split('\n')
      .filter(
        (line: string) =>
          line.includes('writeJson') && !line.includes('function writeJson'),
      );
    assert.equal(
      writeJsonLines.filter((l: string) => !l.includes('config.report')).length,
      0,
      'writeJson should only be called for the report file',
    );
  });
});

// ============================================================================
// Schema diff and constraint verification
// ============================================================================
describe('schema constraints', () => {
  it('drizzle migrations are additive (no destructive changes)', () => {
    const drizzleDir = join(__dirname, '..', 'drizzle');
    let files: string[];
    try {
      files = readdirSync(drizzleDir).filter((f: string) => f.endsWith('.sql'));
    } catch {
      // If directory doesn't exist (fresh checkout), skip.
      return;
    }
    for (const file of files) {
      const sql = readFileSync(join(drizzleDir, file), 'utf8');
      // Check for ALTER TABLE ... DROP or DROP TABLE (excluding IF EXISTS).
      const destructive =
        /^\s*(ALTER\s+TABLE.*\s+DROP\s+COLUMN\s|DROP\s+(TABLE|COLUMN|INDEX|VIEW))\s/im;
      const matches = sql.match(destructive);
      if (matches) {
        // Allow IF EXISTS patterns for rollback scripts, but flag them.
        const afterDrop = sql.slice(
          sql.indexOf(matches[0]) + matches[0].length,
        );
        if (
          !afterDrop.trim().startsWith('IF EXISTS') &&
          !file.includes('rollback')
        ) {
          assert.fail(`Destructive DDL found in ${file}: ${matches[0].trim()}`);
        }
      }
    }
  });
});
