/**
 * Local development database: a real Postgres run from an npm package, so no
 * system install or Docker is needed. It uses the user, password, port and
 * database name from DATABASE_URL. Production uses the Postgres container.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { getEnv } from '../env';

const url = new URL(getEnv().DATABASE_URL);
const databaseDir = path.resolve('.data/postgres');
const database = decodeURIComponent(url.pathname.slice(1));
const port = Number(url.port || 5432);

const postgres = new EmbeddedPostgres({
  databaseDir,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  port,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--no-locale'],
  onLog: () => {},
});

if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) {
  console.log('Initialising local Postgres in .data/postgres');
  await postgres.initialise();
}

await postgres.start();

try {
  await postgres.createDatabase(database);
} catch (error) {
  if (!String(error).includes('already exists')) throw error;
}

console.log(`Local Postgres ready on port ${port}, database "${database}"`);

async function shutdown() {
  await postgres.stop();
  process.exit(0);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
