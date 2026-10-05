import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import useDashboardSession from './services/useDashboardSession';
import VehicleAuthProvider from './components/VehicleAuthProvider';
import CrisisRoom from './components/CrisisRoom';

jest.mock('./services/useDashboardSession', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('./components/VehicleAuthProvider', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('./components/CrisisRoom', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('./components/TrafficDashboard', () => () => <div>Traffic dashboard content</div>);
jest.mock('./components/VehicleTrackerDashboard', () => () => null);
jest.mock('./components/CallCenterDashboard', () => () => null);
jest.mock('./components/CustomerServiceDashboard', () => () => null);
jest.mock('./components/CctvDashboard', () => () => null);
jest.mock('./components/PerparkiranDashboard', () => () => null);
jest.mock('./components/PumpWeatherDashboard', () => () => null);
jest.mock('./components/AvailableParkingDashboard', () => () => null);
jest.mock('./components/WaterQualityDashboard', () => () => null);
jest.mock('./components/pantauBencana/PusatPantauBencana', () => () => null);

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  VehicleAuthProvider.mockImplementation(({ children }) => <>{children}</>);
  CrisisRoom.mockImplementation(({ session }) => <div>Crisis video for {session.user.username}</div>);
});

function sessionFor(user) {
  useDashboardSession.mockReturnValue({ session: { sessionToken: 'signed', user }, checking: false, logout: jest.fn() });
}

test('Astina sees only broadcast navigation and never mounts other dashboards or Firebase', () => {
  localStorage.setItem('cc_activeTab', 'dashboard');
  sessionFor({ username: 'Astina', role: 'crisis_broadcaster' });
  render(<App />);
  expect(window.location.pathname).toBe('/crisis-room/broadcast');
  expect(screen.getByRole('button', { name: 'Crisis Room Broadcast' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Traffic' })).not.toBeInTheDocument();
  expect(screen.queryByText('Traffic dashboard content')).not.toBeInTheDocument();
  expect(screen.getByText('Crisis video for Astina')).toBeInTheDocument();
  expect(VehicleAuthProvider).not.toHaveBeenCalled();
});

test('viewer opening broadcast URL is redirected to Crisis Room with viewer menu', async () => {
  window.history.replaceState({}, '', '/crisis-room/broadcast');
  sessionFor({ username: 'viewer', role: 'operator' });
  render(<App />);
  expect(window.location.pathname).toBe('/crisis-room');
  expect(screen.getByRole('button', { name: 'Crisis Room' })).toBeInTheDocument();
  expect(screen.getByRole('navigation').querySelector('button')).toHaveTextContent('Crisis Room');
  expect(screen.queryByRole('button', { name: 'Crisis Room Broadcast' })).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('Crisis video for viewer')).toBeInTheDocument());
});
