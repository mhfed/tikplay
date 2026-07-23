import assert from 'node:assert/strict';
import test from 'node:test';
import type { DbData } from '../lib/db/index';
import { planLegacyMigration, sourceSha256 } from './legacy-json-core';

function fixture(): DbData {
  return {
    tracks: [
      {
        id: 1,
        url: 'https://www.tiktok.com/@a/video/1?x=1',
        audio_key: 'a'.repeat(64),
        title: 'One',
        author: 'A',
        cover: '/cover/a',
        duration: 12,
        added_at: 1,
      },
      {
        id: 2,
        url: 'https://youtu.be/example?t=3',
        audio_key: 'b'.repeat(64),
        title: 'Two',
        author: 'B',
        cover: '/cover/b',
        duration: 20,
        added_at: 2,
      },
      {
        id: 3,
        url: 'https://example.com/no',
        audio_key: 'c'.repeat(64),
        title: 'Bad',
        author: 'C',
        cover: '',
        duration: 1,
        added_at: 3,
      },
    ],
    playlists: [
      { id: 10, name: 'Editorial', sort_order: 0, created_at: 1 },
      { id: 11, name: 'Private legacy', sort_order: 1, created_at: 1 },
    ],
    playlistTracks: [
      { playlist_id: 10, track_id: 2, position: 4, added_at: 1 },
      { playlist_id: 10, track_id: 99, position: 8, added_at: 1 },
    ],
    favorites: [1],
    autoRules: [],
    copyrightReports: [
      {
        id: 7,
        source_url: 'https://x',
        normalized_url: 'https://x',
        audio_key: 'a'.repeat(64),
        reporter_name: 'R',
        reporter_email: 'r@example.com',
        rights_basis: 'owner',
        details: 'remove',
        status: 'actioned',
        created_at: 1,
        updated_at: 2,
      },
    ],
    blockedMedia: [
      {
        audio_key: 'a'.repeat(64),
        normalized_url: 'https://x',
        report_id: 7,
        reason: 'claim',
        created_at: 2,
      },
    ],
    listeningHistory: [
      {
        id: 1,
        track_id: 1,
        played_at: 3,
        duration_listened: 2,
        percentage: 0.2,
      },
    ],
    settings: {},
    nextTrackId: 4,
    nextPlaylistId: 12,
    nextRuleId: 1,
    nextCopyrightReportId: 8,
    nextListeningHistoryId: 2,
  };
}

test('plans only allowlisted editorial data and preserves compliance/cache keys', () => {
  const plan = planLegacyMigration(
    fixture(),
    { editorialPlaylistIds: [10] },
    'f'.repeat(64),
  );
  assert.deepEqual(
    plan.tracks.map((track) => track.id),
    [1, 2],
  );
  assert.equal(plan.tracks[0].audio_key, 'a'.repeat(64));
  assert.deepEqual(
    plan.playlists.map((playlist) => playlist.id),
    [10],
  );
  assert.equal(plan.copyrightReports.length, 1);
  assert.equal(plan.blockedMedia.length, 1);
  assert.deepEqual(plan.report.skippedCounts, {
    favorites: 1,
    listeningHistory: 1,
    nonAllowlistedPlaylists: 1,
  });
  assert.equal(plan.report.orderIssues.length, 1);
  assert.ok(plan.report.orphans.some((orphan) => orphan.id === '10:99'));
});

test('reports unique-key collisions instead of choosing a winner', () => {
  const data = fixture();
  data.tracks[1].audio_key = data.tracks[0].audio_key;
  const plan = planLegacyMigration(
    data,
    { editorialPlaylistIds: [] },
    'f'.repeat(64),
  );
  assert.equal(plan.tracks.length, 0);
  assert.ok(
    plan.report.collisions.some(
      (collision) => collision.key === 'a'.repeat(64),
    ),
  );
});

test('source hash uses exact source bytes', () => {
  assert.equal(
    sourceSha256('{}'),
    '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
  );
  assert.notEqual(sourceSha256('{}'), sourceSha256('{}\n'));
});
