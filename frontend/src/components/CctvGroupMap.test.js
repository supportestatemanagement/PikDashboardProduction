import { fireEvent, render, screen, within } from '@testing-library/react';
import CctvGroupMap from './CctvGroupMap';
import { CCTV_AREAS } from './cctvAreas';
jest.mock('react-leaflet', () => {
  const Container = ({ children }) => <div>{children}</div>;
  return { MapContainer: Container, Popup: Container, Tooltip: Container,
    Polygon: ({ children, positions }) => <div data-testid="polygon" data-first={JSON.stringify(positions[0])}>{children}</div>,
    TileLayer: () => null, AttributionControl: () => null,
    useMap: () => ({ fitBounds: jest.fn() }) };
});
test('counts Area Kelompok regardless of old group or coordinate fields', () => {
  render(<CctvGroupMap records={[
    { Tahun: 2026, 'Area Kelompok': 'Sektor Tengah', Kelompok: 'A' },
    { 'Nama Pada Layar (OSD)': 'Camera', 'Area Kelompok': ' sektor tengah ', Kelompok: 'B' },
    { Tahun: 2026, 'Area Kelompok': 'Other', Kelompok: 'Sektor Tengah' },
    { 'Area Kelompok': 'Sektor Tengah' },
  ]} />);
  expect(screen.getByText('Total CCTV:')).toHaveTextContent('Total CCTV: 2');
  expect(screen.getByTestId('polygon')).toHaveAttribute('data-first', '[-6.1025433,106.7421972]');
  expect(CCTV_AREAS[0].coordinates.at(-1)).toEqual(CCTV_AREAS[0].coordinates[0]);
  expect(screen.queryByText('Edit lokasi')).not.toBeInTheDocument();
});
test('area map can expand and close', () => {
  const show = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  render(<CctvGroupMap records={[]} />);
  const button = screen.getByRole('button', { name: 'Perbesar peta CCTV' });
  fireEvent.click(button);
  expect(within(screen.getByRole('dialog')).getByText('Total CCTV:')).toHaveTextContent('Total CCTV: 0');
  fireEvent.click(screen.getByText('Tutup'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(button).toHaveFocus();
  HTMLDialogElement.prototype.showModal = show;
});
