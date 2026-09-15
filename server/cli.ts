/**
 * Operator commands, run with `npm run cli -- <command>`:
 *
 *   user:add <email> <role> [name]   add a user, or update and reactivate one
 *   user:list                        list users
 *   user:deactivate <email>          block a user and end their sessions
 *   job:run <name> [input-json]      queue a job to run now
 *   telegram:chats                   show the chat IDs the bot can see
 *   telegram:test                    send a test alert to TELEGRAM_CHAT_ID
 *   cms:grant-sql                    write the SQL that creates the CMS read-only role
 *   cms:check                        prove CMS_DATABASE_URL is read-only and limited
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { USER_ROLES, type UserRole } from '../shared/api';
import { checkCmsAccess, generateReaderPassword, readerSetupSql } from './cms/access';
import { createDb, runMigrations, waitForDatabase } from './db/client';
import { sessions, users } from './db/schema';
import { getEnv } from './env';
import type { JobEnvelope } from './jobs/job';
import { createBoss, ensureQueues } from './jobs/queue';
import { createJobs } from './jobs/registry';
import { applyOverrides, getJobOverrides } from './jobs/settings';
import { findTelegramChats, sendTelegramMessage } from './notify/telegram';

const USAGE = `Usage:
  npm run cli -- user:add <email> <${USER_ROLES.join('|')}> [name]
  npm run cli -- user:list
  npm run cli -- user:deactivate <email>
  npm run cli -- job:run <name> [input-json]
  npm run cli -- telegram:chats
  npm run cli -- telegram:test
  npm run cli -- cms:grant-sql
  npm run cli -- cms:check`;

const CMS_SQL_PATH = 'secrets/cms-reader.sql';

const env = getEnv();
// The pool connects lazily, so commands that never query do not need Postgres running.
const { db, pool } = createDb(env.DATABASE_URL);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function addUser([email, role, ...nameParts]: string[]) {
  if (!email || !USER_ROLES.includes(role as UserRole)) fail(USAGE);
  const name = nameParts.join(' ') || null;
  const normalizedEmail = email.toLowerCase();

  await db
    .insert(users)
    .values({ email: normalizedEmail, role: role as UserRole, name, active: true })
    .onConflictDoUpdate({
      target: users.email,
      set: { role: role as UserRole, active: true, ...(name ? { name } : {}) },
    });
  console.log(`${normalizedEmail} can now sign in as ${role}.`);
}

async function listUsers() {
  const rows = await db
    .select({
      email: users.email,
      name: users.name,
      role: users.role,
      active: users.active,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .orderBy(users.email);
  console.table(rows);
}

async function deactivateUser([email]: string[]) {
  if (!email) fail(USAGE);
  const [user] = await db
    .update(users)
    .set({ active: false })
    .where(eq(users.email, email.toLowerCase()))
    .returning({ id: users.id });
  if (!user) fail(`No user with email ${email}.`);
  await db.delete(sessions).where(eq(sessions.userId, user.id));
  console.log(`${email} can no longer sign in; their sessions have ended.`);
}

async function runJob([name, inputJson]: string[]) {
  const jobs = createJobs({ db, env });
  const job = jobs.find((candidate) => candidate.name === name);
  if (!job) fail(`Unknown job "${name}". Known jobs: ${jobs.map((j) => j.name).join(', ')}`);

  let input: unknown = null;
  if (inputJson) {
    try {
      input = JSON.parse(inputJson);
    } catch {
      fail('The job input must be valid JSON.');
    }
  }

  const boss = createBoss(env.DATABASE_URL, 'cli');
  await boss.start();
  try {
    await ensureQueues(boss, applyOverrides([job], await getJobOverrides(db)));
    const envelope: JobEnvelope = { trigger: 'manual', input };
    const queueJobId = await boss.send(job.name, envelope);
    console.log(`Queued ${job.name} (${queueJobId}). The worker picks it up within seconds.`);
  } finally {
    await boss.stop({ graceful: false });
  }
}

async function listTelegramChats() {
  if (!env.TELEGRAM_BOT_TOKEN) fail('Set TELEGRAM_BOT_TOKEN in .env first.');
  const chats = await findTelegramChats(env.TELEGRAM_BOT_TOKEN);
  if (chats.length === 0) {
    fail(
      'The bot has not seen any chat in the last 24 hours. Send a message that mentions the bot ' +
        'in the group (for example /start@YourBot), then run this again.',
    );
  }
  console.table(chats);
  console.log('Copy the id of the group into TELEGRAM_CHAT_ID in .env (including the minus sign).');
}

async function sendTelegramTest() {
  const { TELEGRAM_BOT_TOKEN: botToken, TELEGRAM_CHAT_ID: chatId } = env;
  if (!botToken || !chatId) fail('Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env first.');
  await sendTelegramMessage(
    { botToken, chatId },
    'Content Machine\nTest message: alerts and reports will arrive in this chat.',
  );
  console.log('Sent. Check the Telegram group.');
}

function writeCmsGrantSql() {
  if (existsSync(CMS_SQL_PATH)) {
    fail(`${CMS_SQL_PATH} already exists. Use it, or delete it first to get a new password.`);
  }
  mkdirSync('secrets', { recursive: true });
  writeFileSync(CMS_SQL_PATH, readerSetupSql(generateReaderPassword()), { mode: 0o600 });
  console.log(`Wrote ${CMS_SQL_PATH}. Open it and follow the steps at the top; the password exists only there.`);
}

async function checkCms() {
  if (!env.CMS_DATABASE_URL) fail('Set CMS_DATABASE_URL in .env first.');
  const checks = await checkCmsAccess(env.CMS_DATABASE_URL);
  for (const check of checks) {
    console.log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.name}${check.detail ? ` (${check.detail})` : ''}`);
  }
  if (checks.some((check) => !check.ok)) fail('\nCMS access is not ready: fix the FAIL lines above.');
  console.log('\nCMS access is read-only and limited to the agreed columns.');
}

async function runDatabaseCommand(name: string | undefined, args: string[]) {
  await waitForDatabase(pool, { attempts: 5 });
  await runMigrations(db, pool);
  switch (name) {
    case 'user:add':
      return addUser(args);
    case 'user:list':
      return listUsers();
    case 'user:deactivate':
      return deactivateUser(args);
    case 'job:run':
      return runJob(args);
    default:
      fail(USAGE);
  }
}

const [command, ...args] = process.argv.slice(2);

try {
  if (command === 'telegram:chats') await listTelegramChats();
  else if (command === 'telegram:test') await sendTelegramTest();
  else if (command === 'cms:grant-sql') writeCmsGrantSql();
  else if (command === 'cms:check') await checkCms();
  else await runDatabaseCommand(command, args);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await pool.end();
}
