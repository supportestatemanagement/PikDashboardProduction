import { fireEvent, render, screen } from '@testing-library/react';
import VolcanoLayer from './VolcanoLayer';
import { normalizeVolcano } from '../../services/disaster/pvmbgVolcano';

const mockMap = { hasLayer: jest.fn(), addLayer: jest.fn(), flyTo: jest.fn() };
const mockOpenPopup = jest.fn();
jest.mock('react-leaflet', () => {
  const React = require('react');
  return {
    useMap: () => mockMap,
    LayerGroup: React.forwardRef(({ children }, ref) => {
      React.useImperativeHandle(ref, () => ({ layer: 'volcano' }), []);
      return <div>{children}</div>;
    }),
    Marker: React.forwardRef(({ children, position, title, eventHandlers, icon }, ref) => {
      React.useImperativeHandle(ref, () => ({ getLatLng: () => position, openPopup: mockOpenPopup }), [position]);
      return <div><button onClick={eventHandlers.click} data-icon={icon.options.html}>{title}</button>{children}</div>;
    }),
    Popup: ({ children }) => <div>{children}</div>,
  };
});

const volcano = normalizeVolcano({ id: 'test', name: 'Gunung Uji', level: 3, latitude: -6, longitude: 105, recommendation: 'Rekomendasi uji lengkap. Jangan dipotong.' });
beforeEach(() => jest.clearAllMocks());

test('only valid non-fallback coordinates render and marker selection reaches panel callback', () => {
  const onSelect = jest.fn();
  const view = render(<VolcanoLayer volcanoes={[volcano, { ...volcano, id: 'invalid', latitude: 95 }]} onSelect={onSelect} isFallback={false} />);
  expect(screen.getAllByRole('button')).toHaveLength(1);
  const marker = screen.getByRole('button', { name: 'Gunung Uji — SIAGA' });
  expect(marker.getAttribute('data-icon')).toContain('#f97316');
  expect(marker.getAttribute('data-icon')).toContain('▲');
  fireEvent.click(marker);
  expect(onSelect).toHaveBeenCalledWith(volcano);
  expect(screen.getByText('Level III — SIAGA')).toBeInTheDocument();
  expect(screen.getByText('Update: Tidak tersedia dari sumber')).toBeInTheDocument();
  expect(screen.getByText(volcano.recommendation)).toBeInTheDocument();
  view.rerender(<VolcanoLayer volcanoes={[volcano]} onSelect={onSelect} isFallback />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('panel navigation restores hidden layer, focuses zoom nine and opens popup repeatedly', () => {
  mockMap.hasLayer.mockReturnValue(false);
  const view = render(<VolcanoLayer volcanoes={[volcano]} focusRequest={{ id: volcano.id }} isFallback={false} onSelect={jest.fn()} />);
  expect(mockMap.addLayer).toHaveBeenCalledWith({ layer: 'volcano' });
  expect(mockMap.flyTo).toHaveBeenCalledWith([-6, 105], 9, expect.any(Object));
  expect(mockOpenPopup).toHaveBeenCalledTimes(1);
  mockMap.hasLayer.mockReturnValue(true);
  view.rerender(<VolcanoLayer volcanoes={[volcano]} focusRequest={{ id: volcano.id }} isFallback={false} onSelect={jest.fn()} />);
  expect(mockOpenPopup).toHaveBeenCalledTimes(2);
  expect(mockMap.addLayer).toHaveBeenCalledTimes(1);
});
