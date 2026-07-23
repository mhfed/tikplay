import type { NextRequest } from 'next/server';
import {
  isUuid,
  personalErrorResponse,
  validationError,
} from '@/lib/api/personal';
import { privateJson, requireSession } from '@/lib/auth/session';
import { listeningRepository } from '@/lib/db/postgres/repositories';

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireSession(req.headers);
    const body = await req.json();
    if (
      !isUuid(body.trackId) ||
      !isUuid(body.eventId) ||
      typeof body.durationListened !== 'number' ||
      !Number.isFinite(body.durationListened) ||
      typeof body.percentage !== 'number' ||
      !Number.isFinite(body.percentage)
    ) {
      return validationError('Listening event is invalid.');
    }
    const duration = Math.max(0, Math.min(86_400, body.durationListened));
    const ratio = Math.max(0, Math.min(1, body.percentage));
    const classification =
      ratio >= 0.9
        ? 'completed'
        : duration < 5
          ? 'skipped'
          : ratio > 0
            ? 'partial'
            : 'started';
    const result = await listeningRepository.record(user.id, {
      trackId: body.trackId,
      eventId: body.eventId,
      playedAt: new Date(),
      durationListenedSeconds: duration,
      completionRatio: ratio,
      classification,
    });
    return privateJson({ ok: true, ...result });
  } catch (error) {
    return personalErrorResponse(error);
  }
}
