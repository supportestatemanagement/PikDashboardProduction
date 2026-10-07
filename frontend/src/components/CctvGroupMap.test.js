import { fireEvent, render, screen } from '@testing-library/react';
import CctvGroupMap from './CctvGroupMap';
jest.mock('leaflet', () => ({ divIcon: () => ({}) }));
jest.mock('react-leaflet', () => {
  const React = require('react');
  const Container = ({ children }) => <div>{children}</div>;
  return { MapContainer: Container, Popup: Container, Tooltip: Container,
    Marker: ({ children, draggable }) => <div data-testid="marker" data-draggable={String(draggable)}>{children}</div>,
    TileLayer: () => null, AttributionControl: () => null,
    useMap: () => ({ fitBounds: jest.fn() }), useMapEvents: () => null };
});
const records = [{ Tahun: 2026, Kelompok: 'Gate' }, { 'Nama Pada Layar (OSD)': 'Camera', Kelompok: 'Gate' }];
beforeEach(() => { global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'success', data: [{ Kelompok: 'Gate', Latitude: -6.1, Longitude: 106.7 }] }) }); });
afterEach(() => jest.restoreAllMocks());
test('groups cameras and keeps other accounts read only', async () => {
  render(<CctvGroupMap records={records} session={{ user: { username: 'Other' } }} />);
  expect(await screen.findByText('Total CCTV:')).toHaveTextContent('Total CCTV: 2');
  expect(screen.queryByText('Edit lokasi')).not.toBeInTheDocument();
  expect(screen.getByTestId('marker')).toHaveAttribute('data-draggable', 'false');
});
test('Daniel explicitly enables dragging and can cancel editing', async () => {
  render(<CctvGroupMap records={records} session={{ user: { username: 'Daniel' }, sessionToken: 'signed' }} />);
  fireEvent.click(await screen.findByText('Edit lokasi'));
  expect(screen.getByTestId('marker')).toHaveAttribute('data-draggable', 'true');
  expect(screen.getByText('Simpan lokasi')).toBeDisabled();
  fireEvent.click(screen.getByText('Batal'));
  expect(screen.getByTestId('marker')).toHaveAttribute('data-draggable', 'false');
});
