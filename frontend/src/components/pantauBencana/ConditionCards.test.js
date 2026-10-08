import { render, screen } from '@testing-library/react';
import EnsoCard from './EnsoCard';
import MaritimeConditionCard from './MaritimeConditionCard';
import { MARITIME_LOCATIONS } from '../../services/disaster/bmkgMaritime';

test('ENSO observation and weekly date labels follow the NOAA period date', () => {
  const source = { data: { value: 0.1, periodDate: '2026-09-30', series: [{ date: '2026-09-23', value: 0 }, { date: '2026-09-30', value: 0.1 }] } };
  const { rerender } = render(<EnsoCard source={source} />);
  expect(screen.getByText('Pasifik Ekuatorial Tengah (Niño 3.4)')).toBeVisible();
  expect(screen.getByText('PERIODE DATA')).toBeVisible();
  expect(screen.getByText('Mingguan (7 hari) • 30 Sep 2026')).toBeVisible();
  expect(screen.getByText('Tren Indeks')).toBeVisible();
  rerender(<EnsoCard source={{ data: { ...source.data, periodDate: '2026-10-07' } }} />);
  expect(screen.getByText('Mingguan (7 hari) • 07 Okt 2026')).toBeVisible();
});

test('unavailable official sources display no invented climate or maritime values', () => {
  render(<><EnsoCard source={{ unavailable: true }} /><MaritimeConditionCard location={MARITIME_LOCATIONS[1]} source={{ error: true }} /></>);
  expect(screen.getByText('Data ENSO terbaru sementara tidak tersedia.')).toBeVisible();
  expect(screen.getByText('Data maritim resmi sementara tidak tersedia.')).toBeVisible();
  expect(screen.getByText('Referensi: Pelabuhan Tanjung Pasir')).toBeVisible();
  expect(screen.queryByText('Netral', { exact: true })).not.toBeInTheDocument();
  expect(screen.queryByText(/\+0\.2/)).not.toBeInTheDocument();
});

test('cached maritime data is explicitly labeled and source time is preserved', () => {
  render(<MaritimeConditionCard location={MARITIME_LOCATIONS[0]} source={{ error: true, data: { tides: 0, updatedAt: '2026-09-23T12:00Z', validAt: '2026-09-24T00:00Z', validFrom: '2026-09-24T00:00Z', validUntil: '2026-09-27T00:00Z' } }} />);
  expect(screen.getByText(/Data terakhir tersedia/)).toBeVisible();
  expect(screen.getByText(/Update sumber:/)).toHaveTextContent('23 Sep 2026');
  expect(screen.getByText('0 m')).toBeVisible();
});
