import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { Client, type ClientBase } from 'pg';
import {
  parseLegacyJson,
  planLegacyMigration,
  sourceSha256,
} from './legacy-json-core';

const MIGRATION_NAME = 'legacy-json-v1';

interface Options {
  source: string;
  allowlist: number[];
  report: string;
  backupDir: string;
  mode: 'dry-run' | 'import' | 'rollback';
  sourceHash?: string;
}

function options(): Options {
  const parsed = parseArgs({
    options: {
      source: {
        type: 'string',
        default: process.env.DB_PATH ?? 'data/tikplay.json',
      },
      'editorial-playlist': { type: 'string', multiple: true, default: [] },
      report: {
        type: 'string',
        default: 'migration-reports/legacy-json-report.json',
      },
      'backup-dir': { type: 'string', default: 'migration-backups' },
      import: { type: 'boolean', default: false },
      rollback: { type: 'boolean', default: false },
      'source-hash': { type: 'string' },
    },
    strict: true,
  });
  if (parsed.values.import && parsed.values.rollback)
    throw new Error('Choose either --import or --rollback.');
  const allowlist = parsed.values['editorial-playlist'].map((value) =>
    Number(value),
  );
  if (allowlist.some((id) => !Number.isSafeInteger(id)))
    throw new Error('Editorial playlist IDs must be integers.');
  return {
    source: parsed.values.source,
    allowlist,
    report: parsed.values.report,
    backupDir: parsed.values['backup-dir'],
    mode: parsed.values.rollback
      ? 'rollback'
      : parsed.values.import
        ? 'import'
        : 'dry-run',
    sourceHash: parsed.values['source-hash'],
  };
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

function ensureBackup(
  source: string,
  backup: string,
  expectedHash: string,
): void {
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  try {
    fs.copyFileSync(source, backup, fs.constants.COPYFILE_EXCL);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !('code' in error) ||
      error.code !== 'EEXIST'
    ) {
      throw error;
    }
    if (sourceSha256(fs.readFileSync(backup)) !== expectedHash) {
      throw new Error(`Existing backup does not match source hash: ${backup}`);
    }
  }
}

async function rollback(
  client: ClientBase,
  hash: string,
): Promise<Record<string, number>> {
  const migration = await client.query<{ id: string; status: string }>(
    `select id, status from data_migrations where source_hash = $1 for update`,
    [hash],
  );
  if (!migration.rowCount)
    throw new Error(`No migration found for source hash ${hash}.`);
  if (migration.rows[0].status === 'rolled_back')
    return { alreadyRolledBack: 1 };
  const id = migration.rows[0].id;
  const counts: Record<string, number> = {};
  for (const [name, table] of [
    ['blockedMedia', 'blocked_media'],
    ['copyrightReports', 'copyright_reports'],
    ['playlistTracks', 'playlist_tracks'],
    ['playlists', 'playlists'],
    ['tracks', 'tracks'],
  ] as const) {
    const result = await client.query(
      `delete from ${table} where migration_id = $1`,
      [id],
    );
    counts[name] = result.rowCount ?? 0;
  }
  await client.query(
    `update data_migrations set status = 'rolled_back', result_counts = $2, completed_at = now(), updated_at = now() where id = $1`,
    [id, counts],
  );
  return counts;
}

