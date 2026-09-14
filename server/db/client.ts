import path from 'node:path';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import type { Pool } from 'pg';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

/** Arbitrary but fixed, so every process contends for the same lock. */
const MIGRATION_LOCK_ID = 727_001;

export function createDb(connectionString: string): { db: Db; pool: Pool } {
  const pool = new pg.Pool({ connectionString, max: 10 });
  const db = drizzle({ client: pool, schema, casing: 'snake_case' });
  return { db, pool };
}

/**
 * Waits for Postgres to accept connections. The database starts alongside the
 * app both in development and in the containers, so it may not be up yet.
 */
export async function waitForDatabase(
  pool: Pool,
  { attempts = 60, delayMs = 1000 } = {},
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (error) {
      if (attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Applies pending migrations. The API and the worker both run this on start;
 * the advisory lock makes the second one wait, then find nothing left to do.
 */
export async function runMigrations(db: Db, pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    try {
      await migrate(db, { migrationsFolder: path.resolve('server/db/migrations') });
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
    }
  } finally {
    client.release();
  }
}
