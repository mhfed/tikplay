import { type NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import {
  getJsonCatalog,
  hasDatabaseUrl,
  publicCatalogError,
  publicCatalogJson,
  toCatalogTrack,
} from '@/lib/api/catalog';
import { isUuid } from '@/lib/api/personal';
import {
  enforceMutationOrigin,
  errorResponse,
  hasOnlyKeys,
  readJsonObject,
  unauthorizedResponse,
} from '@/lib/apiSecurity';
import { CATEGORIES, DEFAULT_CATEGORY } from '@/lib/categories';
import { getDb, saveDb } from '@/lib/db';
import { catalogRepository } from '@/lib/db/postgres/repositories';
import {
  applyAutoRules,
  deleteTrack,
  getTrack,
  upsertTrack,
} from '@/lib/db/queries';
import { getFavoriteIds, toTrack } from './helpers';

const MAX_BATCH_TRACK_IDS = 100;
const MAX_MUTATION_BODY_BYTES = 16 * 1024;
const VALID_CATEGORIES = new Set([
  DEFAULT_CATEGORY,
  ...CATEGORIES.map((item) => item.slug),
]);

function positiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function validString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' &&
    Boolean(value.trim()) &&
    value.trim().length <= maxLength
  );
}

async function readAdminMutation(request: NextRequest) {
  if (!isAdminRequest(request)) return { response: unauthorizedResponse() };
  const originError = enforceMutationOrigin(request);
  if (originError) return { response: originError };
  const parsed = await readJsonObject(request, MAX_MUTATION_BODY_BYTES);
  return parsed.ok ? { body: parsed.value } : { response: parsed.response };
}

export async function GET(req: NextRequest) {
  try {
    const idsParam = req.nextUrl.searchParams.get('ids');
    if (idsParam !== null) {
      const ids = idsParam.split(',').filter(Boolean);
      // Empty ids param returns empty results (not a validation error)
      if (ids.length === 0) {
        return publicCatalogJson({ ok: true, tracks: [] });
      }
      if (ids.length > MAX_BATCH_TRACK_IDS || ids.some((id) => !isUuid(id))) {
        return publicCatalogError(
          400,
          'VALIDATION_ERROR',
          `ids must contain 1 to ${MAX_BATCH_TRACK_IDS} UUIDs.`,
        );
      }

      if (!hasDatabaseUrl()) {
        const allTracks = getJsonCatalog();
        const byId = new Map(allTracks.map((track) => [track.id, track]));
        return publicCatalogJson({
          ok: true,
          tracks: ids.flatMap((id) => {
            const track = byId.get(id);
            return track ? [track] : [];
          }),
        });
      }

      const rows = await catalogRepository.listByIds(ids);
      const byId = new Map(rows.map((track) => [track.id, track]));
      return publicCatalogJson({
        ok: true,
        tracks: ids.flatMap((id) => {
          const track = byId.get(id);
          return track ? [toCatalogTrack(track)] : [];
        }),
      });
    }

    const query = req.nextUrl.searchParams.get('q')?.trim();
    if (query && query.length > 200) {
      return publicCatalogError(400, 'VALIDATION_ERROR', 'Query is too long.');
    }

    if (!hasDatabaseUrl()) {
      const tracks = getJsonCatalog();
      if (query) {
        const lower = query.toLowerCase();
        const filtered = tracks.filter(
          (t) =>
            t.title.toLowerCase().includes(lower) ||
            t.author.toLowerCase().includes(lower),
        );
        return publicCatalogJson({ ok: true, tracks: filtered });
      }
      return publicCatalogJson({ ok: true, tracks });
    }

    const rows = query
      ? await catalogRepository.search(query)
      : await catalogRepository.list();
    return publicCatalogJson({ ok: true, tracks: rows.map(toCatalogTrack) });
  } catch (error) {
    console.error('Public catalog request failed.', error);
    return publicCatalogError(
      503,
      'TRANSIENT_ERROR',
      'The catalog is temporarily unavailable.',
    );
  }
}

export async function POST(request: NextRequest) {
  const input = await readAdminMutation(request);
  if (input.response) return input.response;
  const body = input.body;
  if (
    !body ||
    !hasOnlyKeys(body, [
      'url',
      'audioKey',
      'title',
      'author',
      'cover',
      'duration',
    ]) ||
    !validString(body.url, 2_000) ||
    !validString(body.audioKey, 200) ||
    !validString(body.title, 200) ||
    !validString(body.author, 120) ||
    (body.cover !== undefined &&
      (typeof body.cover !== 'string' || body.cover.length > 2_000)) ||
    typeof body.duration !== 'number' ||
    !Number.isFinite(body.duration) ||
    body.duration < 0
  ) {
    return errorResponse(400, 'Dữ liệu bài hát không hợp lệ', 'INVALID_TRACK');
  }

  const row = upsertTrack({
    url: body.url.trim(),
    audio_key: body.audioKey.trim(),
    title: body.title.trim(),
    author: body.author.trim(),
    cover: typeof body.cover === 'string' ? body.cover.trim() : '',
    duration: body.duration,
    added_at: Date.now(),
  });
  applyAutoRules(row.id, row.title, row.author);
  return NextResponse.json({
    ok: true,
    track: toTrack(row, getFavoriteIds()),
  });
}

