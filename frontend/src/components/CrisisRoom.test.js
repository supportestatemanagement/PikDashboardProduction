import { render, screen } from '@testing-library/react';
import CrisisRoom from './CrisisRoom';
import { CrisisRoomClient } from '../services/crisisRoom';

jest.mock('../services/crisisRoom', () => ({
  isCrisisBroadcaster: user => user.username === 'Astina' && user.role === 'crisis_broadcaster',
  CrisisRoomClient: jest.fn().mockImplementation(() => ({ updateSession: jest.fn(), destroy: jest.fn() })),
}));

beforeEach(() => {
  CrisisRoomClient.mockImplementation(() => ({ updateSession: jest.fn(), destroy: jest.fn() }));
});

test('viewer has live video but no broadcast controls', () => {
  render(<CrisisRoom session={{ user: { username: 'viewer' } }} onSessionExpired={jest.fn()} />);
  expect(screen.getByLabelText('Live CCTV HCP Hikvision')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Start Share Screen' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Stop Broadcast' })).not.toBeInTheDocument();
});

test('Astina gets start and stop controls with HCP selection instructions', () => {
  render(<CrisisRoom session={{ user: { username: 'Astina', role: 'crisis_broadcaster' } }} onSessionExpired={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Start Share Screen' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Stop Broadcast' })).toBeDisabled();
  expect(screen.getByText(/Pilih window HCP Hikvision/)).toBeInTheDocument();
});