async function importPlan(
  client: ClientBase,
  plan: ReturnType<typeof planLegacyMigration>,
): Promise<Record<string, number>> {
  const prior = await client.query<{ id: string; status: string }>(
    `select id, status from data_migrations where source_hash = $1 for update`,
    [plan.report.sourceSha256],
  );
  if (prior.rowCount) {
    if (prior.rows[0].status === 'completed') return { alreadyImported: 1 };
    throw new Error(
      `Source hash already has migration status ${prior.rows[0].status}.`,
    );
  }
  const migration = await client.query<{ id: string }>(
    `insert into data_migrations (name, source_hash, status, source_counts, started_at)
     values ($1, $2, 'running', $3, now()) returning id`,
    [
      `${MIGRATION_NAME}:${plan.report.sourceSha256.slice(0, 12)}`,
      plan.report.sourceSha256,
      plan.report.sourceCounts,
    ],
  );
  const migrationId = migration.rows[0].id;
  const trackIds = new Map<number, string>();
  for (const track of plan.tracks) {
    const result = await client.query<{ id: string }>(
      `insert into tracks (legacy_id, source, source_url, canonical_source_url, audio_key, title, author, cover_url,
        duration_seconds, category, default_start_seconds, default_end_seconds, created_at, updated_at, migration_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,to_timestamp($13 / 1000.0),to_timestamp($13 / 1000.0),$14)
       returning id`,
      [
        track.id,
        track.source,
        track.url,
        track.canonicalUrl,
        track.audio_key,
        track.title,
        track.author,
        track.cover,
        track.duration,
        track.category ?? 'others',
        track.start_time ?? null,
        track.end_time ?? null,
        track.added_at,
        migrationId,
      ],
    );
    trackIds.set(track.id, result.rows[0].id);
  }
  for (const playlist of plan.playlists) {
    const inserted = await client.query<{ id: string }>(
      `insert into playlists (legacy_id, kind, name, visibility, sort_order, created_at, updated_at, migration_id)
       values ($1, 'editorial', $2, 'public', $3, to_timestamp($4 / 1000.0), to_timestamp($4 / 1000.0), $5) returning id`,
      [
        playlist.id,
        playlist.name,
        playlist.sort_order,
        playlist.created_at,
        migrationId,
      ],
    );
    for (const [position, link] of playlist.tracks.entries()) {
      await client.query(
        `insert into playlist_tracks (playlist_id, track_id, position, added_at, migration_id)
         values ($1, $2, $3, to_timestamp($4 / 1000.0), $5)`,
        [
          inserted.rows[0].id,
          trackIds.get(link.track_id),
          position,
          link.added_at,
          migrationId,
        ],
      );
    }
  }
  const reportIds = new Map<number, string>();
  for (const report of plan.copyrightReports) {
    const inserted = await client.query<{ id: string }>(
      `insert into copyright_reports (legacy_id, source_url, normalized_url, audio_key, track_id, track_title,
        track_author, reporter_name, reporter_email, rights_basis, details, status, moderation_note, created_at,
        updated_at, migration_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
        to_timestamp($14 / 1000.0),to_timestamp($15 / 1000.0),$16) returning id`,
      [
        report.id,
        report.source_url,
        report.normalized_url,
        report.audio_key,
        report.track_id ? (trackIds.get(report.track_id) ?? null) : null,
        report.track_title ?? null,
        report.track_author ?? null,
        report.reporter_name,
        report.reporter_email,
        report.rights_basis,
        report.details,
        report.status,
        report.moderation_note ?? null,
        report.created_at,
        report.updated_at,
        migrationId,
      ],
    );
    reportIds.set(report.id, inserted.rows[0].id);
  }
  for (const blocked of plan.blockedMedia) {
    await client.query(
      `insert into blocked_media (audio_key, normalized_url, report_id, track_id, reason, created_at, migration_id)
       values ($1,$2,$3,$4,$5,to_timestamp($6 / 1000.0),$7)`,
      [
        blocked.audio_key,
        blocked.normalized_url,
        reportIds.get(blocked.report_id),
        plan.tracks.find((track) => track.audio_key === blocked.audio_key)?.id
          ? trackIds.get(
              plan.tracks.find(
                (track) => track.audio_key === blocked.audio_key,
              )!.id,
            )
          : null,
        blocked.reason,
        blocked.created_at,
        migrationId,
      ],
    );
  }
  await client.query(
    `update data_migrations set status = 'completed', result_counts = $2, completed_at = now(), updated_at = now() where id = $1`,
    [migrationId, plan.report.importCounts],
  );
  return plan.report.importCounts;
}

async function main(): Promise<void> {
  const config = options();
  if (config.mode === 'rollback') {
    if (!config.sourceHash || !/^[0-9a-f]{64}$/.test(config.sourceHash))
      throw new Error(
        '--rollback requires --source-hash with 64 lowercase hex characters.',
      );
  }
  const source = fs.readFileSync(config.source);
  const hash = sourceSha256(source);
  if (config.mode === 'rollback' && hash !== config.sourceHash) {
    throw new Error('Rollback source bytes do not match --source-hash.');
  }
  const plan = planLegacyMigration(
    parseLegacyJson(source),
    { editorialPlaylistIds: config.allowlist },
    hash,
  );
  if (config.mode === 'dry-run') {
    console.log(JSON.stringify({ mode: 'dry-run', ...plan.report }, null, 2));
    return;
  }
  const databaseUrl =
    process.env.DATABASE_MIGRATION_URL?.trim() ??
    process.env.DATABASE_URL?.trim();
  if (!databaseUrl)
    throw new Error(
      'Import and rollback require DATABASE_MIGRATION_URL or DATABASE_URL.',
    );
  const backup = path.join(
    config.backupDir,
    `${path.basename(config.source)}.${hash}.bak`,
  );
  ensureBackup(config.source, backup, hash);
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('begin');
    const result =
      config.mode === 'rollback'
        ? await rollback(client, config.sourceHash!)
        : await importPlan(client, plan);
    await client.query('commit');
    const report = {
      mode: config.mode,
      backup,
      ...plan.report,
      result,
    };
    writeJson(config.report, report);
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
