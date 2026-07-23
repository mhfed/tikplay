import type { NextRequest } from 'next/server';
import { personalErrorResponse, validationError } from '@/lib/api/personal';
import { privateJson, requireSession } from '@/lib/auth/session';
import { preferencesRepository } from '@/lib/db/postgres/repositories';

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireSession(req.headers);
    return privateJson({
      ok: true,
      preferences: await preferencesRepository.get(user.id),
    });
  } catch (error) {
    return personalErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user } = await requireSession(req.headers);
    const body: unknown = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return validationError('Preferences must be an object.');
    }
    const input = body as Record<string, unknown>;
    const values: Record<string, unknown> = {};
    if (typeof input.personalizationEnabled === 'boolean')
      values.personalizationEnabled = input.personalizationEnabled;
    if (typeof input.explicitContentAllowed === 'boolean')
      values.explicitContentAllowed = input.explicitContentAllowed;
    if (
      Array.isArray(input.selectedMoods) &&
      input.selectedMoods.every((v) => typeof v === 'string')
    )
      values.selectedMoods = input.selectedMoods;
    if (
      Array.isArray(input.useCases) &&
      input.useCases.every((v) => typeof v === 'string')
    )
      values.useCases = input.useCases;
    if (Object.keys(values).length === 0)
      return validationError('No supported preferences supplied.');
    return privateJson({
      ok: true,
      preferences: await preferencesRepository.update(user.id, values),
    });
  } catch (error) {
    return personalErrorResponse(error);
  }
}
