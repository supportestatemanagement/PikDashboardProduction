import { act, render } from '@testing-library/react';
import { VehicleMarker } from './VehicleTrackingLayer';

let mockPosition;
const mockSetLatLng = jest.fn(position => { mockPosition = { lat: position[0], lng: position[1] }; });
jest.mock('../services/vehicleTrackingService', () => ({ subscribeVehicles: jest.fn() }));
jest.mock('./VehicleAuthProvider', () => ({ useVehicleAuth: jest.fn() }));
jest.mock('react-leaflet', () => {
  const React = require('react');
  return {
    Marker: React.forwardRef(({ children }, ref) => {
      React.useImperativeHandle(ref, () => ({ getLatLng: () => mockPosition, setLatLng: mockSetLatLng }), []);
      return <div>{children}</div>;
    }),
    Tooltip: ({ children }) => <div>{children}</div>, Popup: ({ children }) => <div>{children}</div>,
  };
});
const vehicle = (latitude = -6, longitude = 106) => ({ id: 'MACAN_GI', latitude, longitude, position: [latitude, longitude], timestamp: 10000, tracking: true });
let clock, frames, nextId, originalMatchMedia;
beforeEach(() => {
  clock = 0; nextId = 0; frames = new Map(); mockPosition = { lat: -6, lng: 106 };
  mockSetLatLng.mockClear();
  mockSetLatLng.mockImplementation(position => { mockPosition = { lat: position[0], lng: position[1] }; });
  originalMatchMedia = window.matchMedia;
  window.matchMedia = () => ({ matches: false });
  jest.spyOn(performance, 'now').mockImplementation(() => clock);
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(fn => { frames.set(++nextId, fn); return nextId; });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => frames.delete(id));
});
afterEach(() => { jest.restoreAllMocks(); window.matchMedia = originalMatchMedia; });
function tick(time) {
  clock = time;
  const callbacks = [...frames.values()]; frames.clear();
  act(() => callbacks.forEach(fn => fn(time)));
}
test('smoothly spreads movement across the observed interval and stops at the received fix', () => {
  const { rerender } = render(<VehicleMarker vehicle={vehicle()} now={10000} connected />);
  expect(frames.size).toBe(0);
  clock = 4000;
  rerender(<VehicleMarker vehicle={vehicle(-6.001, 106.001)} now={10000} connected />);
  tick(5000);
  expect(mockPosition.lat).toBeCloseTo(-6.00025, 7);
  tick(8000);
  expect(mockPosition).toEqual({ lat: -6.001, lng: 106.001 });
  expect(frames.size).toBe(0);
});
test('retargets from the visible position, ignores metadata-only updates and cleans up frames', () => {
  const { rerender, unmount } = render(<VehicleMarker vehicle={vehicle()} now={10000} connected />);
  clock = 4000;
  rerender(<VehicleMarker vehicle={vehicle(-6.001, 106.001)} now={10000} connected />);
  tick(5000);
  const visible = { ...mockPosition };
  rerender(<VehicleMarker vehicle={vehicle(-6.002, 106.002)} now={10000} connected />);
  expect(frames.size).toBe(1);
  expect(mockPosition).toEqual(visible);
  const scheduled = window.requestAnimationFrame.mock.calls.length;
  rerender(<VehicleMarker vehicle={{ ...vehicle(-6.002, 106.002), speed: 25 }} now={15000} connected />);
  expect(window.requestAnimationFrame).toHaveBeenCalledTimes(scheduled);
  tick(6000);
  expect(mockPosition).toEqual({ lat: -6.002, lng: 106.002 });
  clock = 7000;
  rerender(<VehicleMarker vehicle={vehicle(-6.003, 106.003)} now={15000} connected />);
  unmount();
  expect(frames.size).toBe(0);
});
test('caps long gaps at five seconds and honors reduced motion', () => {
  const { rerender } = render(<VehicleMarker vehicle={vehicle()} now={10000} connected />);
  clock = 60000;
  rerender(<VehicleMarker vehicle={vehicle(-6.001, 106.001)} now={60000} connected />);
  tick(65000);
  expect(mockPosition).toEqual({ lat: -6.001, lng: 106.001 });
  window.matchMedia = () => ({ matches: true });
  rerender(<VehicleMarker vehicle={vehicle(-6.002, 106.002)} now={65000} connected />);
  expect(mockPosition).toEqual({ lat: -6.002, lng: 106.002 });
  expect(frames.size).toBe(0);
});
