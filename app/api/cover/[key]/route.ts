import { createReadStream, statSync } from 'node:fs';
import type { NextRequest } from 'next/server';
import { FileCacheStore } from '@/lib/cache';

// Cover files live on disk and are streamed; Node runtime required.
export const runtime = 'nodejs';

// Cache keys are 64-char hex (sha256). Reject anything else to avoid path abuse.
const KEY_RE = /^[a-f0-9]{64}$/;

const cache = new FileCacheStore();

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ key: string }> },
) {
  const params = await props.params;
  const key = params.key;

  if (!KEY_RE.test(key)) {
    return new Response('Bad key', { status: 400 });
  }

  const cover = cache.getCover(key);
  if (!cover) {
    return new Response('Not found', { status: 404 });
  }

  const stat = statSync(cover.path);
  const stream = createReadStream(cover.path);

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
      'Content-Type': cover.contentType,
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
