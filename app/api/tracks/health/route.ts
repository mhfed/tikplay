import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { type NextRequest, NextResponse } from 'next/server';
import { getCacheDir } from '@/lib/cache';
import { getDb } from '@/lib/db';
import { deleteTrack } from '@/lib/db/queries';

export async function GET() {
  const db = getDb();
  const audioDir = getCacheDir();

  const missing: { id: number; title: string; detail: string; kind: string }[] =
    [];

  for (const track of db.tracks) {
    const audioFile = join(audioDir, `${track.audio_key}.m4a`);
    if (!existsSync(audioFile)) {
      missing.push({
        id: track.id,
        title: track.title,
        detail: `File audio thiếu: ${track.audio_key}.m4a`,
        kind: 'audio',
      });
      continue;
    }
    if (
      track.cover?.startsWith('/api/cover/') &&
      existsSync(join(audioDir, `${track.audio_key}.jpg`)) === false &&
      existsSync(join(audioDir, `${track.audio_key}.png`)) === false &&
      existsSync(join(audioDir, `${track.audio_key}.webp`)) === false
    ) {
      missing.push({
        id: track.id,
        title: track.title,
        detail: `File ảnh bìa thiếu: ${track.audio_key}`,
        kind: 'cover',
      });
    }
  }

  let unreferencedFiles: string[] = [];
  const usedKeys = new Set(db.tracks.map((track) => track.audio_key));
  const { readdirSync } = await import('node:fs');
  try {
    const files = readdirSync(audioDir);
    unreferencedFiles = files
      .filter((f) => f.endsWith('.m4a'))
      .map((f) => f.slice(0, -'.m4a'.length))
      .filter((key) => !usedKeys.has(key));
  } catch {
    // Directory might not exist yet
  }

  return NextResponse.json({
    ok: true,
    totalTracks: db.tracks.length,
    missing,
    unreferencedKeys: unreferencedFiles,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, trackIds } = body;

  if (action === 'delete-missing') {
    const ids: number[] = Array.isArray(trackIds) ? trackIds : [];
    let removed = 0;
    for (const id of ids) {
      deleteTrack(id);
      removed++;
    }
    return NextResponse.json({ ok: true, removed });
  }

  if (action === 'cleanup-cache') {
    const { existsSync: ex, unlinkSync } = await import('node:fs');
    const { readdirSync } = await import('node:fs');
    const db = getDb();
    const audioDir = getCacheDir();
    const usedKeys = new Set(db.tracks.map((track) => track.audio_key));
    let removed = 0;
    try {
      const files = readdirSync(audioDir);
      for (const f of files) {
        const key = f.endsWith('.m4a')
          ? f.slice(0, -'.m4a'.length)
          : f.endsWith('.json')
            ? f.slice(0, -'.json'.length)
            : null;
        if (!key) continue;
        if (!usedKeys.has(key)) {
          const fullPath = join(audioDir, f);
          if (ex(fullPath)) {
            unlinkSync(fullPath);
            removed++;
          }
          // Also remove sidecars
          for (const ext of ['jpg', 'png', 'webp', 'json']) {
            const sidecar = join(audioDir, `${key}.${ext}`);
            if (ex(sidecar)) {
              unlinkSync(sidecar);
              removed++;
            }
          }
        }
      }
    } catch {
      // Ignore if directory doesn't exist
    }
    return NextResponse.json({ ok: true, removed });
  }

  return NextResponse.json(
    { ok: false, error: 'Action không hợp lệ' },
    { status: 400 },
  );
}
