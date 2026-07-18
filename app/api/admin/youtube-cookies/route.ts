import { type NextRequest, NextResponse } from 'next/server';
import { getYoutubeCookiesInfo, setYoutubeCookies } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

function looksLikeYoutubeCookies(text: string): boolean {
  return /(^|\.)youtube\.com[\t ]/i.test(text);
}

export async function GET() {
  return NextResponse.json({ ok: true, ...getYoutubeCookiesInfo() });
}

export async function POST(req: NextRequest) {
  let body: { cookiesText?: unknown; fileName?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Body không hợp lệ (phải là JSON)' },
      { status: 400 },
    );
  }

  const cookiesText =
    typeof body.cookiesText === 'string' ? body.cookiesText.trim() : '';
  const fileName =
    typeof body.fileName === 'string' ? body.fileName.trim() : '';

  if (!cookiesText) {
    return NextResponse.json(
      { ok: false, error: 'File cookies trống' },
      { status: 400 },
    );
  }

  if (!looksLikeYoutubeCookies(cookiesText)) {
    return NextResponse.json(
      { ok: false, error: 'File không giống export cookies youtube.com' },
      { status: 400 },
    );
  }

  const result = setYoutubeCookies(
    fileName || null,
    Buffer.from(cookiesText, 'utf-8').toString('base64'),
  );

  return NextResponse.json({ ok: true, ...result });
}
