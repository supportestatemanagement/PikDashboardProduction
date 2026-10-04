import { act, render, screen, within } from '@testing-library/react';
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
  expect(within(summary).getByText('-80')).toBeInTheDocument();
  expect(within(summary).getByText('140.0%')).toBeInTheDocument();
  expect(within(bikeSummary).getByText('-422')).toBeInTheDocument();
  expect(within(bikeSummary).getByText('240.7%')).toBeInTheDocument();
  const card = screen.getByRole('article', { name: 'Parkir KAWASAN RUKAN PIK - CORDOBA' });
  expect(within(card).getAllByRole('img')).toHaveLength(2);
  const car = within(card).getByRole('region', { name: 'KAWASAN RUKAN PIK - CORDOBA Mobil' });
  expect(within(car).getByText('-80')).toBeInTheDocument();
  expect(within(car).getByText('280')).toBeInTheDocument();
  expect(within(car).getByText('200')).toBeInTheDocument();
  expect(within(car).getByRole('img')).toHaveStyle('--occupancy: 100%');
  fetchParkingRows.mockRejectedValue(new Error('offline'));
  await act(async () => { jest.advanceTimersByTime(60000); });
  expect(fetchParkingRows).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(within(summary).getByText('-80')).toBeInTheDocument();
  unmount();
  await act(async () => { jest.advanceTimersByTime(60000); });
  expect(fetchParkingRows).toHaveBeenCalledTimes(2);
});

test('calculates area percentage from total quantity and capacity and handles zero capacity', async () => {
  fetchParkingRows.mockResolvedValue([
    { id: 'a', name: 'GOLF ISLAND - A', area: 'GI', timestamp: 1, capacity: 100, occupied: 50, carCapacity: 100, carQty: 50, bikeCapacity: 0, bikeQty: 0 },
    { id: 'b', name: 'GOLF ISLAND - B', area: 'GI', timestamp: 1, capacity: 300, occupied: 30, carCapacity: 300, carQty: 30, bikeCapacity: 0, bikeQty: 0 },
  ]);
  render(<AvailableParkingDashboard />);
  await act(async () => {});
  const cars = screen.getByRole('region', { name: 'Ringkasan Mobil GI' });
  expect(within(cars).getByText('20.0%')).toBeInTheDocument();
  expect(within(cars).getByText('400')).toBeInTheDocument();
  expect(within(cars).getByText('320')).toBeInTheDocument();
  const bikes = screen.getByRole('region', { name: 'Ringkasan Motor GI' });
  expect(within(bikes).getByText('—')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'GOLF ISLAND - A: Motor — terisi' })).toHaveStyle('--occupancy: 0%');
});
