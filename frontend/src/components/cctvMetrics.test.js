import { cameraMetrics } from './cctvMetrics';
test('PIK2 weights camera quantities and counts offline cameras even when condition is ON', () => {
  const result = cameraMetrics([
    { Area: 'PIK 2', 'Sub Area': 'A', 'Jumlah Kamera': 15, Tahun: 2024, Brand: 'Dahua', Kondisi: 'ON', 'Detail Offline': '1 Kamera Gangguan Switch POE' },
    { Area: 'PIK 2 MILENIAL', 'Sub Area': 'B', 'Jumlah Kamera': 20, Tahun: 2024, Brand: 'Dahua', Kondisi: 'ON', 'Detail Offline': '3 Kamera Gangguan Port Lan', 'Progress Perbaikan': 'Service' },
  ], true);
  expect(result.total).toBe(35);
  expect(result.condition).toEqual({ on: 31, off: 4 });
  expect(result.trend).toEqual([{ year: '2024', count: 35 }]);
  expect(result.brands).toEqual([{ label: 'Dahua', count: 35 }]);
  expect(result.offline['PIK 2 Millenia'][0]).toMatchObject({ offlineCount: 3, Progress: 'Service' });
});
test('PIK1 counts one camera per valid row', () => {
  expect(cameraMetrics([{ Tahun: 2025, Kondisi: 'ON' }, { 'Nama Pada Layar (OSD)': 'A', Kondisi: 'OFF', Area: 'BGM' }, {}]).condition).toEqual({ on: 1, off: 1 });
});
