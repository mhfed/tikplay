import { type NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import {
  enforceMutationOrigin,
  errorResponse,
  hasOnlyKeys,
  readJsonObject,
  unauthorizedResponse,
} from '@/lib/apiSecurity';
import { getYoutubeCookiesInfo, setYoutubeCookies } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

const MAX_COOKIE_BODY_BYTES = 512 * 1024;
const MAX_FILE_NAME_LENGTH = 120;

function isYoutubeDomain(domain: string): boolean {
  const normalized = domain.trim().toLowerCase().replace(/^\./, '');
  return normalized === 'youtube.com' || normalized.endsWith('.youtube.com');
}

function looksLikeYoutubeCookies(text: string): boolean {
  return text.split(/\r?\n/).some((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return false;
    const fields = trimmed.split('\t');
    return fields.length >= 7 && isYoutubeDomain(fields[0]);
  });
}

function validFileName(fileName: string): boolean {
  return (
    fileName.length <= MAX_FILE_NAME_LENGTH &&
    !fileName.includes('/') &&
    !fileName.includes('\\') &&
    !fileName.includes('..') &&
    /^[\p{L}\p{N}._ -]+$/u.test(fileName)
  );
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  return NextResponse.json({ ok: true, ...getYoutubeCookiesInfo() });
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorizedResponse();

  const originError = enforceMutationOrigin(request);
  if (originError) return originError;

  const parsed = await readJsonObject(request, MAX_COOKIE_BODY_BYTES);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  if (!hasOnlyKeys(body, ['cookiesText', 'fileName'])) {
    return errorResponse(
      400,
      'Nội dung yêu cầu có trường không hợp lệ',
      'INVALID_BODY',
    );
  }

  if (typeof body.cookiesText !== 'string') {
    return errorResponse(400, 'File cookies không hợp lệ', 'INVALID_COOKIES');
  }
  const cookiesText = body.cookiesText.trim();
  if (!cookiesText) {
    return errorResponse(400, 'File cookies trống', 'INVALID_COOKIES');
  }
  if (!looksLikeYoutubeCookies(cookiesText)) {
    return errorResponse(
      400,
      'File không giống export cookies cho miền YouTube',
      'INVALID_COOKIES',
    );
  }

  if (body.fileName !== undefined && typeof body.fileName !== 'string') {
    return errorResponse(400, 'Tên file không hợp lệ', 'INVALID_FILE_NAME');
  }
  const fileName =
    typeof body.fileName === 'string' ? body.fileName.trim() : '';
  if (fileName && !validFileName(fileName)) {
    return errorResponse(400, 'Tên file không hợp lệ', 'INVALID_FILE_NAME');
  }

  const result = setYoutubeCookies(
    fileName || null,
    Buffer.from(cookiesText, 'utf8').toString('base64'),
  );
  return NextResponse.json({ ok: true, ...result });
}
