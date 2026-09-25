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
  Marker: ({ title, children, position }) => <div aria-label={title} data-position={JSON.stringify(position)}>{children}</div>,
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
test('panel starts, stops, accelerates and replays the vehicle with a growing trail', async () => {
  readVehicleHistory.mockResolvedValue(points);
  let frame;
  const request = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frame = callback; return 1; });
  const cancel = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  try {
    render(<VehicleTrackerDashboard />);
    fireEvent.click(screen.getByRole('button', { name: 'History Tracking' }));
    await screen.findByLabelText('History summary');
    expect(screen.queryByLabelText('Playback: PATROL_01')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => frame(0));
    act(() => frame(1000));
    expect(screen.getByLabelText('Playback progress')).toHaveAttribute('value', '60000');
    expect(screen.getAllByTestId('path')).toHaveLength(2);
    expect(screen.getByLabelText('Playback: PATROL_01')).not.toHaveAttribute('data-position', JSON.stringify(points[0].position));
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(cancel).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Playback speed'), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => frame(2000));
    act(() => frame(3000));
    expect(screen.getByLabelText('Playback progress')).toHaveAttribute('value', '360000');
    act(() => frame(20000));
    expect(screen.getByLabelText('Playback: PATROL_01')).toHaveAttribute('data-position', JSON.stringify(points[1].position));
    expect(screen.getByRole('button', { name: 'Stop' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByLabelText('Playback progress')).toHaveAttribute('value', '0');
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-19' } });
    await screen.findByLabelText('History summary');
    expect(screen.queryByLabelText('Playback: PATROL_01')).not.toBeInTheDocument();
  } finally { request.mockRestore(); cancel.mockRestore(); }
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
