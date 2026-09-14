import { describe, expect, it } from 'vitest';
import { CMS_LEAD_COLUMNS, CMS_READER_ROLE, generateReaderPassword, readerSetupSql } from './access';

describe('generateReaderPassword', () => {
  it('makes 32 letters and digits, different each time', () => {
    const first = generateReaderPassword();
    expect(first).toMatch(/^[A-Za-z0-9]{32}$/);
    expect(generateReaderPassword()).not.toBe(first);
  });
});

describe('readerSetupSql', () => {
  const password = generateReaderPassword();
  const sql = readerSetupSql(password);

  it('creates a read-only login role with the password', () => {
    expect(sql).toContain(`CREATE ROLE ${CMS_READER_ROLE} WITH LOGIN PASSWORD '${password}';`);
    expect(sql).toContain('SET default_transaction_read_only = on');
  });

  it('grants column SELECT on articles and leads only', () => {
    expect(sql.match(/^GRANT SELECT \(/gm)).toHaveLength(2);
    expect(sql).toContain('ON public.blog_posts TO');
    expect(sql).toContain(`GRANT SELECT (${CMS_LEAD_COLUMNS.join(', ')})\n  ON public.cms_contact_messages`);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE|ALL)/);
  });

  it('never grants the columns that identify a person', () => {
    const granted = [...sql.matchAll(/^GRANT SELECT \(([^)]*)\)/gm)].flatMap((match) => match[1].split(', '));
    for (const column of ['full_name', 'company_name', 'job_title', 'email', 'phone', 'message', 'internal_notes']) {
      expect(granted).not.toContain(column);
    }
  });

  it('includes the connection line to copy into .env', () => {
    expect(sql).toContain(`CMS_DATABASE_URL=postgresql://${CMS_READER_ROLE}:${password}@HOST/DATABASE?sslmode=verify-full`);
  });

  it('refuses a password that could break out of the SQL string', () => {
    expect(() => readerSetupSql("short'; DROP ROLE x; --")).toThrow();
  });
});
