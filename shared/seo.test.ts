import { describe, expect, it } from 'vitest';
import {
  addDays,
  bucketSeries,
  classifyKeyword,
  clipWindow,
  clusterOf,
  combineTotals,
  competingPages,
  daysBetween,
  isBrandQuery,
  opportunityScore,
  positionBand,
  positionMovement,
  serpPage,
  standardOf,
  windowEnding,
} from './seo';

const BRAND = ['tsi', 'tsicertification'];

describe('dates', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(daysBetween('2026-05-07', '2026-09-12')).toBe(128);
  });

  it('builds a window and the equally long one before it', () => {
    expect(windowEnding('2026-09-12', 28)).toEqual({
      start: '2026-08-16',
      end: '2026-09-12',
      previousStart: '2026-07-19',
      previousEnd: '2026-08-15',
    });
  });

  it('clips a window to the data start and drops a comparison that reaches before it', () => {
    const recent = windowEnding('2026-09-12', 28);
    expect(clipWindow(recent, '2026-05-07')).toEqual({
      start: '2026-08-16',
      end: '2026-09-12',
      previous: { start: '2026-07-19', end: '2026-08-15' },
    });

    const year = windowEnding('2026-09-12', 364);
    expect(clipWindow(year, '2026-05-07')).toEqual({ start: '2026-05-07', end: '2026-09-12', previous: null });
  });
});

describe('combineTotals', () => {
  it('weights position by impressions', () => {
    const totals = combineTotals([
      { clicks: 10, impressions: 100, position: 2 },
      { clicks: 0, impressions: 300, position: 10 },
    ]);
    expect(totals).toEqual({ clicks: 10, impressions: 400, ctr: 0.025, position: 8 });
  });

  it('reports no CTR or position without impressions', () => {
    expect(combineTotals([])).toEqual({ clicks: 0, impressions: 0, ctr: null, position: null });
  });
});

describe('bucketSeries', () => {
  const days = [
    { date: '2026-09-01', clicks: 2, impressions: 20, position: 5 },
    { date: '2026-09-03', clicks: 1, impressions: 10, position: 5 },
    { date: '2026-09-08', clicks: 4, impressions: 40, position: 5 },
  ];

  it('fills days without data with zeros', () => {
    expect(bucketSeries(days, '2026-09-01', '2026-09-03', 1)).toEqual([
      { start: '2026-09-01', clicks: 2, impressions: 20 },
      { start: '2026-09-02', clicks: 0, impressions: 0 },
      { start: '2026-09-03', clicks: 1, impressions: 10 },
    ]);
  });

  it('aligns weekly buckets to the end so only the oldest bucket is partial', () => {
    expect(bucketSeries(days, '2026-09-01', '2026-09-10', 7)).toEqual([
      { start: '2026-09-01', clicks: 3, impressions: 30 },
      { start: '2026-09-04', clicks: 4, impressions: 40 },
    ]);
  });

  it('returns nothing for an empty range', () => {
    expect(bucketSeries(days, '2026-09-05', '2026-09-04', 1)).toEqual([]);
  });
});

describe('isBrandQuery', () => {
  it.each(['pt tsi', 'pt.tsi', 'TSI Sertifikasi Internasional', 'logo tsi', 'tsicertification'])(
    'treats "%s" as brand',
    (query) => expect(isBrandQuery(query, BRAND)).toBe(true),
  );

  it.each(['sertifikasi iso', 'tsismis', 'iso 27001 indonesia'])('does not treat "%s" as brand', (query) =>
    expect(isBrandQuery(query, BRAND)).toBe(false),
  );
});

