import { act, fireEvent, render, screen } from '@testing-library/react';
import NowcastingLayer, { NowcastingDetails, NowcastingEvents, NowcastingStatus } from './NowcastingLayer';
import DisasterMap from './DisasterMap';
import useDisasterSource from '../../services/disaster/useDisasterSource';
import { fetchNowcasting, normalizeNowcasting, NOWCASTING_LAYER_NAME } from '../../services/disaster/bmkgNowcasting';

let mockEvents;
const mockMap = { getContainer: jest.fn(), invalidateSize: jest.fn() };
jest.mock('../../services/disaster/useDisasterSource');
jest.mock('./VolcanoLayer', () => () => null);
jest.mock('react-leaflet', () => {
  const Container = ({ children }) => <div>{children}</div>;
  const LayersControl = Container;
  LayersControl.Overlay = ({ children, name, checked }) => <div data-testid={name} data-checked={Boolean(checked)}>{children}</div>;
  LayersControl.BaseLayer = Container;
  return { MapContainer: Container, LayerGroup: Container, Pane: Container, Popup: Container, CircleMarker: Container,
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
  useDisasterSource.mockReturnValue({ data: null, loading: false, error: false });
});
afterEach(() => jest.useRealTimers());

test('map overlay defaults OFF and its events enable only nowcasting', () => {
  render(<DisasterMap latestSource={{}} historySource={{}} />);
  expect(screen.getByTestId(NOWCASTING_LAYER_NAME)).toHaveAttribute('data-checked', 'false');
  expect(useDisasterSource.mock.calls.some(([loader]) => loader === fetchNowcasting)).toBe(false);
  act(() => mockEvents.overlayadd({ name: NOWCASTING_LAYER_NAME }));
  expect(useDisasterSource.mock.calls.some(([loader]) => loader === fetchNowcasting)).toBe(true);
  expect(screen.getByText('Memuat area peringatan...', { exact: false })).toBeVisible();
  act(() => mockEvents.overlayremove({ name: NOWCASTING_LAYER_NAME }));
  expect(screen.queryByLabelText('Legenda peringatan dini cuaca')).not.toBeInTheDocument();
});

test('only matching layer events toggle and popup never invents weather potential', () => {
  const toggle = jest.fn();
  const view = render(<NowcastingEvents onToggle={toggle} />);
  act(() => mockEvents.overlayadd({ name: 'Hotspot BMKG' }));
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
  useDisasterSource.mockReturnValue({ data, error: false });
  const onState = jest.fn();
  const view = render(<NowcastingLayer onState={onState} />);
  expect(screen.getByTestId('polygon-1')).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(15000));
  expect(screen.queryByTestId('polygon-1')).not.toBeInTheDocument();
  useDisasterSource.mockReturnValue({ data: { ...data, features: [makeWarning()] }, error: true });
  view.rerender(<NowcastingLayer onState={onState} />);
  expect(screen.queryByTestId('polygon-1')).not.toBeInTheDocument();
  view.unmount();
  expect(jest.getTimerCount()).toBe(0);
});

test('empty response is not presented as all-clear and fetch time is not a source update', () => {
  render(<NowcastingStatus state={{ data: { features: [], rawCount: 0, fetchedAt: '2026-09-24T02:33:07Z', latestIssuedAt: null }, visibleCount: 0 }} />);
  expect(screen.getByRole('status')).toHaveTextContent('bukan konfirmasi');
  expect(screen.getByRole('status')).toHaveTextContent('Terakhir berhasil diambil');
  expect(screen.getByRole('status')).not.toHaveTextContent('dibuat BMKG');
});
