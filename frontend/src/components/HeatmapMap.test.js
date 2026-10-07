import { render, screen } from '@testing-library/react';
import HeatmapMap from './HeatmapMap';
import trackerBgm from '../config/vehicleTrackerBgm.json';

jest.mock('./VehicleTrackingLayer', () => () => <div>Realtime GPS layer</div>);
jest.mock('leaflet', () => ({ divIcon: options => options, latLngBounds: points => points }));
jest.mock('react-leaflet', () => {
  const React = require('react');
  const Container = ({ children }) => <div>{children}</div>;
  const LayersControl = Container;
  LayersControl.BaseLayer = ({ name, checked, children }) => <section aria-label={name} data-active={Boolean(checked)}>{children}</section>;
  return {
    MapContainer: Container, LayersControl, AttributionControl: () => null,
    TileLayer: ({ className, attribution, url }) => <div data-testid={className || 'satellite-tiles'} data-url={url} dangerouslySetInnerHTML={{ __html: attribution }} />,
    GeoJSON: ({ data }) => <div data-testid="boundaries" data-geometry={JSON.stringify(data)} />,
    Marker: ({ children, icon, title }) => <div title={title}><span dangerouslySetInnerHTML={{ __html: icon.html }} />{children}</div>,
    Popup: Container,
    useMap: () => ({}),
    useMapEvents: () => ({ getZoom: () => 12 }),
  };
});

const water = [{ id: 'water-1', name: 'Pos Air', position: [-6.11, 106.75] }];
test('basemaps retain linked provider attribution and use the canonical OSM endpoint', () => {
  render(<HeatmapMap mode="vehicle-tracker" isActive={false} showLiveVehicles={false} />);
  expect(screen.getByRole('link', { name: 'Powered by Esri' })).toHaveAttribute('href', 'https://www.esri.com/');
  expect(screen.getByRole('link', { name: 'OpenStreetMap contributors' })).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
  expect(screen.getByRole('link', { name: 'ODbL' })).toHaveAttribute('href', 'https://opendatacommons.org/licenses/odbl/1-0/');
  expect(screen.getByTestId('vehicle-street-tiles')).toHaveAttribute('data-url', 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
});
test('history shares live basemap and area boundaries while displaying only its own tracking layer', () => {
  render(<HeatmapMap mode="vehicle-tracker" isActive={false} showLiveVehicles={false}><div>History route</div></HeatmapMap>);
  expect(screen.getByRole('region', { name: 'Peta Jalan' })).toHaveAttribute('data-active', 'true');
  expect(screen.getByText('History route')).toBeInTheDocument();
  expect(screen.queryByText('Realtime GPS layer')).not.toBeInTheDocument();
  expect(screen.getByText('BGM')).toBeInTheDocument();
  expect(screen.getByText('GI')).toBeInTheDocument();
  const geometry = JSON.parse(screen.getByTestId('boundaries').dataset.geometry);
  expect(geometry.features.find(feature => feature.properties.name === 'BGM')).toEqual(trackerBgm);
});

test('Vehicle Tracker opens road map with GPS and labels without traffic counts or checkpoints', () => {
  render(<HeatmapMap mode="vehicle-tracker" isActive={false} waterLocations={water} traffic={{ vehicles: { bgm: 12345 } }} />);
  expect(screen.getByRole('region', { name: 'Peta Jalan' })).toHaveAttribute('data-active', 'true');
  expect(screen.getByTestId('vehicle-street-tiles')).toBeInTheDocument();
  expect(screen.getByText('Realtime GPS layer')).toBeInTheDocument();
  expect(screen.queryByTitle('Berbagi Air: Pos Air')).not.toBeInTheDocument();
  expect(screen.getByText('BGM')).toBeInTheDocument();
  expect(screen.queryByText('12.345')).not.toBeInTheDocument();
  expect(screen.queryByText('Vehicle In')).not.toBeInTheDocument();
  expect(screen.queryByTitle('Titik masuk BGM Toll')).not.toBeInTheDocument();
  const geometry = JSON.parse(screen.getByTestId('boundaries').dataset.geometry);
  expect(geometry.features.find(f => f.properties.name === 'BGM')).toEqual(trackerBgm);
  const ring = trackerBgm.geometry.coordinates[0];
  expect(ring[0]).toEqual(ring[ring.length - 1]);
});

test('Traffic retains counting and checkpoint data, without GPS/water or new tracker boundary', () => {
  render(<HeatmapMap isActive={false} waterLocations={water} traffic={{ vehicles: { bgm: 12345 } }} />);
  expect(screen.getByRole('region', { name: 'Satelit' })).toHaveAttribute('data-active', 'true');
  expect(screen.getAllByText('12.345').length).toBeGreaterThan(0);
  expect(screen.getByTitle('Titik masuk BGM Toll')).toBeInTheDocument();
  expect(screen.queryByText('Realtime GPS layer')).not.toBeInTheDocument();
  expect(screen.queryByTitle('Berbagi Air: Pos Air')).not.toBeInTheDocument();
  const geometry = JSON.parse(screen.getByTestId('boundaries').dataset.geometry);
  expect(geometry.features.find(f => f.properties.name === 'BGM')).not.toEqual(trackerBgm);
});
