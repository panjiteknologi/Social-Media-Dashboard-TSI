import { randomInt } from 'node:crypto';
import pg from 'pg';

/**
 * Content Machine reads the CMS database (Neon) with its own role, limited to
 * SELECT on the columns below. The CMS and the website are not changed.
 */

export const CMS_READER_ROLE = 'content_machine_reader';

/** Articles: what the website shows plus the SEO fields. WordPress leftovers are left out. */
export const CMS_ARTICLE_COLUMNS = [
  'id',
  'title',
  'slug',
  'excerpt',
  'content_html',
  'published_at',
  'modified_at',
  'status',
  'author_name',
  'featured_image_url',
  'image_urls',
  'image_alt_text',
  'categories',
  'tags',
  'reading_time_minutes',
  'seo_title',
  'seo_description',
  'seo_focus_keyword',
  'created_at',
  'updated_at',
] as const;

/** Leads: enough to count them by service, page, language and status, nothing that identifies a person. */
export const CMS_LEAD_COLUMNS = [
  'id',
  'service_inquiry',
  'language',
  'source_page',
  'status',
  'created_at',
  'updated_at',
] as const;

const GRANTS = [
  { table: 'blog_posts', columns: CMS_ARTICLE_COLUMNS },
  { table: 'cms_contact_messages', columns: CMS_LEAD_COLUMNS },
] as const;

