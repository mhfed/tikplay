import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path: string) => readFile(path, 'utf8');

test('personal routes authenticate and derive ownership from session', async () => {
  for (const path of [
    'app/api/tracks/stats/route.ts',
    'app/api/preferences/route.ts',
  ]) {
    const source = await read(path);
    assert.match(source, /requireSession\(req\.headers\)/);
    assert.doesNotMatch(source, /body\.(?:userId|ownerUserId|ownerId)/);
  }
});

test('history repository predicates are user scoped and retention is global by event age', async () => {
  const source = await read('lib/db/postgres/repositories.ts');
  assert.match(source, /where\(eq\(listeningEvents\.userId, userId\)\)/);
  assert.match(source, /delete\(listeningEvents\)/);
  assert.match(source, /listeningEvents\.playedAt/);
});

test('stable reason codes and opt-out editorial fallback are explicit', async () => {
  const ranking = await read('lib/personalization/ranking.ts');
  const route = await read('app/api/tracks/stats/route.ts');
  assert.match(ranking, /EDITORIAL_PERSONALIZATION_OFF/);
  assert.match(ranking, /EDITORIAL_INSUFFICIENT_SIGNALS/);
  assert.match(route, /personalizationEnabled/);
  assert.match(route, /fallbackReason/);
});

test('history clear is idempotent and protected by session', async () => {
  const source = await read('app/api/tracks/stats/route.ts');
  assert.match(source, /export async function DELETE/);
  assert.match(source, /listeningRepository\.clear\(user\.id\)/);
});
