import { fireEvent, render, screen, within } from '@testing-library/react';
import PusatPantauBencana from './PusatPantauBencana';
import useVolcanoSource, { FALLBACK_VOLCANO_DATA, normalizeVolcanoResponse } from '../../services/disaster/pvmbgVolcano';

jest.mock('../../services/disaster/pvmbgVolcano', () => ({ ...jest.requireActual('../../services/disaster/pvmbgVolcano'), __esModule: true, default: jest.fn() }));
jest.mock('../../services/disaster/useDisasterSource', () => () => ({ data: null, loading: false, error: false }));
jest.mock('./DisasterMap', () => ({ volcanoes, volcanoFocus, onVolcanoSelect }) => <div data-testid="map" data-focus={volcanoFocus?.id || ''}>{volcanoes.map(v => <button key={v.id} onClick={() => onVolcanoSelect(v)}>{v.name}</button>)}</div>);

const data = normalizeVolcanoResponse({ success: true, data: [
  { id: 'a', name: 'Gunung Uji A', status: 'SIAGA', latitude: -6, longitude: 105 },
  { id: 'b', name: 'Gunung Uji B', status: 'AWAS', latitude: -7, longitude: 110 },
] });

test('panel and map share filtered data and selection in both directions', () => {
  useVolcanoSource.mockReturnValue({ data, loading: false, error: false });
  render(<PusatPantauBencana />);
  const panel = within(screen.getByRole('region', { name: 'Aktivitas Gunung Api' }));
  const map = screen.getByTestId('map');
  fireEvent.click(panel.getByRole('button', { name: /Gunung Uji A/ }));
  expect(map).toHaveAttribute('data-focus', 'a');
  fireEvent.click(within(map).getByRole('button', { name: 'Gunung Uji B' }));
  expect(panel.getByRole('button', { name: /Gunung Uji B/ })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(panel.getByRole('button', { name: 'Siaga', exact: true }));
  expect(within(map).queryByText('Gunung Uji B')).not.toBeInTheDocument();
  expect(panel.queryByRole('button', { name: /Gunung Uji B/ })).not.toBeInTheDocument();
  expect(map).toHaveAttribute('data-focus', '');
  fireEvent.click(panel.getByRole('button', { name: 'Normal', exact: true }));
  expect(panel.getByText('Tidak ada gunung api untuk filter ini.')).toBeVisible();
});

test('fallback stays explicit, navigation disabled, other sections remain visible', () => {
  useVolcanoSource.mockReturnValue({ data: FALLBACK_VOLCANO_DATA, loading: false, unavailable: true });
  render(<PusatPantauBencana />);
  expect(screen.getByText(/Fallback sementara/)).toBeVisible();
  expect(screen.getByText('Data aktivitas gunung api sementara tidak tersedia.')).toBeVisible();
  const panel = within(screen.getByRole('region', { name: 'Aktivitas Gunung Api' }));
  expect(panel.getByRole('button', { name: /G. Merapi/ })).toBeDisabled();
  expect(screen.getByRole('heading', { name: 'PIK 1 — Kamal Muara' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'PIK 2 — Salembaran Jati' })).toBeVisible();
  expect(screen.getByRole('region', { name: 'Gempa BMKG' })).toBeVisible();
});

test('last successful data remains labeled on failure', () => {
  useVolcanoSource.mockReturnValue({ data, loading: false, error: true, unavailable: true });
  render(<PusatPantauBencana />);
  expect(screen.getByText(/Data terakhir tersedia/)).toBeVisible();
  expect(screen.queryByText(/Fallback sementara/)).not.toBeInTheDocument();
});