export async function PATCH(request: NextRequest) {
  const input = await readAdminMutation(request);
  if (input.response) return input.response;
  const body = input.body;
  if (
    !body ||
    !hasOnlyKeys(body, [
      'id',
      'startTime',
      'endTime',
      'title',
      'author',
      'cover',
      'category',
    ]) ||
    !positiveInteger(body.id)
  ) {
    return errorResponse(
      400,
      'ID hoặc dữ liệu bài hát không hợp lệ',
      'INVALID_TRACK',
    );
  }

  const mutableKeys = [
    'startTime',
    'endTime',
    'title',
    'author',
    'cover',
    'category',
  ];
  if (!mutableKeys.some((key) => body[key] !== undefined)) {
    return errorResponse(400, 'Không có trường cần cập nhật', 'INVALID_TRACK');
  }

  const db = getDb();
  const track = db.tracks.find((item) => item.id === body.id);
  if (!track) return errorResponse(404, 'Không tìm thấy bài hát', 'NOT_FOUND');

  if (body.title !== undefined && !validString(body.title, 200)) {
    return errorResponse(
      400,
      'Tên bài hát phải có từ 1 đến 200 ký tự',
      'INVALID_TRACK',
    );
  }
  if (body.author !== undefined && !validString(body.author, 120)) {
    return errorResponse(
      400,
      'Tên nghệ sĩ phải có từ 1 đến 120 ký tự',
      'INVALID_TRACK',
    );
  }
  if (
    body.cover !== undefined &&
    (typeof body.cover !== 'string' || body.cover.length > 2_000)
  ) {
    return errorResponse(
      400,
      'Đường dẫn ảnh bìa không hợp lệ',
      'INVALID_TRACK',
    );
  }
  if (
    body.category !== undefined &&
    (typeof body.category !== 'string' || !VALID_CATEGORIES.has(body.category))
  ) {
    return errorResponse(400, 'Thể loại không hợp lệ', 'INVALID_TRACK');
  }
  if (
    body.startTime !== undefined &&
    (typeof body.startTime !== 'number' ||
      !Number.isFinite(body.startTime) ||
      body.startTime < 0)
  ) {
    return errorResponse(
      400,
      'Thời điểm bắt đầu không hợp lệ',
      'INVALID_TRACK',
    );
  }
  if (
    body.endTime !== undefined &&
    (typeof body.endTime !== 'number' ||
      !Number.isFinite(body.endTime) ||
      body.endTime <= 0)
  ) {
    return errorResponse(
      400,
      'Thời điểm kết thúc không hợp lệ',
      'INVALID_TRACK',
    );
  }

  const nextStart =
    body.startTime === undefined ? track.start_time : body.startTime;
  const nextEnd = body.endTime === undefined ? track.end_time : body.endTime;
  if (nextStart != null && nextEnd != null && nextEnd <= nextStart) {
    return errorResponse(
      400,
      'Thời điểm kết thúc phải sau thời điểm bắt đầu',
      'INVALID_TRACK',
    );
  }

  if (typeof body.title === 'string') track.title = body.title.trim();
  if (typeof body.author === 'string') track.author = body.author.trim();
  if (typeof body.cover === 'string') track.cover = body.cover.trim();
  if (typeof body.category === 'string') track.category = body.category;
  if (typeof body.startTime === 'number') track.start_time = body.startTime;
  if (typeof body.endTime === 'number') track.end_time = body.endTime;

  saveDb();
  return NextResponse.json({
    ok: true,
    track: toTrack(track, getFavoriteIds()),
  });
}

export async function DELETE(request: NextRequest) {
  const input = await readAdminMutation(request);
  if (input.response) return input.response;
  const body = input.body;
  if (!body || !hasOnlyKeys(body, ['id']) || !positiveInteger(body.id)) {
    return errorResponse(400, 'ID bài hát không hợp lệ', 'INVALID_TRACK_ID');
  }
  if (!getTrack(body.id))
    return errorResponse(404, 'Không tìm thấy bài hát', 'NOT_FOUND');
  deleteTrack(body.id);
  return NextResponse.json({ ok: true });
}
