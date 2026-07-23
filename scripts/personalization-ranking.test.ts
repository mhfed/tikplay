import assert from 'node:assert/strict';
import test from 'node:test';
import {
  rankEditorial,
  rankRecommendations,
} from '../lib/personalization/ranking';

const now = new Date('2026-01-01T00:00:00Z');
const tracks = [
  { id: 'b', category: 'pop', createdAt: new Date('2026-01-01T00:00:00Z') },
  { id: 'a', category: 'pop', createdAt: new Date('2026-01-01T00:00:00Z') },
];

test('editorial ranking is deterministic and exposes stable fallback reason', () => {
  assert.deepEqual(
    rankEditorial(tracks, 'EDITORIAL_PERSONALIZATION_OFF', 10).map(
      (x) => x.track.id,
    ),
    ['a', 'b'],
  );
  assert.equal(
    rankEditorial(tracks, 'EDITORIAL_PERSONALIZATION_OFF', 1)[0].reasonCode,
    'EDITORIAL_PERSONALIZATION_OFF',
  );
});

test('recommendation ranking is deterministic and user signals are input-scoped', () => {
  const result = rankRecommendations(
    tracks,
    [
      {
        trackId: 'b',
        category: 'pop',
        playedAt: now,
        completionRatio: 0.5,
        durationListenedSeconds: 10,
        classification: 'partial',
      },
    ],
    now,
    10,
  );
  assert.deepEqual(
    result.map((x) => x.track.id),
    ['a', 'b'],
  );
  assert.equal(result[0].reasonCode, 'BECAUSE_CATEGORY');
});
