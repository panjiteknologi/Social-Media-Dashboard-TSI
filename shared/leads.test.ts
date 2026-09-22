import { describe, expect, it } from 'vitest';
import {
  countBy,
  detailIsEmpty,
  eventLabel,
  latestLeadId,
  newLeadsSince,
  pagesForEvent,
  paginate,
  totalsByEvent,
  type LeadRow,
  type SignalRow,
} from './leads';

const lead = (id: number): LeadRow => ({
  id,
  serviceInquiry: 'ISO Certification',
  language: 'en',
  sourcePage: '/contact-us/',
  status: 'new',
  createdAt: '2026-09-22T00:00:00Z',
  updatedAt: '2026-09-22T00:00:00Z',
});

const signals: SignalRow[] = [
  { event: 'cta_click', page: '/', channel: 'Organic Search', count: 27 },
  { event: 'cta_click', page: '/', channel: 'Referral', count: 4 },
  { event: 'cta_click', page: '/career', channel: 'Organic Search', count: 1 },
  { event: 'whatsapp_click', page: '/', channel: 'Organic Search', count: 14 },
];

describe('countBy', () => {
  it('counts values, biggest first, and skips blanks', () => {
    const rows = [{ s: 'ISO' }, { s: 'ISPO' }, { s: 'ISO' }, { s: null }, { s: '' }];
    expect(countBy(rows, (row) => row.s)).toEqual([
      { value: 'ISO', count: 2 },
      { value: 'ISPO', count: 1 },
    ]);
  });

  it('breaks ties alphabetically', () => {
    expect(countBy([{ s: 'B' }, { s: 'A' }], (row) => row.s).map((entry) => entry.value)).toEqual(['A', 'B']);
  });
});

describe('totalsByEvent', () => {
  it('sums each event across pages and channels', () => {
    expect(totalsByEvent(signals)).toEqual({ cta_click: 32, whatsapp_click: 14 });
    expect(totalsByEvent([])).toEqual({});
  });
});

describe('pagesForEvent', () => {
  it('merges channels and orders by size', () => {
    expect(pagesForEvent(signals, 'cta_click')).toEqual([
      { page: '/', count: 31 },
      { page: '/career', count: 1 },
    ]);
    expect(pagesForEvent(signals, 'form_submit')).toEqual([]);
  });
});

describe('paginate', () => {
  const rows = Array.from({ length: 38 }, (_, index) => index + 1);

  it('cuts the list into pages', () => {
    expect(paginate(rows, 1, 12)).toMatchObject({ page: 1, pages: 4, total: 38 });
    expect(paginate(rows, 1, 12).rows).toHaveLength(12);
    expect(paginate(rows, 4, 12).rows).toEqual([37, 38]);
  });

  it('brings an out-of-range page back into range', () => {
    expect(paginate(rows, 99, 12).page).toBe(4);
    expect(paginate(rows, 0, 12).page).toBe(1);
  });

  it('reports one page when there is nothing', () => {
    expect(paginate([], 1, 12)).toEqual({ rows: [], page: 1, pages: 1, total: 0 });
  });
});

describe('newLeadsSince and latestLeadId', () => {
  const leads = [lead(7), lead(6), lead(5)];

  it('finds leads that arrived after the last one seen, newest first', () => {
    expect(newLeadsSince(leads, 5).map((row) => row.id)).toEqual([7, 6]);
    expect(newLeadsSince(leads, 7)).toEqual([]);
    expect(newLeadsSince(leads, 0)).toHaveLength(3);
  });

  it('reads the newest id, and keeps the fallback when there are none', () => {
    expect(latestLeadId(leads)).toBe(7);
    expect(latestLeadId([], 4)).toBe(4);
  });
});

describe('eventLabel and detailIsEmpty', () => {
  it('names known events and passes unknown ones through', () => {
    expect(eventLabel('whatsapp_click')).toBe('WhatsApp click');
    expect(eventLabel('scroll')).toBe('scroll');
  });

  it('spots a lead with nothing written in it', () => {
    const empty = { id: 1, fullName: null, companyName: null, jobTitle: null, email: null, phone: '  ', message: null };
    expect(detailIsEmpty(empty)).toBe(true);
    expect(detailIsEmpty({ ...empty, message: 'Mohon penawaran ISO 9001.' })).toBe(false);
  });
});
