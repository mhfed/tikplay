import type { NextRequest } from 'next/server';
import {
  isUuid,
  personalErrorResponse,
  validationError,
} from '@/lib/api/personal';
import { privateJson, requireSession } from '@/lib/auth/session';
import {
  autoRulesRepository,
  type MatchMode,
} from '@/lib/db/postgres/repositories';

const MATCH_MODES = new Set<MatchMode>(['contains', 'starts_with']);

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireSession(req.headers);
    return privateJson({
      ok: true,
      rules: await autoRulesRepository.list(user.id),
    });
  } catch (error) {
    return personalErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireSession(req.headers);
    const body = await req.json();
    const keyword = typeof body.keyword === 'string' ? body.keyword.trim() : '';
    const matchMode = body.matchMode ?? 'contains';
    if (
      !isUuid(body.playlistId) ||
      !keyword ||
      keyword.length > 120 ||
      !MATCH_MODES.has(matchMode)
    ) {
      return validationError('Auto-rule input is invalid.');
    }
    const rule = await autoRulesRepository.create(
      user.id,
      body.playlistId,
      keyword,
      matchMode,
    );
    return privateJson({ ok: true, rule }, { status: 201 });
  } catch (error) {
    return personalErrorResponse(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user } = await requireSession(req.headers);
    const body = await req.json();
    if (!isUuid(body.id)) return validationError('Rule id is invalid.');
    await autoRulesRepository.remove(user.id, body.id);
    return privateJson({ ok: true });
  } catch (error) {
    return personalErrorResponse(error);
  }
}
