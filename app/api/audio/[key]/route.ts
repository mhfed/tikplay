import { createReadStream, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { NextRequest } from 'next/server';
import { getCacheDir } from '@/lib/cache';

// Audio files live on disk and are streamed; Node runtime required.
export const runtime = 'nodejs';

// Cache keys are 64-char hex (sha256). Reject anything else to avoid path abuse.
const KEY_RE = /^[a-f0-9]{64}$/;

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ key: string }> },
) {
  const params = await props.params;
  const key = params.key;

  if (!KEY_RE.test(key)) {
    return new Response('Bad key', { status: 400 });
  }

  const file = join(getCacheDir(), `${key}.m4a`);
  if (!existsSync(file)) {
    return new Response('Not found', { status: 404 });
  }

  const stat = statSync(file);
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
      'Content-Length': String(stat.size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
