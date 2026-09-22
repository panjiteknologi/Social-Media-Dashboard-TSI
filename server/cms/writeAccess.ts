import pg from 'pg';
import type { AccessCheck } from './access';

/**
 * Publishing needs a second CMS role that may write, unlike the reader. It may
 * insert and update articles and nothing else: no DELETE, no other table, and
 * no access to the contact messages. Rows it writes carry
 * raw_meta.source = 'content-machine', and Content Machine only ever updates
 * those, so an article a person wrote in the CMS cannot be overwritten.
 */

export const CMS_WRITER_ROLE = 'content_machine_writer';

/** Marks the rows Content Machine created, in the CMS's own raw_meta field. */
export const CONTENT_MACHINE_SOURCE = 'content-machine';

/** The columns the writer may fill. Everything else keeps the CMS's default. */
export const CMS_WRITE_COLUMNS = [
  'wordpress_id',
  'title',
  'slug',
  'excerpt',
  'content_html',
  'status',
  'published_at',
  'modified_at',
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
  'raw_meta',
  'created_at',
  'updated_at',
] as const;

/** Reading back what it wrote, and checking whether a slug is free. */
export const CMS_WRITE_READ_COLUMNS = ['id', 'wordpress_id', 'title', 'slug', 'status', 'published_at', 'raw_meta'] as const;

/** The SQL an admin runs once in the Neon SQL Editor, with instructions on top. */
export function writerSetupSql(password: string): string {
  if (!/^[A-Za-z0-9]{24,}$/.test(password)) {
    throw new Error('The writer password must be at least 24 letters and digits.');
  }
  return `-- Content Machine: write access for publishing articles to the CMS
--
-- This file holds a password. It lives in secrets/ (gitignored); delete it
-- once cms:check-write passes.
--
-- What this role may do:
--   * read ${CMS_WRITE_READ_COLUMNS.join(', ')} from blog_posts
--   * insert new articles, and update articles, in blog_posts only
--   * nothing else: no DELETE, no other table, no contact messages
--
-- Content Machine only updates rows whose raw_meta->>'source' is
-- '${CONTENT_MACHINE_SOURCE}', so articles written by people in the CMS are
-- never changed by it.
--
-- 1. Neon Console > the CMS project > SQL Editor, on the production branch and
--    database.
-- 2. Paste everything from "CREATE ROLE" to the end and press Run.
-- 3. Add this line to Content Machine's .env, with the same HOST and DATABASE
--    as CMS_DATABASE_URL:
--
-- CMS_WRITE_DATABASE_URL=postgresql://${CMS_WRITER_ROLE}:${password}@HOST/DATABASE?sslmode=verify-full
--
-- 4. Run: npm run cli -- cms:check-write

-- Created with SQL, so Neon does not make it a member of neon_superuser.
CREATE ROLE ${CMS_WRITER_ROLE} WITH LOGIN PASSWORD '${password}';

DO $$ BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO ${CMS_WRITER_ROLE}', current_database());
END $$;
GRANT USAGE ON SCHEMA public TO ${CMS_WRITER_ROLE};

GRANT SELECT (${CMS_WRITE_READ_COLUMNS.join(', ')})
  ON public.blog_posts TO ${CMS_WRITER_ROLE};

GRANT INSERT (${CMS_WRITE_COLUMNS.join(', ')})
  ON public.blog_posts TO ${CMS_WRITER_ROLE};

GRANT UPDATE (${CMS_WRITE_COLUMNS.join(', ')})
  ON public.blog_posts TO ${CMS_WRITER_ROLE};

-- New articles need an id from the table's own sequence, like the CMS uses.
GRANT USAGE ON SEQUENCE public.blog_posts_id_seq TO ${CMS_WRITER_ROLE};
`;
}

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
 * Proves the writer role can publish articles and do nothing else. Every
 * statement it runs either matches no rows or is expected to be refused, so the
 * check itself never changes CMS data.
 */
export async function checkCmsWriteAccess(connectionString: string): Promise<AccessCheck[]> {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 15_000 });
  await client.connect();
  const checks: AccessCheck[] = [];
  const add = (name: string, ok: boolean, detail?: string) => checks.push({ name, ok, detail });

  try {
    const {
      rows: [role],
    } = await client.query<{ name: string; privileged: boolean; memberships: number }>(`
      SELECT current_user AS name,
             (r.rolsuper OR r.rolcreaterole OR r.rolcreatedb OR r.rolbypassrls) AS privileged,
             (SELECT count(*)::int FROM pg_auth_members m WHERE m.member = r.oid) AS memberships
        FROM pg_roles r WHERE r.rolname = current_user`);
    add('Signed in as the writer role', role.name === CMS_WRITER_ROLE, role.name);
    add('No admin rights and no inherited roles', !role.privileged && role.memberships === 0);

    const { rows: writable } = await client.query<{ name: string }>(`
      SELECT n.nspname || '.' || c.relname AS name
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
         AND n.nspname NOT IN ('pg_catalog', 'information_schema')
         AND (has_table_privilege(c.oid, 'INSERT, UPDATE, DELETE, TRUNCATE')
              OR has_any_column_privilege(c.oid, 'INSERT, UPDATE'))
       ORDER BY 1`);
    add(
      'Only articles are writable',
      writable.length === 1 && writable[0]?.name === 'public.blog_posts',
      writable.map((row) => row.name).join(', ') || 'nothing',
    );

    add('Deleting articles is refused', ...Object.values(await isRefused(client, 'DELETE FROM blog_posts WHERE false')) as [boolean, string]);
    const leads = await isRefused(client, 'SELECT id FROM cms_contact_messages LIMIT 1');
    add('Reading contact messages is refused', leads.ok, leads.detail);

    const { rows: columns } = await client.query<{ column: string; insertable: boolean; updatable: boolean }>(
      `SELECT a.attname AS column,
              has_column_privilege(a.attrelid, a.attnum, 'INSERT') AS insertable,
              has_column_privilege(a.attrelid, a.attnum, 'UPDATE') AS updatable
         FROM pg_attribute a
        WHERE a.attrelid = 'public.blog_posts'::regclass AND a.attnum > 0 AND NOT a.attisdropped`,
    );
    const allowed: readonly string[] = CMS_WRITE_COLUMNS;
    const missing = allowed.filter((column) => !columns.some((row) => row.column === column && row.insertable && row.updatable));
    const extra = columns.filter((row) => (row.insertable || row.updatable) && !allowed.includes(row.column)).map((row) => row.column);
    add('The agreed article columns are writable', missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : undefined);
    add('No other article column is writable', extra.length === 0, extra.length ? `also writable: ${extra.join(', ')}` : undefined);

    const {
      rows: [sequence],
    } = await client.query<{ usable: boolean }>(
      `SELECT has_sequence_privilege('public.blog_posts_id_seq', 'USAGE') AS usable`,
    );
    add('New articles can get an id', sequence.usable);

    const {
      rows: [counts],
    } = await client.query<{ articles: number; ours: number }>(
      `SELECT count(*)::int AS articles,
              count(*) FILTER (WHERE raw_meta->>'source' = $1)::int AS ours
         FROM blog_posts`,
      [CONTENT_MACHINE_SOURCE],
    );
    add('Articles can be read back', true, `${counts.articles} articles, ${counts.ours} written by Content Machine`);
  } finally {
    await client.end();
  }
  return checks;
}
