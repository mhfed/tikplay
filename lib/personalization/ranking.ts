export const PERSONALIZATION_REASON_CODES = {
  CONTINUE_PARTIAL: 'CONTINUE_PARTIAL',
  RECENTLY_PLAYED: 'RECENTLY_PLAYED',
  BECAUSE_CATEGORY: 'BECAUSE_CATEGORY',
  BECAUSE_COMPLETED: 'BECAUSE_COMPLETED',
  EDITORIAL_PERSONALIZATION_OFF: 'EDITORIAL_PERSONALIZATION_OFF',
  EDITORIAL_INSUFFICIENT_SIGNALS: 'EDITORIAL_INSUFFICIENT_SIGNALS',
} as const;

export type PersonalizationReasonCode =
  (typeof PERSONALIZATION_REASON_CODES)[keyof typeof PERSONALIZATION_REASON_CODES];

export type RankingTrack = {
  id: string;
  category: string;
  createdAt: Date;
};

export type RankingSignal = {
  trackId: string;
  category: string;
  playedAt: Date;
  completionRatio: number;
  durationListenedSeconds: number;
  classification: 'started' | 'skipped' | 'partial' | 'completed';
};

export type RankedTrack<T extends RankingTrack = RankingTrack> = {
  track: T;
  reasonCode: PersonalizationReasonCode;
  score: number;
};

const DAY_MS = 86_400_000;

function compareTrackId(a: RankingTrack, b: RankingTrack): number {
  return a.id.localeCompare(b.id, 'en');
}

export function rankEditorial<T extends RankingTrack>(
  tracks: readonly T[],
  reasonCode:
    | 'EDITORIAL_PERSONALIZATION_OFF'
    | 'EDITORIAL_INSUFFICIENT_SIGNALS',
  limit: number,
): RankedTrack<T>[] {
  return [...tracks]
    .sort(
      (a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime() || compareTrackId(a, b),
    )
    .slice(0, limit)
    .map((track, index) => ({ track, reasonCode, score: -index }));
}

export function rankRecommendations<T extends RankingTrack>(
  tracks: readonly T[],
  signals: readonly RankingSignal[],
  now: Date,
  limit: number,
): RankedTrack<T>[] {
  const categoryScores = new Map<string, number>();
  const completedTrackIds = new Set<string>();

  for (const signal of signals) {
    const ageDays = Math.max(
      0,
      Math.floor((now.getTime() - signal.playedAt.getTime()) / DAY_MS),
    );
    const recencyWeight = 1 / (1 + ageDays);
    const qualityWeight =
      signal.classification === 'completed'
        ? 3
        : signal.classification === 'partial'
          ? 1
          : signal.classification === 'skipped'
            ? -2
            : 0.25;
    categoryScores.set(
      signal.category,
      (categoryScores.get(signal.category) ?? 0) +
        qualityWeight * recencyWeight,
    );
    if (signal.classification === 'completed') {
      completedTrackIds.add(signal.trackId);
    }
  }

  return tracks
    .filter((track) => !completedTrackIds.has(track.id))
    .map((track) => {
      const categoryScore = categoryScores.get(track.category) ?? 0;
      return {
        track,
        reasonCode: (categoryScore > 0
          ? 'BECAUSE_CATEGORY'
          : 'BECAUSE_COMPLETED') as PersonalizationReasonCode,
        score: categoryScore,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.track.createdAt.getTime() - a.track.createdAt.getTime() ||
        compareTrackId(a.track, b.track),
    )
    .slice(0, limit);
}

export function dedupeLatestSignals(
  signals: readonly RankingSignal[],
): RankingSignal[] {
  const ordered = [...signals].sort(
    (a, b) =>
      b.playedAt.getTime() - a.playedAt.getTime() ||
      a.trackId.localeCompare(b.trackId, 'en'),
  );
  const seen = new Set<string>();
  return ordered.filter((signal) => {
    if (seen.has(signal.trackId)) return false;
    seen.add(signal.trackId);
    return true;
  });
}
