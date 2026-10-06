import { fireEvent, render, screen } from '@testing-library/react';
import EarthquakePanel from './EarthquakePanel';
import EarthquakeLayer from './EarthquakeLayer';
import { focusMapToCoordinates, earthquakeIcon } from './earthquakeMap';

const mockMap = { hasLayer: jest.fn(), addLayer: jest.fn(), stop: jest.fn(), closePopup: jest.fn(), flyTo: jest.fn() };
const mockOpen = jest.fn();
jest.mock('react-leaflet', () => {
  const React = require('react');
  return {
    useMap: () => mockMap,
    LayerGroup: React.forwardRef(({ children }, ref) => {
      React.useImperativeHandle(ref, () => ({ id: 'group' }), []);
      return <div>{children}</div>;
    }),
    Marker: React.forwardRef(({ children, position, eventHandlers, title, icon }, ref) => {
      React.useImperativeHandle(ref, () => ({ getLatLng: () => ({ lat: position[0], lng: position[1] }), openPopup: mockOpen }), [position]);
      return <div><button data-icon={icon.options.className} onClick={eventHandlers.click}>{title}</button>{children}</div>;
    }),
    Popup: ({ children }) => <div>{children}</div>,
  };
});
const quake = { id: 'one', coordinates: [-6, 106], magnitude: 5.3, region: 'Wilayah Uji', depth: 10, datetime: '2026-09-24T03:00Z' };
beforeEach(() => { jest.clearAllMocks(); mockMap.hasLayer.mockReturnValue(false); });

test('all panel entries navigate with the correct source and selection follows the selected item', () => {
  const select = jest.fn();
  const latestSource = { data: { latest: quake } }, historySource = { data: { history: [quake] } }, feltSource = { data: { history: [{ ...quake, id: 'felt', region: 'Dirasakan Uji' }] } };
  const view = render(<EarthquakePanel latestSource={latestSource} historySource={historySource} feltSource={feltSource} onSelect={select} />);
  fireEvent.click(screen.getByRole('button', { name: /Lihat di Peta/ }));
  expect(select).toHaveBeenLastCalledWith(quake, 'latest');
  fireEvent.click(screen.getAllByRole('button')[1]);
  expect(select).toHaveBeenLastCalledWith(quake, 'history');
  view.rerender(<EarthquakePanel latestSource={latestSource} historySource={historySource} feltSource={feltSource} onSelect={select} selection={{ id: 'one', kind: 'history' }} />);
  expect(screen.getAllByRole('button')[1]).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getAllByRole('button')[0]).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(screen.getByRole('button', { name: /Dirasakan Uji/ }));
  expect(select).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'felt' }), 'felt');
});

test('explicit request restores hidden layer, flies to zoom eight, replaces popup; refresh never refocuses', () => {
  const select = jest.fn();
  const view = render(<EarthquakeLayer earthquakes={[quake]} kind="history" onSelect={select} />);
  expect(mockMap.flyTo).not.toHaveBeenCalled();
  const request = { kind: 'history', id: 'one' };
  view.rerender(<EarthquakeLayer earthquakes={[quake]} kind="history" onSelect={select} focusRequest={request} selection={request} />);
  expect(mockMap.addLayer).toHaveBeenCalledWith({ id: 'group' });
  expect(mockMap.flyTo).toHaveBeenCalledWith([-6, 106], 8, expect.any(Object));
  expect(mockMap.closePopup).toHaveBeenCalledTimes(1);
  expect(mockOpen).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button')).toHaveAttribute('data-icon', expect.stringContaining('selected'));
  view.rerender(<EarthquakeLayer earthquakes={[{ ...quake, magnitude: 5.4 }]} kind="history" onSelect={select} focusRequest={request} selection={request} />);
  expect(mockMap.flyTo).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button'));
  expect(select).toHaveBeenCalledWith(expect.objectContaining({ id: 'one' }), 'history', false);
  view.rerender(<EarthquakeLayer earthquakes={[quake]} kind="history" onSelect={select} focusRequest={{ ...request }} />);
  expect(mockOpen).toHaveBeenCalledTimes(2);
});

test('invalid coordinates cannot navigate and latest uses its distinct pulse class', () => {
  expect(focusMapToCoordinates(mockMap, [91, 100])).toBe(false);
  expect(mockMap.flyTo).not.toHaveBeenCalled();
  expect(earthquakeIcon('latest', 5, false).options.className).toContain('ppb-earthquake-latest');
  render(<EarthquakePanel latestSource={{ data: { latest: { ...quake, coordinates: null } } }} historySource={{}} />);
  expect(screen.getByRole('button')).toBeDisabled();
});

test('popup waits for map navigation to finish so auto pan does not interrupt the flight', () => {
  const map = { ...mockMap, once: jest.fn() };
  const open = jest.fn();
  focusMapToCoordinates(map, [-6, 106], 8, open);
  expect(open).not.toHaveBeenCalled();
  expect(map.once).toHaveBeenCalledWith('moveend', open);
  map.once.mock.calls[0][1]();
  expect(open).toHaveBeenCalledTimes(1);
});
