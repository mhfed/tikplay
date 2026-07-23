import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { type NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import {
  enforceMutationOrigin,
  errorResponse,
  hasOnlyKeys,
  readJsonObject,
  unauthorizedResponse,
} from '@/lib/apiSecurity';
import { getCacheDir } from '@/lib/cache';
import { getDb } from '@/lib/db';
import { deleteTrack } from '@/lib/db/queries';

const MAX_BODY_BYTES = 16 * 1024;
const MAX_TRACK_IDS = 100;
const MAX_DIRECTORY_ENTRIES = 2_000;
const MAX_DIAGNOSTIC_RESULTS = 200;
const MAX_CLEANUP_KEYS = 100;
const CACHE_EXTENSIONS = new Set(['m4a', 'jpg', 'png', 'webp', 'json']);

type CleanupMode = 'dry-run' | 'commit';

function listCacheFiles(audioDir: string): {
  files: string[];
  truncated: boolean;
} {
  try {
    const files = readdirSync(audioDir);
    return {
      files: files.slice(0, MAX_DIRECTORY_ENTRIES),
      truncated: files.length > MAX_DIRECTORY_ENTRIES,
    };
  } catch {
    return { files: [], truncated: false };
  }
}

function cacheKey(fileName: string): string | null {
  const separator = fileName.lastIndexOf('.');
  if (separator < 1) return null;
  const extension = fileName.slice(separator + 1).toLowerCase();
  return CACHE_EXTENSIONS.has(extension) ? fileName.slice(0, separator) : null;
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorizedResponse();

  const db = getDb();
  const audioDir = getCacheDir();
  const missing: { id: number; title: string; detail: string; kind: string }[] =
    [];
  let missingTruncated = false;

  for (const track of db.tracks) {
    let issue: {
      id: number;
      title: string;
      detail: string;
      kind: string;
    } | null = null;
    if (!existsSync(join(audioDir, `${track.audio_key}.m4a`))) {
      issue = {
        id: track.id,
        title: track.title,
        detail: `File audio thiếu: ${track.audio_key}.m4a`,
        kind: 'audio',
      };
    } else if (
      track.cover?.startsWith('/api/cover/') &&
      !['jpg', 'png', 'webp'].some((ext) =>
        existsSync(join(audioDir, `${track.audio_key}.${ext}`)),
      )
    ) {
      issue = {
        id: track.id,
        title: track.title,
        detail: `File ảnh bìa thiếu: ${track.audio_key}`,
        kind: 'cover',
      };
    }

    if (issue) {
      if (missing.length < MAX_DIAGNOSTIC_RESULTS) missing.push(issue);
      else missingTruncated = true;
    }
  }

  const usedKeys = new Set(db.tracks.map((track) => track.audio_key));
  const cacheFiles = listCacheFiles(audioDir);
  const unreferencedKeys = [
    ...new Set(
      cacheFiles.files
        .filter((file) => file.endsWith('.m4a'))
        .map((file) => cacheKey(file))
        .filter((key): key is string => key !== null)
        .filter((key) => !usedKeys.has(key)),
    ),
  ].slice(0, MAX_DIAGNOSTIC_RESULTS);

  return NextResponse.json({
    ok: true,
    totalTracks: db.tracks.length,
    missing,
    unreferencedKeys,
    truncated: missingTruncated || cacheFiles.truncated,
  });
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorizedResponse();

  const originError = enforceMutationOrigin(request);
  if (originError) return originError;

  const parsed = await readJsonObject(request, MAX_BODY_BYTES);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  if (!hasOnlyKeys(body, ['action', 'mode', 'trackIds'])) {
    return errorResponse(
      400,
      'Nội dung yêu cầu có trường không hợp lệ',
      'INVALID_BODY',
    );
  }
  if (body.action !== 'delete-missing' && body.action !== 'cleanup-cache') {
    return errorResponse(400, 'Action không hợp lệ', 'INVALID_ACTION');
  }
  if (body.mode !== 'dry-run' && body.mode !== 'commit') {
    return errorResponse(
      400,
      'Mode phải là dry-run hoặc commit',
      'INVALID_MODE',
    );
  }
  const mode: CleanupMode = body.mode;

  if (body.action === 'delete-missing') {
    if (!Array.isArray(body.trackIds) || body.trackIds.length > MAX_TRACK_IDS) {
      return errorResponse(
        400,
        `Danh sách trackIds phải có tối đa ${MAX_TRACK_IDS} phần tử`,
        'INVALID_TRACK_IDS',
      );
    }
    const ids = body.trackIds;
    if (ids.some((id) => !Number.isInteger(id) || (id as number) < 1)) {
      return errorResponse(
        400,
        'trackIds phải là các số nguyên dương',
        'INVALID_TRACK_IDS',
      );
    }
    const requestedIds = [...new Set(ids as number[])];
    const existingIds = new Set(getDb().tracks.map((track) => track.id));
    const targets = requestedIds.filter((id) => existingIds.has(id));
    if (mode === 'commit') {
      for (const id of targets) deleteTrack(id);
    }
    return NextResponse.json({
      ok: true,
      mode,
      matched: targets.length,
      removed: mode === 'commit' ? targets.length : 0,
    });
  }

  if (body.trackIds !== undefined) {
    return errorResponse(
      400,
      'cleanup-cache không chấp nhận trackIds',
      'INVALID_BODY',
    );
  }

  const db = getDb();
  const audioDir = getCacheDir();
  const usedKeys = new Set(db.tracks.map((track) => track.audio_key));
  const cacheFiles = listCacheFiles(audioDir);
  const keys = [
    ...new Set(
      cacheFiles.files
        .map(cacheKey)
        .filter((key): key is string => key !== null)
        .filter((key) => !usedKeys.has(key)),
    ),
  ].slice(0, MAX_CLEANUP_KEYS);
  const filesByKey = new Map<string, string[]>();
  for (const file of cacheFiles.files) {
    const key = cacheKey(file);
    if (key && keys.includes(key)) {
      const files = filesByKey.get(key) ?? [];
      files.push(file);
      filesByKey.set(key, files);
    }
  }
  const targets = keys.flatMap((key) => filesByKey.get(key) ?? []);
  let removed = 0;
  if (mode === 'commit') {
    for (const file of targets) {
      try {
        unlinkSync(join(audioDir, file));
        removed++;
      } catch {
        // A concurrently removed or inaccessible file is skipped.
      }
    }
  }

  return NextResponse.json({
    ok: true,
    mode,
    matched: targets.length,
    removed,
    truncated: cacheFiles.truncated || keys.length === MAX_CLEANUP_KEYS,
  });
}
