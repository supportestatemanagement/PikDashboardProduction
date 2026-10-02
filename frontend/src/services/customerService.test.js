import { customerDate, normalizeCustomerRows, countCustomerValues, dailyCustomerTickets } from './customerService';

test('parses CustomerRelation dates as day/month/year including afternoon timestamps', () => {
  expect(customerDate('20/09/2026 22:34:08')).toBe('2026-09-20');
  expect(customerDate('01/10/2026 12:45:00')).toBe('2026-10-01');
  expect(customerDate('1 Okt 26')).toBe('2026-10-01');
  expect(customerDate('2026-10-01T20:00:00')).toBe('2026-10-01');
  expect(customerDate('31/02/2026')).toBe('');
  expect(customerDate('')).toBe('');
});
test('keeps project codes and text IDs, fills missing columns, counts tickets and zero days', () => {
  const rows = normalizeCustomerRows([
    { 'Project Code': 'GIS', 'Created At': '01/10/2026 18:00:00', 'Unit Code': '001', Source: 'WEB PORTAL' },
    { ' Project Code ': 'EBI', 'Created At': '03/10/2026 07:00:00', Source: 'WEB PORTAL' },
    {},
  ]);
  expect(rows).toHaveLength(2);
  expect(rows[0]['Unit Code']).toBe('001');
  expect(rows[1]['Project Code']).toBe('EBI');
  expect(countCustomerValues(rows, 'Source')).toEqual([{ label: 'WEB PORTAL', count: 2 }]);
  expect(dailyCustomerTickets(rows)).toEqual([{ label: '2026-10-01', count: 1 }, { label: '2026-10-02', count: 0 }, { label: '2026-10-03', count: 1 }]);
});
