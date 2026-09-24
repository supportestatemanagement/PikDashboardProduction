import { act, renderHook } from '@testing-library/react';
import useVolcanoSource, { normalizeVolcano, normalizeVolcanoLevel, normalizeVolcanoResponse, isValidLatLng, filterVolcanoes, countVolcanoes, FALLBACK_VOLCANO_DATA, VOLCANO_REFRESH_INTERVAL } from './pvmbgVolcano';

// Synthetic fixtures exercise the internal adapter contract, not official observations.
const row = { id: 'test', name: 'Gunung Uji', status: 'Level III (Siaga)', latitude: '-6.1', longitude: '105.4' };
afterEach(() => jest.useRealTimers());

test('normalizes levels, coordinates and official timestamps without inventing missing fields', () => {
  ['Level I (Normal)', 'Level II (Waspada)', 'Level III (Siaga)', 'Level IV (Awas)'].forEach((status, index) => expect(normalizeVolcanoLevel(status)).toBe(index + 1));
  expect(normalizeVolcanoLevel('Level III (Awas)')).toBeNull();
  expect(normalizeVolcanoLevel('unknown')).toBeNull();
  expect(normalizeVolcano(row)).toMatchObject({ level: 3, status: 'SIAGA', latitude: -6.1, longitude: 105.4, updatedAt: null, location: null, recommendation: null });
  expect(normalizeVolcano({ ...row, updatedAt: '2026-09-24T09:15:00+07:00' }).updatedAt).toBe('2026-09-24T02:15:00.000Z');
  expect(normalizeVolcano({ ...row, updatedAt: '2026-09-24 09:15:00' }).updatedAt).toBeNull();
  expect(normalizeVolcano({ ...row, level: 4 })).toBeNull();
});

test('rejects invalid coordinate pairs and invalid source envelopes', () => {
  [null, '', ' ', true, [], 91, Infinity, 'garbage'].forEach(latitude => {
    expect(normalizeVolcano({ ...row, latitude }).latitude).toBeNull();
  });
  expect(isValidLatLng('-6', 105)).toBe(false);
  expect(isValidLatLng(-6, 181)).toBe(false);
  expect(isValidLatLng(-90, 180)).toBe(true);
  expect(() => normalizeVolcanoResponse({ success: true, data: [row, row] })).toThrow();
  expect(() => normalizeVolcanoResponse({ success: false, data: [] })).toThrow();
});

test('sorts severity then names and computes counts from the full dataset', () => {
  const rows = [{ ...row, id: 'z', name: 'Zeta' }, { ...row, id: 'a', name: 'Alpha' }, { ...row, id: 'b', name: 'Beta', status: 'AWAS' }].map(v => normalizeVolcano(v));
  expect(filterVolcanoes(rows, 'ALL').map(v => v.id)).toEqual(['b', 'a', 'z']);
  expect(filterVolcanoes(rows, 'SIAGA').map(v => v.id)).toEqual(['a', 'z']);
  expect(countVolcanoes(rows)).toEqual({ AWAS: 1, SIAGA: 2, WASPADA: 0, NORMAL: 0 });
});

test('disabled integration returns explicit fallback with no coordinates or fabricated timestamp', () => {
  const { result } = renderHook(() => useVolcanoSource());
  expect(result.current).toMatchObject({ unavailable: true, loading: false, data: FALLBACK_VOLCANO_DATA });
  expect(result.current.data.data.every(v => v.latitude === null && v.longitude === null && v.updatedAt === null)).toBe(true);
});

test('verified adapter refreshes only every ten minutes and retains data after failure', async () => {
  jest.useFakeTimers();
  const data = normalizeVolcanoResponse({ success: true, data: [row] });
  const loader = jest.fn().mockResolvedValueOnce(data).mockRejectedValue(new Error('Offline'));
  const { result, unmount } = renderHook(() => useVolcanoSource(loader));
  await act(async () => {});
  expect(result.current.data.isFallback).toBe(false);
  await act(async () => { jest.advanceTimersByTime(60000); });
  expect(loader).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(VOLCANO_REFRESH_INTERVAL - 60000); });
  expect(loader).toHaveBeenCalledTimes(2);
  expect(result.current).toMatchObject({ data, error: true, unavailable: true });
  unmount();
  expect(loader.mock.calls[0][0].aborted).toBe(true);
});
