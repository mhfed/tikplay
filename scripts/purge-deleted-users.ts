import { and, isNotNull, lt } from 'drizzle-orm';
import { getPostgresDb } from '@/lib/db/postgres/client';
import { purgeUser } from '@/lib/db/postgres/privacy-repository';
import { users } from '@/lib/db/postgres/schema';

const candidates = await getPostgresDb()
  .select({ id: users.id })
  .from(users)
  .where(and(isNotNull(users.purgeAfter), lt(users.purgeAfter, new Date())));

let purged = 0;
for (const candidate of candidates) {
  if (await purgeUser(candidate.id)) purged += 1;
}
console.log(JSON.stringify({ candidates: candidates.length, purged }));
