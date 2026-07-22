import { createReadStream, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { NextRequest } from 'next/server';
import { getCacheDir } from '@/lib/cache';
import { isMediaBlocked } from '@/lib/db/queries';

// Audio files live on disk and are streamed; Node runtime required.
export const runtime = 'nodejs';

// Cache keys are 64-char hex (sha256). Reject anything else to avoid path abuse.
const KEY_RE = /^[a-f0-9]{64}$/;

// Parse a single-range "bytes=start-end" / "bytes=start-" header. Returns
// {start, end} inclusive byte offsets, or null if unparseable.
function parseRange(header: string | null, size: number) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const start = match[1] ? Number(match[1]) : null;
  const end = match[2] ? Number(match[2]) : null;
  if (start == null && end == null) return null;
  // "bytes=-N" → last N bytes.
  if (start == null) {
    const s = Math.max(0, size - (end ?? 0));
    return { start: s, end: size - 1 };
  }
  if (start >= size) return null;
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

  const file = join(getCacheDir(), `${key}.m4a`);
  if (!existsSync(file)) {
    return new Response('Not found', { status: 404 });
  }

  const stat = statSync(file);
  const size = stat.size;

  const range = parseRange(req.headers.get('range'), size);

  // Full file (no Range header, or an unsatisfiable range we let the browser
  // restart from the top).
  if (!range) {
    const stream = createReadStream(file);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk as Buffer));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      },
      cancel() {
        stream.destroy();
      },
    });

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mp4',
        'Content-Length': String(size),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, no-store',
      },
    });
  }

  // Partial content — this is what the <audio> element uses to seek and to
  // resume after a network hiccup without restarting from byte 0.
  const { start, end } = range;
  const stream = createReadStream(file, { start, end });
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on('data', (chunk) => controller.enqueue(chunk as Buffer));
      stream.on('end', () => controller.close());
      stream.on('error', (err) => controller.error(err));
    },
    cancel() {
      stream.destroy();
    },
  });

  return new Response(body, {
    status: 206,
    headers: {
      'Content-Type': 'audio/mp4',
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, no-store',
    },
  });
}
