import { fetchCustomerRows, customerDate, normalizeCustomerRows, countCustomerValues, monthlyCustomerTickets } from './customerService';

test('groups monthly totals across years and fills months without tickets', () => {
  expect(monthlyCustomerTickets([{ date: '2025-12-01' }, { date: '2025-12-31' }, { date: '2026-02-01' }, { date: '' }])).toEqual([
    { label: '2025-12', count: 2 }, { label: '2026-01', count: 0 }, { label: '2026-02', count: 1 },
  ]);
});

test.each([200, 404, 502])('handles HTML responses without exposing JSON parser errors (HTTP %s)', async status => {
  const original = global.fetch;
  const json = jest.fn();
  global.fetch = jest.fn().mockResolvedValue({ status, ok: status === 200, headers: { get: () => 'text/html' }, json });
  try {
    await expect(fetchCustomerRows()).rejects.toThrow(status === 502 ? 'sedang tidak tersedia' : 'belum tersedia');
    expect(json).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(status === 502 ? 3 : 1);
  } finally { global.fetch = original; }
});

test('recovers from a temporary HTML gateway failure', async () => {
  const original = global.fetch;
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ status: 503, ok: false, headers: { get: () => 'text/html' } })
    .mockResolvedValueOnce({ status: 200, ok: true, headers: { get: () => 'application/json' }, json: async () => ({ status: 'success', data: [] }) });
  try {
    await expect(fetchCustomerRows()).resolves.toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  } finally { global.fetch = original; }
});

test('stops retrying when the user leaves Customer Service', async () => {
  const original = global.fetch;
  const controller = new AbortController();
  global.fetch = jest.fn().mockResolvedValue({ status: 503, ok: false });
  try {
    const pending = fetchCustomerRows(controller.signal);
    await Promise.resolve();
    controller.abort();
    await expect(pending).rejects.toHaveProperty('name', 'AbortError');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  } finally { global.fetch = original; }
});
test('reads successful JSON from the Customer Service API', async () => {
  const original = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, headers: { get: () => 'application/json' }, json: async () => ({ status: 'success', data: [{ 'Project Code': 'GIS', 'Created At': '01/10/2026 12:30:00' }] }) });
  try { expect((await fetchCustomerRows())[0].date).toBe('2026-10-01'); }
  finally { global.fetch = original; }
});

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
  expect(rows[1]['Project Code']).toBe('RWI');
  expect(countCustomerValues(rows, 'Source')).toEqual([{ label: 'WEB PORTAL', count: 2 }]);
  expect(monthlyCustomerTickets(rows)).toEqual([{ label: '2026-10', count: 2 }]);
});
