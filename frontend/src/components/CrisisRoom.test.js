import { act, render, screen } from '@testing-library/react';
import CrisisRoom from './CrisisRoom';
import { CrisisRoomClient } from '../services/crisisRoom';

jest.mock('../services/crisisRoom', () => ({
  isCrisisBroadcaster: user => user.username === 'Astina' && user.role === 'crisis_broadcaster',
  CrisisRoomClient: jest.fn().mockImplementation(() => ({ updateSession: jest.fn(), destroy: jest.fn() })),
}));

beforeEach(() => {
  CrisisRoomClient.mockClear();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  CrisisRoomClient.mockImplementation(() => ({ updateSession: jest.fn(), destroy: jest.fn() }));
});

afterEach(() => { jest.useRealTimers(); });

function visibility(state) {
  act(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

test('viewer disconnects after 30 seconds hidden and reconnects using the latest session', () => {
  jest.useFakeTimers();
  const expired = jest.fn();
  const initial = { user: { username: 'viewer' }, token: 'initial' };
  const latest = { ...initial, token: 'renewed' };
  const { rerender } = render(<CrisisRoom session={initial} onSessionExpired={expired} />);
  const first = CrisisRoomClient.mock.results[0].value;
  visibility('hidden');
  act(() => { jest.advanceTimersByTime(29999); });
  expect(first.destroy).not.toHaveBeenCalled();
  act(() => { jest.advanceTimersByTime(1); });
  expect(first.destroy).toHaveBeenCalledTimes(1);
  rerender(<CrisisRoom session={latest} onSessionExpired={expired} />);
  visibility('visible');
  expect(CrisisRoomClient).toHaveBeenCalledTimes(2);
  expect(CrisisRoomClient.mock.calls[1][0].session).toBe(latest);
  // A late callback from the old connection cannot overwrite the new one.
  act(() => { CrisisRoomClient.mock.calls[0][0].onStatus('LIVE'); });
  expect(screen.getByRole('status')).toHaveTextContent('CONNECTING');
});

test('returning before 30 seconds cancels the viewer disconnect', () => {
  jest.useFakeTimers();
  render(<CrisisRoom session={{ user: { username: 'viewer' } }} onSessionExpired={jest.fn()} />);
  const connection = CrisisRoomClient.mock.results[0].value;
  visibility('hidden');
  act(() => { jest.advanceTimersByTime(20000); });
  visibility('visible');
  act(() => { jest.advanceTimersByTime(60000); });
  expect(connection.destroy).not.toHaveBeenCalled();
  expect(CrisisRoomClient).toHaveBeenCalledTimes(1);
});

test('leaving the menu immediately closes the viewer and cancels background reconnect work', () => {
  jest.useFakeTimers();
  const props = { session: { user: { username: 'viewer' } }, onSessionExpired: jest.fn() };
  const { unmount } = render(<CrisisRoom {...props} />);
  const connection = CrisisRoomClient.mock.results[0].value;
  visibility('hidden');
  unmount();
  expect(connection.destroy).toHaveBeenCalledTimes(1);
  act(() => { jest.advanceTimersByTime(60000); });
  visibility('visible');
  expect(CrisisRoomClient).toHaveBeenCalledTimes(1);
  render(<CrisisRoom {...props} />);
  expect(CrisisRoomClient).toHaveBeenCalledTimes(2);
});

test('Astina stays connected when the tab is hidden beyond the viewer grace period', () => {
  jest.useFakeTimers();
  render(<CrisisRoom session={{ user: { username: 'Astina', role: 'crisis_broadcaster' } }} onSessionExpired={jest.fn()} />);
  const connection = CrisisRoomClient.mock.results[0].value;
  visibility('hidden');
  act(() => { jest.advanceTimersByTime(120000); });
  visibility('visible');
  expect(connection.destroy).not.toHaveBeenCalled();
  expect(CrisisRoomClient).toHaveBeenCalledTimes(1);
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
