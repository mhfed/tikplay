import { listeningRepository } from '../lib/db/postgres/repositories';

const retentionDays = Number(process.env.LISTENING_RETENTION_DAYS ?? 180);
if (
  !Number.isSafeInteger(retentionDays) ||
  retentionDays < 1 ||
  retentionDays > 3650
) {
  throw new Error(
    'LISTENING_RETENTION_DAYS must be an integer from 1 to 3650.',
  );
}
const deleted = await listeningRepository.purgeExpired(retentionDays);
console.log(
  JSON.stringify({ ok: true, retentionDays, deletedCount: deleted.length }),
);
