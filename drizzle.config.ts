import { defineConfig } from 'drizzle-kit';

function getMigrationDatabaseUrl(): string {
  const databaseUrl =
    process.env.DATABASE_MIGRATION_URL?.trim() ||
    process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error(
      'Drizzle migration tooling requires DATABASE_MIGRATION_URL or DATABASE_URL.',
    );
  }

  return databaseUrl;
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/postgres/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: getMigrationDatabaseUrl(),
  },
  migrations: {
    table: '__drizzle_migrations',
    schema: 'public',
  },
  strict: true,
  verbose: true,
});
