import { createReadStream, promises as fs } from 'node:fs';
import type { NextRequest } from 'next/server';
import { FileCacheStore } from '@/lib/cache';
import { isMediaBlocked } from '@/lib/db/queries';

export const runtime = 'nodejs';

// Cache keys are hex (MD5/SHA256). Reject anything else to avoid path abuse.
const KEY_RE = /^[a-f0-9]{32,64}$/;

const cache = new FileCacheStore();
const IMMUTABLE_MEDIA_CACHE = 'public, max-age=31536000, immutable';

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

  const cover = cache.getCover(key);
  if (!cover) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const stat = await fs.stat(cover.path);

    // TikTok CDN often returns a 3.2KB black image for hotlink protection
    // which our backend might have successfully cached. If the cover is
    // suspiciously small, reject it so the frontend falls back to the gradient.
    if (stat.size < 4000) {
      return new Response('Invalid cover (too small)', { status: 404 });
    }

    const etag = `"${key}"`;
    const headers = {
      'Cache-Control': IMMUTABLE_MEDIA_CACHE,
      'Content-Length': String(stat.size),
      'Content-Type': cover.contentType,
      ETag: etag,
      'X-Content-Type-Options': 'nosniff',
    };
    if (req.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304, headers });
    }

    const stream = createReadStream(cover.path);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk as Buffer));
        stream.on('end', () => controller.close());
        stream.on('error', (error) => controller.error(error));
      },
      cancel() {
        stream.destroy();
      },
    });

    return new Response(body, { status: 200, headers });
  } catch {
    return new Response('Internal error reading file', { status: 500 });
  }
}
