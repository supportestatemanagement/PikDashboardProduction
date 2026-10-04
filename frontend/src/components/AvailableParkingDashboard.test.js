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
  const summary = screen.getByRole('article', { name: 'Ringkasan parkir BGM' });
  expect(within(summary).getByText('-502')).toBeInTheDocument();
  expect(screen.getByText('-80 / 280 / 200')).toBeInTheDocument();
  expect(screen.getByText('-422 / 722 / 300')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: '200.4% terisi' })).toHaveStyle('--occupancy: 100%');
  fetchParkingRows.mockRejectedValue(new Error('offline'));
  await act(async () => { jest.advanceTimersByTime(60000); });
  expect(fetchParkingRows).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(within(summary).getByText('-502')).toBeInTheDocument();
  unmount();
  await act(async () => { jest.advanceTimersByTime(60000); });
  expect(fetchParkingRows).toHaveBeenCalledTimes(2);
});
