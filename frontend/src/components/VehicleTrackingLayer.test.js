import { render, screen } from '@testing-library/react';
import { VehicleMarker } from './VehicleTrackingLayer';
const mockSetLatLng = jest.fn();
jest.mock('../services/vehicleTrackingService', () => ({ subscribeVehicles: jest.fn() }));
jest.mock('./VehicleAuthProvider', () => ({ useVehicleAuth: jest.fn() }));
jest.mock('react-leaflet', () => {
  const React = require('react');
  return {
    Marker: React.forwardRef(({ children }, ref) => {
      React.useImperativeHandle(ref, () => ({ setLatLng: mockSetLatLng }), []);
      return <div>{children}</div>;
    }), Tooltip: ({ children }) => <div>{children}</div>, Popup: ({ children }) => <div>{children}</div>,
  };
});
const vehicle = (latitude = -6, longitude = 106) => ({ id: 'MACAN_GI', latitude, longitude, position: [latitude, longitude], timestamp: 1790300000000, tracking: true });
beforeEach(() => mockSetLatLng.mockClear());
test('displays latest Firebase coordinates immediately without interpolating across corners', () => {
  const { rerender } = render(<VehicleMarker vehicle={vehicle()} now={1790300000000} connected />);
  rerender(<VehicleMarker vehicle={vehicle(-6.001, 106.002)} now={1790300000000} connected />);
  expect(mockSetLatLng).toHaveBeenLastCalledWith([-6.001, 106.002]);
  const calls = mockSetLatLng.mock.calls.length;
  rerender(<VehicleMarker vehicle={{ ...vehicle(-6.001, 106.002), speed: 20 }} now={1790300005000} connected />);
  expect(mockSetLatLng).toHaveBeenCalledTimes(calls);
});
test('hides stale GPS text from the vehicle label and popup', () => {
  render(<VehicleMarker vehicle={vehicle()} now={1790300061000} connected />);
  expect(screen.queryByText('Status: GPS tidak diperbarui')).not.toBeInTheDocument();
  expect(screen.queryByText('GPS tidak diperbarui')).not.toBeInTheDocument();
});
