import type { NextRequest } from 'next/server';
import { personalErrorResponse, validationError } from '@/lib/api/personal';
import { privateJson, requireSession } from '@/lib/auth/session';
import {
  getUserProfile,
  updateUserProfile,
} from '@/lib/db/postgres/privacy-repository';

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireSession(req.headers);
    return privateJson({ ok: true, profile: await getUserProfile(user.id) });
  } catch (error) {
    return personalErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user } = await requireSession(req.headers);
    const body: unknown = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return validationError('Profile must be an object.');
    const input = body as Record<string, unknown>;
    const values: { name?: string; locale?: string; image?: string | null } =
      {};
    if (typeof input.name === 'string' && input.name.trim())
      values.name = input.name.trim().slice(0, 120);
    if (typeof input.locale === 'string' && input.locale.trim())
      values.locale = input.locale.trim().slice(0, 35);
    if (input.image === null || typeof input.image === 'string')
      values.image = input.image;
    if (Object.keys(values).length === 0)
      return validationError('No supported profile fields supplied.');
    return privateJson({
      ok: true,
      profile: await updateUserProfile(user.id, values),
    });
  } catch (error) {
    return personalErrorResponse(error);
  }
}
