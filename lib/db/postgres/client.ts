import 'server-only';

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const DEFAULT_POOL_MAX = 5;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_CONNECTION_TIMEOUT_MS = 5_000;

interface PostgresRuntime {
  pool: Pool;
  db: NodePgDatabase<typeof schema>;
}

let runtime: PostgresRuntime | undefined;

function readBoundedInteger(
  name: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) {
    return defaultValue;
  }

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}.`,
    );
  }

  return value;
}

function createRuntime(): PostgresRuntime {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error('PostgreSQL runtime access requires DATABASE_URL.');
  }

  const pool = new Pool({
    connectionString,
    max: readBoundedInteger('DATABASE_POOL_MAX', DEFAULT_POOL_MAX, 1, 20),
    idleTimeoutMillis: readBoundedInteger(
      'DATABASE_POOL_IDLE_TIMEOUT_MS',
      DEFAULT_IDLE_TIMEOUT_MS,
      1_000,
      300_000,
    ),
    connectionTimeoutMillis: readBoundedInteger(
      'DATABASE_POOL_CONNECTION_TIMEOUT_MS',
      DEFAULT_CONNECTION_TIMEOUT_MS,
      1_000,
      60_000,
    ),
    allowExitOnIdle: process.env.NODE_ENV === 'test',
  });

  pool.on('error', (error) => {
    console.error('Unexpected idle PostgreSQL client error.', error);
  });

  return {
    pool,
    db: drizzle({ client: pool, schema }),
  };
}

function getRuntime(): PostgresRuntime {
  runtime ??= createRuntime();
  return runtime;
}

export function getPostgresPool(): Pool {
  return getRuntime().pool;
}

export function getPostgresDb(): NodePgDatabase<typeof schema> {
  return getRuntime().db;
}

export async function closePostgres(): Promise<void> {
  const activeRuntime = runtime;
  runtime = undefined;
  if (activeRuntime) {
    await activeRuntime.pool.end();
  }
}
