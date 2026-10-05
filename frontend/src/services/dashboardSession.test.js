import { dashboardRequest } from './dashboardSession';

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test('TURN provider errors reach the caller without losing dashboard authorization', async () => {
  global.fetch = jest.fn().mockResolvedValue({ status: 503, ok: false, json: async () => ({ message: 'Metered: koneksi layanan gagal atau timeout. Coba kembali.' }) });
  await expect(dashboardRequest('/api/crisis-room/ice-servers', { sessionToken: 'session' })).rejects.toMatchObject({ turnMessage: 'Metered: koneksi layanan gagal atau timeout. Coba kembali.' });
  expect(global.fetch.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer session' });
});

test('nonprovider errors and malformed response bodies do not expose upstream details', async () => {
  for (const json of [async () => ({ message: 'https://upstream?apiKey=private-key' }), async () => { throw new Error('invalid JSON'); }]) {
    global.fetch = jest.fn().mockResolvedValue({ status: 503, ok: false, json });
    await expect(dashboardRequest('/api/crisis-room/ice-servers', { sessionToken: 'session' })).rejects.toEqual(new Error('Dashboard service unavailable'));
  }
});

test('TURN endpoint 401 retains session-expired behavior', async () => {
  global.fetch = jest.fn().mockResolvedValue({ status: 401, ok: false });
  await expect(dashboardRequest('/api/crisis-room/ice-servers', { sessionToken: 'session' })).rejects.toMatchObject({ code: 'session-expired' });
});
