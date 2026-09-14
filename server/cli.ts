/**
 * Operator commands, run with `npm run cli -- <command>`:
 *
 *   user:add <email> <role> [name]   add a user, or update and reactivate one
 *   user:list                        list users
 *   user:deactivate <email>          block a user and end their sessions
 *   job:run <name> [input-json]      queue a job to run now
 *   telegram:chats                   show the chat IDs the bot can see
 *   telegram:test                    send a test alert to TELEGRAM_CHAT_ID
 */
import { eq } from 'drizzle-orm';
import { USER_ROLES, type UserRole } from '../shared/api';
import { createDb, runMigrations, waitForDatabase } from './db/client';
import { sessions, users } from './db/schema';
import { getEnv } from './env';
import type { JobEnvelope } from './jobs/job';
import { createBoss, ensureQueues } from './jobs/queue';
import { createJobs } from './jobs/registry';
import { findTelegramChats, sendTelegramMessage } from './notify/telegram';

const USAGE = `Usage:
  npm run cli -- user:add <email> <${USER_ROLES.join('|')}> [name]
  npm run cli -- user:list
  npm run cli -- user:deactivate <email>
  npm run cli -- job:run <name> [input-json]
  npm run cli -- telegram:chats
  npm run cli -- telegram:test`;

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
  const jobs = createJobs(db);
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
    await ensureQueues(boss, [job]);
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
  else await runDatabaseCommand(command, args);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await pool.end();
}
