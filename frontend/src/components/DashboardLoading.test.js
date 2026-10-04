import { act, render, screen } from '@testing-library/react';
import CallCenterDashboard from './CallCenterDashboard';
import PerparkiranDashboard from './PerparkiranDashboard';
import PumpWeatherDashboard from './PumpWeatherDashboard';
import { fetchPumpAnalytics } from '../services/pumpService';

jest.mock('../services/pumpService', () => ({ fetchPumpAnalytics: jest.fn() }));
const dateRange = { start: new Date(2026, 9, 4), end: new Date(2026, 9, 4) };
const originalFetch = global.fetch;
const originalResizeObserver = global.ResizeObserver;
beforeEach(() => { global.ResizeObserver = class { observe() {} disconnect() {} }; });
afterEach(() => { global.fetch = originalFetch; global.ResizeObserver = originalResizeObserver; jest.clearAllMocks(); });

test.each([
  ['Emergency', CallCenterDashboard, 'Daily Emergency Tickets'],
  ['Parking', PerparkiranDashboard, 'Daily Parking Tickets'],
])('%s displays cards and chart skeletons before the request completes', async (_name, Component, heading) => {
  let resolve;
  global.fetch = jest.fn(() => new Promise(done => { resolve = done; }));
  const { container } = render(<Component dateRange={dateRange} />);
  expect(screen.getByText(heading)).toBeInTheDocument();
  expect(screen.getByText('TOTAL TICKETS')).toBeInTheDocument();
  expect(screen.queryByText(/Menghubungkan ke Server/)).not.toBeInTheDocument();
  expect(screen.getAllByLabelText('Loading chart').length).toBeGreaterThan(0);
  expect(container.querySelectorAll('.dashboard-loading-value').length).toBeGreaterThan(0);
  expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  await act(async () => { resolve({ json: async () => ({ status: 'success', data: [{ Date: '2026-10-04', Tanggal: '2026-10-04', Area: 'BGM', Detailed: 'Test issue', Dept: 'Security' }] }) }); });
  expect(screen.getByText(heading)).toBeInTheDocument();
  expect(container.querySelectorAll('.dashboard-loading-value')).toHaveLength(0);
  expect(screen.queryByLabelText('Loading chart')).not.toBeInTheDocument();
});

test('Pump Station renders all panels with independent loading indicators', async () => {
  const resolves = [];
  fetchPumpAnalytics.mockImplementation(() => new Promise(resolve => resolves.push(resolve)));
  const { container } = render(<PumpWeatherDashboard dateRange={dateRange} />);
  expect(screen.getByText('WATER LEVEL TREND')).toBeInTheDocument();
  expect(screen.getByText('PEAK LEVEL BY STATION')).toBeInTheDocument();
  expect(screen.queryByText(/Memuat data Pump Station/)).not.toBeInTheDocument();
  expect(container.querySelector('.pw-level-card')).toHaveAttribute('aria-busy', 'true');
  expect(container.querySelector('.pw-peak-panel')).toHaveAttribute('aria-busy', 'true');
  await act(async () => { resolves[0]({ analytics: {}, chart: [] }); });
  expect(container.querySelector('.pw-level-card')).toHaveAttribute('aria-busy', 'false');
  expect(container.querySelector('.pw-peak-panel')).toHaveAttribute('aria-busy', 'true');
  await act(async () => { resolves.slice(1).forEach(resolve => resolve({ analytics: {}, chart: [] })); });
  expect(container.querySelectorAll('.dashboard-loading-value')).toHaveLength(0);
  expect(screen.queryByLabelText('Loading chart')).not.toBeInTheDocument();
});
