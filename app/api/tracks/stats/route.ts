import type { NextRequest } from 'next/server';
import { toCatalogTrack } from '@/lib/api/catalog';
import { personalErrorResponse, validationError } from '@/lib/api/personal';
import { privateJson, requireSession } from '@/lib/auth/session';
import { listeningRepository } from '@/lib/db/postgres/repositories';

const KINDS = new Set(['continue-listening', 'recent', 'recommendations']);

function readLimit(req: NextRequest): number | null {
  const raw = req.nextUrl.searchParams.get('limit');
  if (raw === null) return 20;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 && value <= 100
    ? value
    : null;
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireSession(req.headers);
    const kind = req.nextUrl.searchParams.get('kind') ?? 'recommendations';
    const limit = readLimit(req);
    if (!KINDS.has(kind) || limit === null) {
      return validationError('kind or limit is invalid.');
    }

    const stats = await listeningRepository.stats(user.id, limit);
    if (kind === 'recommendations') {
      return privateJson({
        ok: true,
        kind,
        personalizationEnabled: stats.personalizationEnabled,
        signalLevel: stats.signalLevel,
        fallbackReason:
          stats.recommendations[0]?.reasonCode.startsWith('EDITORIAL_') === true
            ? stats.recommendations[0].reasonCode
            : null,
        items: stats.recommendations.map(({ track, reasonCode }) => ({
          track: toCatalogTrack(track),
          reason: { code: reasonCode, params: { category: track.category } },
        })),
      });
    }

    const latestByTrack = new Set<string>();
    const rows = stats.recent.filter(({ event }) => {
      if (latestByTrack.has(event.trackId)) return false;
      latestByTrack.add(event.trackId);
      return kind === 'recent' || event.classification === 'partial';
    });
    return privateJson({
      ok: true,
      kind,
      items: rows.map(({ event, track }) => ({
        track: toCatalogTrack(track),
        playedAt: event.playedAt.toISOString(),
        progress: event.completionRatio,
        durationListenedSeconds: event.durationListenedSeconds,
        reason: {
          code:
            kind === 'continue-listening'
              ? 'CONTINUE_PARTIAL'
              : 'RECENTLY_PLAYED',
          params: {},
        },
      })),
    });
  } catch (error) {
    return personalErrorResponse(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user } = await requireSession(req.headers);
    const result = await listeningRepository.clear(user.id);
    return privateJson({ ok: true, ...result });
  } catch (error) {
    return personalErrorResponse(error);
  }
}
