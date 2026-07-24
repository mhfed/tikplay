import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { NextRequest } from 'next/server';
import { getCacheDir } from '@/lib/cache';
import { isMediaBlocked } from '@/lib/db/queries';

// Audio files live on disk and are streamed; Node runtime required.
export const runtime = 'nodejs';

// Cache keys are hex (MD5/SHA256). Reject anything else to avoid path abuse.
const KEY_RE = /^[a-f0-9]{32,64}$/;

const IMMUTABLE_MEDIA_CACHE = 'public, max-age=31536000, immutable';

// Parse a single-range "bytes=start-end" / "bytes=start-" header. Returns
// inclusive byte offsets, `undefined` when no range was requested, or `null`
// for malformed/unsatisfiable ranges.
function parseRange(header: string | null, size: number) {
  if (!header) return undefined;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const start = match[1] ? Number(match[1]) : null;
  const end = match[2] ? Number(match[2]) : null;
  if (start == null && end == null) return null;
  // "bytes=-N" → last N bytes.
  if (start == null) {
    if (!end || end <= 0) return null;
    const s = Math.max(0, size - end);
    return { start: s, end: size - 1 };
  }
  if (start >= size || (end != null && end < start)) return null;
  return { start, end: end == null ? size - 1 : Math.min(end, size - 1) };
}

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ key: string }> },
) {
  const params = await props.params;
  const key = params.key;

  if (!KEY_RE.test(key)) {
    return new Response('Bad key', { status: 400 });
  }
  if (isMediaBlocked(key)) {
    return new Response('Unavailable for legal reasons', { status: 451 });
  }

  const startedAt = performance.now();
  const file = join(getCacheDir(), `${key}.m4a`);
  let size: number;
  try {
    size = (await stat(file)).size;
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const etag = `"${key}"`;
  const lookupMs = performance.now() - startedAt;
  const baseHeaders = {
    'Accept-Ranges': 'bytes',
    'Cache-Control': IMMUTABLE_MEDIA_CACHE,
    'Content-Type': 'audio/mp4',
    ETag: etag,
    'Server-Timing': `audio-file;dur=${lookupMs.toFixed(1)}`,
    'X-Content-Type-Options': 'nosniff',
  };

  if (!req.headers.has('range') && req.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: baseHeaders });
  }

  const range = parseRange(req.headers.get('range'), size);
  if (range === null) {
    return new Response('Range not satisfiable', {
      status: 416,
      headers: { ...baseHeaders, 'Content-Range': `bytes */${size}` },
    });
  }

  // Full file when no Range header was supplied.
  if (range === undefined) {
    // `Readable.toWeb` preserves backpressure. A manual `data` listener puts
    // the Node stream in flowing mode and can buffer an entire file in memory
    // when the client/network consumes the response slowly.
    const body = Readable.toWeb(createReadStream(file)) as ReadableStream;

    return new Response(body, {
      status: 200,
      headers: { ...baseHeaders, 'Content-Length': String(size) },
    });
  }

  // Partial content — this is what the <audio> element uses to seek and to
  // resume after a network hiccup without restarting from byte 0.
  const { start, end } = range;
  const body = Readable.toWeb(
    createReadStream(file, { start, end }),
  ) as ReadableStream;

  return new Response(body, {
    status: 206,
    headers: {
      ...baseHeaders,
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${size}`,
    },
  });
}
