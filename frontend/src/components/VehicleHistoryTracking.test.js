import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import VehicleTrackerDashboard from './VehicleTrackerDashboard';
import { readVehicleHistory } from '../services/vehicleHistoryService';
const mockMap = { fitBounds: jest.fn(), getSize: () => ({ x: 1200, y: 800 }) };
const mockUser = { uid: 'dashboard' };
jest.mock('./VehicleAuthProvider', () => ({ useVehicleAuth: () => ({ status: 'ready', user: mockUser }) }));
jest.mock('./HeatmapMap', () => ({ children, showLiveVehicles }) => <div data-testid="map">{showLiveVehicles !== false && 'Existing live map'}{children}</div>);
jest.mock('../services/vehicleHistoryService', () => ({ ...jest.requireActual('../services/vehicleHistoryService'), readVehicleHistory: jest.fn() }));
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>, TileLayer: () => null,
  useMap: () => mockMap, Popup: ({ children }) => <div>{children}</div>,
  Marker: ({ title, children }) => <div aria-label={title}>{children}</div>,
  Polyline: ({ positions }) => <div data-testid="path">{positions.length}</div>,
}));
beforeEach(() => { jest.clearAllMocks(); });
const points = [{ id: 'a', position: [-6, 106], timestamp: 1790300000000 }, { id: 'b', position: [-6.1, 106.1], timestamp: 1790303600000 }];
test('defaults to live, loads history, fits once and preserves live mode', async () => {
  readVehicleHistory.mockResolvedValue(points);
  render(<VehicleTrackerDashboard />);
  expect(screen.getByText('Existing live map')).toBeInTheDocument();
  expect(readVehicleHistory).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'History Tracking' }));
  await screen.findByLabelText('History summary');
  expect(screen.getByTestId('path')).toHaveTextContent('2');
  expect(screen.getByLabelText('START: PATROL_01')).toBeInTheDocument();
  expect(screen.getByLabelText('END: PATROL_01')).toBeInTheDocument();
  expect(readVehicleHistory).toHaveBeenCalledWith('PATROL_01', expect.any(String), mockUser);
  expect(screen.getByText('1h 0m')).toBeInTheDocument();
  expect(mockMap.fitBounds).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Live Tracking' }));
  expect(screen.getByText('Existing live map')).toBeInTheDocument();
});
test('ignores stale requests after filter changes and retains map on empty/error', async () => {
  let resolveFirst;
  readVehicleHistory.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; })).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('denied'));
  render(<VehicleTrackerDashboard />);
  fireEvent.click(screen.getByRole('button', { name: 'History Tracking' }));
  expect(screen.getByRole('status')).toHaveTextContent('Loading tracking history...');
  fireEvent.change(screen.getByLabelText('Vehicle'), { target: { value: 'TRITON_1' } });
  await screen.findByText('No tracking history found for selected date.');
  await act(async () => resolveFirst(points));
  expect(screen.queryByTestId('path')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-20' } });
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Unable to load tracking history'));
  expect(readVehicleHistory).toHaveBeenLastCalledWith('TRITON_1', '2026-09-20', mockUser);
  expect(screen.getByTestId('map')).toBeInTheDocument();
});