const PASSWORD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** 32 letters and digits (about 190 bits): far above Neon's 60-bit minimum, and safe in a URL unescaped. */
export function generateReaderPassword(length = 32): string {
  return Array.from({ length }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join('');
}

/** The SQL an admin runs once in the Neon SQL Editor, with instructions on top. */
export function readerSetupSql(password: string): string {
  if (!/^[A-Za-z0-9]{24,}$/.test(password)) {
    throw new Error('The reader password must be at least 24 letters and digits.');
  }
  const grants = GRANTS.map(
    ({ table, columns }) => `GRANT SELECT (${columns.join(', ')})\n  ON public.${table} TO ${CMS_READER_ROLE};`,
  );

  return `-- Content Machine: read-only access to the CMS database
--
-- This file holds a password. It lives in secrets/ (gitignored); delete it
-- once cms:check passes.
--
-- 1. Neon Console > the CMS project > SQL Editor. At the top, pick the branch
--    and database the CMS uses in production.
-- 2. Paste everything from "CREATE ROLE" to the end and press Run.
-- 3. Neon Console > Connect: note the host (after @, ends in neon.tech) and the
--    database name. Add this line to Content Machine's .env, replacing HOST and
--    DATABASE:
--
-- CMS_DATABASE_URL=postgresql://${CMS_READER_ROLE}:${password}@HOST/DATABASE?sslmode=verify-full
--
-- 4. Run: npm run cli -- cms:check

-- Created with SQL, so Neon does not make it a member of neon_superuser.
CREATE ROLE ${CMS_READER_ROLE} WITH LOGIN PASSWORD '${password}';
ALTER ROLE ${CMS_READER_ROLE} SET default_transaction_read_only = on;

DO $$ BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO ${CMS_READER_ROLE}', current_database());
END $$;
GRANT USAGE ON SCHEMA public TO ${CMS_READER_ROLE};

-- Articles, and lead counts without contact details.
${grants.join('\n\n')}
`;
}

export interface AccessCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

/** Tables and views outside Postgres's own schemas and extensions. */
const APP_RELATIONS = `
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
    AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    AND n.nspname NOT LIKE 'pg_toast%'
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')`;

/** Permission denied, or refused because the transaction is read-only. */
const REFUSED_CODES = new Set(['42501', '25006']);

async function isRefused(client: pg.Client, sql: string): Promise<{ ok: boolean; detail: string }> {
  try {
    await client.query(sql);
    return { ok: false, detail: 'the database allowed it' };
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (REFUSED_CODES.has(code)) return { ok: true, detail: 'refused' };
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Proves the connection is the reader role, read-only, and sees exactly the
 * agreed columns. Nothing it runs can change data: the one write attempt
 * matches no rows even if it were allowed.
 */
export async function checkCmsAccess(connectionString: string): Promise<AccessCheck[]> {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 15_000 });
  await client.connect();
  const checks: AccessCheck[] = [];
  const add = (name: string, ok: boolean, detail?: string) => checks.push({ name, ok, detail });

  try {
    const {
      rows: [role],
    } = await client.query<{
      name: string;
      privileged: boolean;
      memberships: number;
      readOnly: string;
    }>(`
      SELECT current_user AS name,
             (r.rolsuper OR r.rolcreaterole OR r.rolcreatedb OR r.rolbypassrls) AS privileged,
             (SELECT count(*)::int FROM pg_auth_members m WHERE m.member = r.oid) AS memberships,
             current_setting('default_transaction_read_only') AS "readOnly"
      FROM pg_roles r WHERE r.rolname = current_user`);

    add('Signed in as the reader role', role.name === CMS_READER_ROLE, role.name);
    add(
      'No admin rights and no inherited roles',
      !role.privileged && role.memberships === 0,
      role.memberships > 0 ? `member of ${role.memberships} role(s), e.g. neon_superuser` : undefined,
    );
    add('Read-only by default', role.readOnly === 'on');

    const { rows: readable } = await client.query<{ name: string }>(
      `SELECT n.nspname || '.' || c.relname AS name ${APP_RELATIONS}
         AND has_any_column_privilege(c.oid, 'SELECT') ORDER BY 1`,
    );
    const expected = GRANTS.map(({ table }) => `public.${table}`);
    const extra = readable.map((r) => r.name).filter((name) => !expected.includes(name));
    add(
      'Only articles and leads are readable',
      extra.length === 0 && expected.every((name) => readable.some((r) => r.name === name)),
      extra.length > 0 ? `also readable: ${extra.join(', ')}` : readable.map((r) => r.name).join(', '),
    );

    for (const { table, columns } of GRANTS) {
      const { rows } = await client.query<{ column: string; readable: boolean }>(
        `SELECT a.attname AS column, has_column_privilege(a.attrelid, a.attnum, 'SELECT') AS readable
           FROM pg_attribute a
          WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped`,
        [`public.${table}`],
      );
      const allowed: readonly string[] = columns;
      const missing = allowed.filter((column) => !rows.some((r) => r.column === column && r.readable));
      const leaked = rows.filter((r) => r.readable && !allowed.includes(r.column)).map((r) => r.column);
      add(`${table}: agreed columns readable`, missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : undefined);
      add(
        `${table}: every other column withheld`,
        leaked.length === 0,
        leaked.length ? `also readable: ${leaked.join(', ')}` : `${rows.length - allowed.length} withheld`,
      );
    }

    const {
      rows: [counts],
    } = await client.query<{ published: number; articles: number; leads: number }>(`
      SELECT (SELECT count(*)::int FROM blog_posts WHERE status = 'publish') AS published,
             (SELECT count(*)::int FROM blog_posts) AS articles,
             (SELECT count(*)::int FROM cms_contact_messages) AS leads`);
    add('Articles and leads can be counted', true, `${counts.published} published of ${counts.articles} articles, ${counts.leads} leads`);

    const email = await isRefused(client, 'SELECT email FROM cms_contact_messages LIMIT 1');
    add('Reading a lead email is refused', email.ok, email.detail);

    const {
      rows: [writable],
    } = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count ${APP_RELATIONS}
         AND (has_table_privilege(c.oid, 'INSERT, UPDATE, DELETE, TRUNCATE')
              OR has_any_column_privilege(c.oid, 'INSERT, UPDATE'))`,
    );
    const update = await isRefused(client, 'UPDATE blog_posts SET title = title WHERE false');
    add(
      'Writing is refused',
      writable.count === 0 && update.ok,
      writable.count > 0 ? `write access to ${writable.count} table(s)` : update.detail,
    );
  } finally {
    await client.end();
  }
  return checks;
}
