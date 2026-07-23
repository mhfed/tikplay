import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GUEST_IMPORT_MAX_TRACKS,
  guestSnapshotHash,
  normalizeGuestSnapshot,
  planGuestImport,
} from '../lib/db/postgres/guest-import';

const snapshot = {
  version: 1,
  tracks: [
    {
      sourceUrl: 'https://EXAMPLE.com/song/',
      title: ' Song ',
      author: ' Artist ',
    },
    {
      sourceUrl: 'https://example.com/song',
      title: 'Duplicate',
      author: 'Artist',
    },
  ],
  playlists: [
    { name: 'Mix', trackRefs: ['https://example.com/song'] },
    { name: 'Mix', trackRefs: [] },
  ],
};

test('normalization is canonical and hashing is stable', () => {
  const first = normalizeGuestSnapshot(snapshot);
  const second = normalizeGuestSnapshot(structuredClone(snapshot));
  assert.equal(first.tracks[0]?.canonicalSourceUrl, 'https://example.com/song');
  assert.equal(guestSnapshotHash(first), guestSnapshotHash(second));
});

test('planner dedupes canonical tracks and deterministically renames conflicts', () => {
  const plan = planGuestImport(snapshot, ['Mix']);
  assert.equal(plan.canonicalTracks.length, 1);
  assert.equal(plan.counts.duplicateTracks, 1);
  assert.deepEqual(
    plan.playlists.map(({ plannedName }) => plannedName),
    ['Mix (2)', 'Mix (3)'],
  );
});

test('unsupported versions and oversized arrays fail before persistence', () => {
  assert.throws(
    () => normalizeGuestSnapshot({ ...snapshot, version: 2 }),
    /unsupported snapshot version/,
  );
  assert.throws(
    () =>
      normalizeGuestSnapshot({
        version: 1,
        tracks: Array(GUEST_IMPORT_MAX_TRACKS + 1).fill({}),
        playlists: [],
      }),
    /tracks exceed limit|size limit/,
  );
});