describe('standardOf', () => {
  it.each([
    ['iso 22301:2019', 'ISO 22301'],
    ['ISO/IEC 27001:2022 requirements', 'ISO 27001'],
    ['https://tsicertification.com/iso-iec-27001-isms/', 'ISO 27001'],
    ['/iso-iec-20000-1-itsm/', 'ISO 20000-1'],
    ['/blog/tujuan-dan-manfaat-iso-14001-2026-bagi-organisasi/', 'ISO 14001'],
    ['iso9001', 'ISO 9001'],
    ['27001 adalah', 'ISO 27001'],
    ['fssc 22000 indonesia', 'FSSC 22000'],
    ['logo ispo', 'ISPO'],
    ['sertifikat haccp', 'HACCP'],
  ])('reads "%s" as %s', (text, standard) => expect(standardOf(text)).toBe(standard));

  it.each(['sertifikasi 2026', 'cukong88', 'isometric drawing', 'pt tsi'])('finds no standard in "%s"', (text) =>
    expect(standardOf(text)).toBeNull(),
  );
});

describe('clusterOf', () => {
  it('prefers the standard over the brand', () => {
    expect(clusterOf('tsi iso 9001', BRAND)).toBe('ISO 9001');
    expect(clusterOf('pt tsi', BRAND)).toBe('Brand');
    expect(clusterOf('sertifikasi internasional', BRAND)).toBe('Other');
  });
});

describe('keyword status', () => {
  const options = { minImpressions: 30, isBrand: false };

  it('does not judge movement below the impression threshold', () => {
    const keyword = { impressions: 25, position: 5, previousImpressions: 200, previousPosition: 15 };
    expect(positionMovement(keyword, 30)).toBeNull();
    expect(classifyKeyword(keyword, options)).toBe('Stable');
  });

  it('flags a keyword leaving page 1 as At Risk before Dropping', () => {
    expect(
      classifyKeyword({ impressions: 60, position: 12, previousImpressions: 60, previousPosition: 8 }, options),
    ).toBe('At Risk');
  });

  it('needs at least two positions of change', () => {
    const base = { impressions: 60, previousImpressions: 60 };
    expect(classifyKeyword({ ...base, position: 4, previousPosition: 6 }, options)).toBe('Rising');
    expect(classifyKeyword({ ...base, position: 7, previousPosition: 5 }, options)).toBe('Dropping');
    expect(classifyKeyword({ ...base, position: 5, previousPosition: 6 }, options)).toBe('Stable');
  });

  it('marks non-brand keywords between positions 8 and 50 as opportunities', () => {
    const keyword = { impressions: 48, position: 21, previousImpressions: 10, previousPosition: 17 };
    expect(classifyKeyword(keyword, options)).toBe('Opportunity');
    expect(classifyKeyword(keyword, { ...options, isBrand: true })).toBe('Stable');
  });
});

describe('opportunityScore', () => {
  it('stays within 0–100 and favours reach and proximity', () => {
    const top = opportunityScore({ impressions: 200, position: 8 }, 200);
    const far = opportunityScore({ impressions: 200, position: 50 }, 200);
    const small = opportunityScore({ impressions: 30, position: 8 }, 200);
    expect(top).toBe(100);
    expect(far).toBe(60);
    expect(small).toBeLessThan(top);
    expect(small).toBeGreaterThan(0);
  });
});

describe('positions', () => {
  it('assigns bands and result pages', () => {
    expect(positionBand(3)).toBe('Top 3');
    expect(positionBand(10.4)).toBe('Pos 11–20');
    expect(positionBand(80)).toBe('Pos 51+');
    expect(serpPage(0.9)).toBe(1);
    expect(serpPage(21.2)).toBe(3);
  });
});

describe('competingPages', () => {
  it('reports pages that each hold at least 20% of a query', () => {
    const result = competingPages([
      { page: '/a', impressions: 60, position: 5 },
      { page: '/b', impressions: 30, position: 9 },
      { page: '/c', impressions: 10, position: 30 },
    ]);
    expect(result?.map((page) => [page.page, page.share])).toEqual([
      ['/a', 0.6],
      ['/b', 0.3],
    ]);
  });

  it('returns null when one page owns the query', () => {
    expect(
      competingPages([
        { page: '/a', impressions: 90, position: 5 },
        { page: '/b', impressions: 10, position: 9 },
      ]),
    ).toBeNull();
  });
});
