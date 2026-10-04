import { act, fireEvent, render, screen, within } from '@testing-library/react';
import AvailableParkingDashboard from './AvailableParkingDashboard';
import { fetchParkingRows } from '../services/parkingService';

jest.mock('../services/parkingService', () => ({
  ...jest.requireActual('../services/parkingService'), fetchParkingRows: jest.fn(),
}));

afterEach(() => { jest.useRealTimers(); jest.clearAllMocks(); });

test('shows live totals and vehicle details, refreshes, and preserves data after a failure', async () => {
  jest.useFakeTimers();
  fetchParkingRows.mockResolvedValue([{ id: 'a', name: 'KAWASAN RUKAN PIK - CORDOBA', area: 'BGM', timestamp: Date.parse('2026-10-03T18:30:59+07:00'), capacity: 500, occupied: 1002, carCapacity: 200, bikeCapacity: 300, carQty: 280, bikeQty: 722 }]);
  const { unmount } = render(<AvailableParkingDashboard />);
  await act(async () => {});
  const summary = screen.getByRole('region', { name: 'Ringkasan Mobil BGM' });
  const bikeSummary = screen.getByRole('region', { name: 'Ringkasan Motor BGM' });
  expect(within(summary).getByText('80')).toBeInTheDocument();
  expect(within(summary).getByText('140.0%')).toHaveClass('parking-occupancy-value', 'parking-full');
  expect(within(bikeSummary).getByText('422')).toBeInTheDocument();
  expect(within(bikeSummary).getByText('240.7%')).toBeInTheDocument();
  const card = screen.getByRole('article', { name: 'Parkir KAWASAN RUKAN PIK - CORDOBA' });
  expect(within(card).getAllByRole('img')).toHaveLength(2);
  const car = within(card).getByRole('region', { name: 'KAWASAN RUKAN PIK - CORDOBA Mobil' });
  expect(within(car).getByText('80')).toBeInTheDocument();
  expect(within(car).getByText('280')).toBeInTheDocument();
  expect(within(car).getByText('200')).toBeInTheDocument();
  expect(within(car).getByRole('img')).toHaveStyle('--occupancy: 100%');
  expect(car.querySelector('.parking-over')).toHaveTextContent('Melebihi kapasitas: 80 kendaraan');
  expect([...car.querySelectorAll('dt')].map(element => element.textContent)).toEqual(['Kapasitas', 'Terisi', 'Tersedia']);
  fetchParkingRows.mockRejectedValue(new Error('offline'));
  await act(async () => { jest.advanceTimersByTime(60000); });
  expect(fetchParkingRows).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(within(summary).getByText('80')).toBeInTheDocument();
  unmount();
  await act(async () => { jest.advanceTimersByTime(60000); });
  expect(fetchParkingRows).toHaveBeenCalledTimes(2);
});

test('ranks cars by default, switches each area independently, and displays full zero-capacity readings', async () => {
  fetchParkingRows.mockResolvedValue(['BGM', 'GI', 'RWI'].flatMap(area => [
    { id: `${area}-a`, name: `${area} A`, area, timestamp: 1, capacity: 200, occupied: 100, carCapacity: 100, carQty: 90, bikeCapacity: 100, bikeQty: 10 },
    { id: `${area}-b`, name: `${area} B`, area, timestamp: 1, capacity: 100, occupied: 15, carCapacity: 100, carQty: 10, bikeCapacity: 0, bikeQty: 5 },
  ]));
  render(<AvailableParkingDashboard />);
  await act(async () => {});
  const ranking = screen.getByRole('article', { name: 'Grafik tingkat terisi BGM' });
  expect(within(ranking).getByRole('combobox')).toHaveValue('car');
  expect([...ranking.querySelectorAll('.parking-rank-label > span')].map(element => element.textContent)).toEqual(['BGM A', 'BGM B']);
  fireEvent.change(within(ranking).getByRole('combobox'), { target: { value: 'bike' } });
  expect([...ranking.querySelectorAll('.parking-rank-label > span')].map(element => element.textContent)).toEqual(['BGM B', 'BGM A']);
  expect(screen.getByRole('combobox', { name: 'Jenis kendaraan ranking GI' })).toHaveValue('car');
  expect(screen.getByRole('combobox', { name: 'Jenis kendaraan ranking RWI' })).toHaveValue('car');
  for (const area of ['BGM', 'GI', 'RWI']) {
    const motor = screen.getByRole('region', { name: `${area} B Motor` });
    expect(within(motor).getByText('100.0%')).toBeInTheDocument();
    expect(motor.querySelector('.parking-over')).toHaveTextContent('Melebihi kapasitas: 5 kendaraan');
    expect(within(motor).getByRole('img')).toHaveStyle('--occupancy: 100%');
    const available = motor.querySelector('.parking-availability-value');
    expect(available).toHaveTextContent('0');
    expect(available).toHaveClass('parking-full');
  }
});

test('calculates area percentage from total quantity and capacity and handles zero capacity', async () => {
  fetchParkingRows.mockResolvedValue([
    { id: 'a', name: 'GOLF ISLAND - A', area: 'GI', timestamp: 1, capacity: 100, occupied: 50, carCapacity: 100, carQty: 50, bikeCapacity: 0, bikeQty: 0 },
    { id: 'b', name: 'GOLF ISLAND - B', area: 'GI', timestamp: 1, capacity: 300, occupied: 30, carCapacity: 300, carQty: 30, bikeCapacity: 0, bikeQty: 0 },
  ]);
  render(<AvailableParkingDashboard />);
  await act(async () => {});
  const cars = screen.getByRole('region', { name: 'Ringkasan Mobil GI' });
  expect(within(cars).getByText('20.0%')).toHaveClass('parking-available');
  expect(within(cars).getByText('400')).toBeInTheDocument();
  expect(within(cars).getByText('320')).toBeInTheDocument();
  const bikes = screen.getByRole('region', { name: 'Ringkasan Motor GI' });
  expect(within(bikes).getByText('0.0%')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'GOLF ISLAND - A: Motor 0.0% terisi' })).toHaveStyle('--occupancy: 0%');
});
