import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

jest.mock('./services/useDashboardSession', () => ({ __esModule: true, default: () => ({ session: { user: 'test' }, checking: false, logout: jest.fn() }) }));
jest.mock('./components/VehicleAuthProvider', () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock('./components/TrafficDashboard', () => () => <div>Traffic content</div>);
jest.mock('./components/VehicleTrackerDashboard', () => () => null);
jest.mock('./components/CallCenterDashboard', () => () => null);
jest.mock('./components/CctvDashboard', () => () => null);
jest.mock('./components/PerparkiranDashboard', () => () => null);
jest.mock('./components/PumpWeatherDashboard', () => () => null);
jest.mock('./components/AvailableParkingDashboard', () => () => null);
jest.mock('./components/WaterQualityDashboard', () => () => null);
jest.mock('./components/pantauBencana/DisasterMap', () => () => <div>WebGIS Peta Bencana Indonesia</div>);
jest.mock('./services/disaster/useDisasterSource', () => () => ({ data: null, loading: false, error: false }));

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});
afterEach(() => window.history.replaceState(null, '', '/'));

test('migrates the removed external dashboard to the local disaster dashboard', () => {
  localStorage.setItem('cc_activeTab', 'disaster');
  render(<App />);
  expect(screen.getByRole('region', { name: 'Pantau Bencana' })).toBeInTheDocument();
  expect(screen.queryByTitle('Pantau Bencana Dashboard')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Pantau Bencana', exact: true })).not.toBeInTheDocument();
  expect(localStorage.getItem('cc_activeTab')).toBe('pantau-bencana-develop');
});

test('opens the prototype by direct URL and restores it after remount', () => {
  window.history.replaceState(null, '', '/#/pantau-bencana-develop');
  const view = render(<App />);
  expect(screen.getByRole('region', { name: 'Pantau Bencana' })).toBeInTheDocument();
  expect(screen.getByText('WebGIS Peta Bencana Indonesia')).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Situasi Terkini' })).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'ENSO / El Niño-La Niña' })).toBeInTheDocument();
  expect(screen.getByText('Referensi: Pelabuhan Muara Angke')).toBeInTheDocument();
  expect(screen.getByText('Referensi: Pelabuhan Tanjung Pasir')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Prakiraan Cuaca PIK 1 — Kamal Muara' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Prakiraan Cuaca PIK 2 — Salembaran Jati' })).toBeInTheDocument();
  expect(localStorage.getItem('cc_activeTab')).toBe('pantau-bencana-develop');
  view.unmount();
  render(<App />);
  expect(screen.getByRole('region', { name: 'Pantau Bencana' })).toBeInTheDocument();
});

test('responds to direct hash navigation and browser history without replacing existing tabs', async () => {
  render(<App />);
  expect(screen.queryByRole('region', { name: 'Pantau Bencana' })).not.toBeInTheDocument();
  act(() => {
    window.history.pushState({ dashboardTab: 'pantau-bencana-develop' }, '', '/#/pantau-bencana-develop');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(await screen.findByRole('region', { name: 'Pantau Bencana' })).toBeInTheDocument();
  act(() => {
    window.history.replaceState({ dashboardTab: 'dashboard' }, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Pantau Bencana' })).not.toBeInTheDocument());
  expect(screen.getByText('Traffic content')).toBeVisible();
});

test('sidebar opens the shareable route and leaving it restores the normal URL', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Pantau Bencana Develop' }));
  expect(window.location.hash).toBe('#/pantau-bencana-develop');
  expect(await screen.findByRole('region', { name: 'Pantau Bencana' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Pantau Bencana Develop' })).toHaveAttribute('aria-current', 'page');
  fireEvent.click(screen.getByRole('button', { name: 'Traffic', exact: true }));
  expect(window.location.hash).toBe('');
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Pantau Bencana' })).not.toBeInTheDocument());
});
