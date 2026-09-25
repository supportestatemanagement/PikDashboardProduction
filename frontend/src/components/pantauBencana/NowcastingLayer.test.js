import { act, fireEvent, render, screen } from '@testing-library/react';
import NowcastingLayer, { NowcastingDetails, NowcastingEvents, NowcastingStatus } from './NowcastingLayer';
import DisasterMap from './DisasterMap';
import { normalizeNowcasting, NOWCASTING_LAYER_NAME } from '../../services/disaster/bmkgNowcasting';

let mockEvents;
const mockMap = { getContainer: jest.fn(), invalidateSize: jest.fn() };
jest.mock('./EarthquakeLayer', () => () => null);
jest.mock('react-leaflet', () => {
  const Container = ({ children }) => <div>{children}</div>;
  const LayersControl = Container;
  LayersControl.Overlay = ({ children, name, checked }) => <div data-testid={name} data-checked={Boolean(checked)}>{children}</div>;
  LayersControl.BaseLayer = Container;
  return { MapContainer: Container, LayerGroup: Container, Pane: Container, Popup: Container, CircleMarker: Container, Marker: Container,
    LayersControl, TileLayer: () => null, useMap: () => mockMap,
    useMapEvents: handlers => { mockEvents = handlers; },
    GeoJSON: ({ children, data }) => <div data-testid={`polygon-${data.id}`}>{children}</div>,
  };
});
const makeWarning = (until = Date.now() + 60000) => normalizeNowcasting({ type: 'Feature', id: 1,
  geometry: { type: 'Polygon', coordinates: [[[105, -6], [106, -6], [106, -5], [105, -6]]] },
  properties: { namakecamatan: 'Wilayah Uji', tipearea: 'Area Terjadi', waktuberlaku: Date.now() - 60000, waktuberakhir: until },
});
beforeEach(() => {
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

test('all overlays default ON and empty data has no legend', () => {
  render(<DisasterMap latestSource={{}} historySource={{}} />);
  expect(screen.getByTestId(NOWCASTING_LAYER_NAME)).toHaveAttribute('data-checked', 'true');
  expect(screen.getByTestId('Gempa terbaru')).toHaveAttribute('data-checked', 'true');
  expect(screen.getByTestId('Gempa M >= 5')).toHaveAttribute('data-checked', 'true');
  expect(screen.getByTestId('Gempa dirasakan')).toHaveAttribute('data-checked', 'true');
  expect(screen.queryByTestId('Hotspot BMKG')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Legenda peta')).not.toBeInTheDocument();
});

test('warning legend follows availability, visibility and expiration', () => {
  jest.useFakeTimers();
  const warning = makeWarning(Date.now() + 10000);
  render(<DisasterMap latestSource={{}} historySource={{}} nowcastingSource={{ data: { features: [warning] } }} />);
  expect(screen.getByLabelText('Legenda peta')).toHaveTextContent('Area Terjadi');
  expect(screen.getByLabelText('Legenda peta')).not.toHaveTextContent('RDCA');
  act(() => mockEvents.overlayremove({ name: NOWCASTING_LAYER_NAME }));
  expect(screen.queryByLabelText('Legenda peta')).not.toBeInTheDocument();
  act(() => mockEvents.overlayadd({ name: NOWCASTING_LAYER_NAME }));
  expect(screen.getByLabelText('Legenda peta')).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(15000));
  expect(screen.queryByLabelText('Legenda peta')).not.toBeInTheDocument();
});

test('only matching layer events toggle and popup never invents weather potential', () => {
  const toggle = jest.fn();
  const view = render(<NowcastingEvents onToggle={toggle} />);
  act(() => mockEvents.overlayadd({ name: 'Gempa terbaru' }));
  expect(toggle).not.toHaveBeenCalled();
  view.rerender(<NowcastingDetails warning={{ region: 'Wilayah Uji', fieldReport: '<script>unsafe</script>' }} />);
  expect(screen.getByText(/Waktu berlaku tidak lengkap/)).toBeVisible();
  expect(screen.queryByText(/Hujan Sedang/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Laporan lapangan'));
  expect(screen.getByText('<script>unsafe</script>')).toBeInTheDocument();
  expect(screen.getByText('<script>unsafe</script>')).toContainHTML('&lt;script&gt;unsafe&lt;/script&gt;');
});

test('expired polygons disappear between requests and failed refresh hides cached polygons', () => {
  jest.useFakeTimers();
  const warning = makeWarning(Date.now() + 10000);
  const data = { features: [warning], fetchedAt: new Date().toISOString(), rawCount: 1, invalidCount: 0 };
  const view = render(<NowcastingLayer source={{ data, error: false }} />);
  expect(screen.getByTestId('polygon-1')).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(15000));
  expect(screen.queryByTestId('polygon-1')).not.toBeInTheDocument();
  view.rerender(<NowcastingLayer source={{ data: { ...data, features: [makeWarning()] }, error: true }} />);
  expect(screen.queryByTestId('polygon-1')).not.toBeInTheDocument();
  view.unmount();
  expect(jest.getTimerCount()).toBe(0);
});

test('empty response is not presented as all-clear and fetch time is not a source update', () => {
  render(<NowcastingStatus state={{ data: { features: [], rawCount: 0, fetchedAt: '2026-09-24T02:33:07Z', latestIssuedAt: null }, visibleCount: 0 }} />);
  expect(screen.getByRole('status')).toHaveTextContent('Tidak ada area peringatan aktif yang dikembalikan sumber saat ini.');
  expect(screen.getByRole('status')).toHaveTextContent('Terakhir berhasil diambil');
  expect(screen.getByRole('status')).not.toHaveTextContent('dibuat BMKG');
});
