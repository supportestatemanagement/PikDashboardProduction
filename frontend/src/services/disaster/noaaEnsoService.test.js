import { fetchEnso, getEnsoTrend } from './noaaEnsoService';
afterEach(() => jest.restoreAllMocks());
test('trend uses signed observed weekly values, including negative anomalies', () => {
  expect(getEnsoTrend([{ value: -1 }, { value: -0.8 }])).toBe('Menguat');
  expect(getEnsoTrend([{ value: 1 }, { value: 0.8 }])).toBe('Melemah');
  expect(getEnsoTrend([{ value: 1 }, { value: 1.01 }])).toBe('Stabil');
  expect(getEnsoTrend([])).toBeNull();
});
test('adapter preserves centered week and rejects absent anomaly', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { value: -0.2, periodDate: '1981-09-02', periodType: 'week-centered', series: [{ value: -0.2, date: '1981-09-02' }] } }) });
  expect((await fetchEnso()).period).toBe('Week centered 02 Sept 1981');
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { value: null } }) });
  await expect(fetchEnso()).rejects.toThrow('Invalid NOAA response');
});
