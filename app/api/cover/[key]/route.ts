import { promises as fs } from 'node:fs';
import type { NextRequest } from 'next/server';
import { FileCacheStore } from '@/lib/cache';

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

  try {
    const stat = await fs.stat(cover.path);

    // TikTok CDN often returns a 3.2KB black image for hotlink protection
    // which our backend might have successfully cached. If the cover is
    // suspiciously small, reject it so the frontend falls back to the gradient.
    if (stat.size < 4000) {
      return new Response('Invalid cover (too small)', { status: 404 });
    }

    const buffer = await fs.readFile(cover.path);

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': cover.contentType,
        'Content-Length': String(stat.size),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('Internal error reading file', { status: 500 });
  }
}
