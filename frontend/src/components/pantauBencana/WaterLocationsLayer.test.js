import { render, screen } from '@testing-library/react';
import WaterLocationsLayer from './WaterLocationsLayer';

jest.mock('react-leaflet', () => ({
  useMap: () => ({}),
  LayerGroup: ({ children }) => <div>{children}</div>,
  Marker: ({ children, title }) => <div role="region" aria-label={title}>{children}</div>,
  Popup: ({ children }) => <div>{children}</div>,
}));

test('one marker shows all distribution records and hides undated or invalid locations', () => {
  const entry = { id: '1', date: '2026-09-09', number: 1, location: 'Tanjung Pasir', village: 'Kp. Gaga', district: 'Teluknaga', households: 320, residents: 1280 };
  render(<WaterLocationsLayer locations={[
    { id: 'water', name: 'Tanjung Pasir', position: [-6.035023, 106.6561049], distributions: [entry, { ...entry, id: '2', date: '2026-09-13', households: 375, residents: 1500 }] },
    { id: 'undated', name: 'Tanpa tanggal', position: [-6, 106], distributions: [{ ...entry, date: '' }] },
    { id: 'invalid', name: 'Koordinat salah', position: [91, 106], distributions: [entry] },
  ]} />);
  expect(screen.getAllByRole('region')).toHaveLength(1);
  for (const text of ['09/09/2026', '13/09/2026', '320', '1280', '375', '1500']) {
    expect(screen.getByText(text)).toBeInTheDocument();
  }
  expect(screen.getAllByText('Kp. Gaga')).toHaveLength(2);
  expect(screen.getAllByText('Teluknaga')).toHaveLength(2);
});
