jest.mock('./vehicleAuthService', () => {
  process.env.REACT_APP_VEHICLE_FIREBASE_API_KEY = 'test-key';
  return jest.requireActual('./vehicleAuthService');
});
const { loginVehicleReader, refreshVehicleSession, VEHICLE_READER_UID } = require('./vehicleAuthService');
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test('accepts reader login and rejects a different account', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ localId: VEHICLE_READER_UID, idToken: 'id', refreshToken: 'refresh', expiresIn: '3600' }) });
  const session = await loginVehicleReader(' reader@example.com ', 'password');
  expect(session.idToken).toBe('id');
  expect(JSON.parse(global.fetch.mock.calls[0][1].body).email).toBe('reader@example.com');
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ localId: 'other' }) });
  await expect(loginVehicleReader('other@example.com', 'password')).rejects.toThrow('tidak memiliki akses');
});

test('renews sessions using the Firebase refresh response and handles rejection', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ user_id: VEHICLE_READER_UID, id_token: 'new-id', refresh_token: 'new-refresh', expires_in: '3600' }) });
  expect(await refreshVehicleSession('old-refresh')).toMatchObject({ idToken: 'new-id', refreshToken: 'new-refresh' });
  expect(global.fetch.mock.calls[0][1].body).toBe('grant_type=refresh_token&refresh_token=old-refresh');
  global.fetch.mockResolvedValue({ ok: false, json: async () => ({}) });
  await expect(refreshVehicleSession('old-refresh')).rejects.toThrow('Sesi GPS berakhir');
});
