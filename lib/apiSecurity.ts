import { type NextRequest, NextResponse } from 'next/server';

export type JsonObject = Record<string, unknown>;

type JsonResult =
  | { ok: true; value: JsonObject }
  | { ok: false; response: NextResponse };

export function errorResponse(
  status: number,
  error: string,
  code?: string,
): NextResponse {
  return NextResponse.json(
    { ok: false, error, ...(code ? { code } : {}) },
    { status },
  );
}

export function unauthorizedResponse(): NextResponse {
  return errorResponse(401, 'Không có quyền quản trị', 'UNAUTHORIZED');
}

export function enforceMutationOrigin(
  request: NextRequest,
): NextResponse | null {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) return null;

  const origin = request.headers.get('origin');
  if (!origin) return null;

  try {
    if (new URL(origin).origin === request.nextUrl.origin) return null;
  } catch {
    // Invalid origins are rejected below.
  }

  return errorResponse(403, 'Nguồn yêu cầu không hợp lệ', 'INVALID_ORIGIN');
}

export async function readJsonObject(
  request: NextRequest,
  maxBytes: number,
): Promise<JsonResult> {
  const contentType = request.headers.get('content-type');
  if (
    !contentType ||
    contentType.split(';', 1)[0].trim() !== 'application/json'
  ) {
    return {
      ok: false,
      response: errorResponse(
        415,
        'Content-Type phải là application/json',
        'UNSUPPORTED_MEDIA_TYPE',
      ),
    };
  }

  const declaredLength = request.headers.get('content-length');
  if (declaredLength) {
    const length = Number(declaredLength);
    if (!Number.isInteger(length) || length < 0 || length > maxBytes) {
      return {
        ok: false,
        response: errorResponse(
          413,
          'Nội dung yêu cầu quá lớn',
          'PAYLOAD_TOO_LARGE',
        ),
      };
    }
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return {
      ok: false,
      response: errorResponse(
        400,
        'Không thể đọc nội dung yêu cầu',
        'INVALID_BODY',
      ),
    };
  }

  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    return {
      ok: false,
      response: errorResponse(
        413,
        'Nội dung yêu cầu quá lớn',
        'PAYLOAD_TOO_LARGE',
      ),
    };
  }

  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('JSON body must be an object');
    }
    return { ok: true, value: value as JsonObject };
  } catch {
    return {
      ok: false,
      response: errorResponse(
        400,
        'Body không hợp lệ (phải là JSON object)',
        'INVALID_BODY',
      ),
    };
  }
}

export function hasOnlyKeys(body: JsonObject, allowedKeys: string[]): boolean {
  const allowed = new Set(allowedKeys);
  return Object.keys(body).every((key) => allowed.has(key));
}
