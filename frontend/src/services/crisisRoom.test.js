import { CrisisRoomClient, isCrisisBroadcaster } from './crisisRoom';
import { dashboardRequest } from './dashboardSession';
jest.mock('./dashboardSession', () => ({ ...jest.requireActual('./dashboardSession'), dashboardRequest: jest.fn() }));

class FakeSocket {
  static OPEN = 1;
  static instances = [];
  constructor() { this.readyState = 0; this.sent = []; FakeSocket.instances.push(this); }
  open() { this.readyState = 1; this.onopen(); }
  send(value) { this.sent.push(JSON.parse(value)); }
  close() { this.readyState = 3; this.onclose?.(); }
  receive(value) { this.onmessage({ data: JSON.stringify(value) }); }
}

class FakePeer {
  static instances = [];
  constructor(config) { this.config = config; this.connectionState = 'new'; this.tracks = []; this.candidates = []; FakePeer.instances.push(this); }
  setConfiguration(config) { this.config = config; }
  addTrack(track, stream) { this.tracks.push([track, stream]); }
  async createOffer() { return { type: 'offer', sdp: 'whole-grid' }; }
  async createAnswer() { return { type: 'answer', sdp: 'viewer-answer' }; }
  async setLocalDescription(value) {
    this.localDescription = value;
    this.onicecandidate?.({ candidate: { toJSON: () => ({ candidate: 'local-ice' }) } });
  }
  async setRemoteDescription(value) { this.remoteDescription = value; }
  async addIceCandidate(candidate) { this.candidates.push(candidate); }
  close() { this.connectionState = 'closed'; }
}

const session = { sessionToken: 'signed-token', user: { username: 'Astina', role: 'crisis_broadcaster' } };
let client;
let callbacks;
let originalSocket;
let originalPeer;
let originalMedia;

beforeEach(() => {
  jest.useFakeTimers();
  originalSocket = global.WebSocket;
  originalPeer = global.RTCPeerConnection;
  originalMedia = navigator.mediaDevices;
  global.WebSocket = FakeSocket;
  global.RTCPeerConnection = FakePeer;
  FakeSocket.instances = [];
  FakePeer.instances = [];
  callbacks = { onStatus: jest.fn(), onStream: jest.fn(), onError: jest.fn(), onSessionExpired: jest.fn() };
  dashboardRequest.mockReset();
  dashboardRequest.mockResolvedValue({ iceServers: [{ urls: ['stun:test.example:3478'] }], turnConfigured: false, expiresAt: Date.now() + 3600000 });
});
afterEach(() => {
  client?.destroy();
  client = null;
  global.WebSocket = originalSocket;
  global.RTCPeerConnection = originalPeer;
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: originalMedia });
  jest.useRealTimers();
});

async function receive(socket, message) { socket.receive(message); await client.queue; }

test('only the exact Astina broadcaster identity has broadcast controls', () => {
  expect(isCrisisBroadcaster(session.user)).toBe(true);
  expect(isCrisisBroadcaster({ username: 'Astina', role: 'admin' })).toBe(false);
  expect(isCrisisBroadcaster({ username: 'viewer', role: 'crisis_broadcaster' })).toBe(false);
});

test('one captured grid is added to each viewer and SDP precedes ICE; stop releases capture', async () => {
  const track = { stop: jest.fn(), addEventListener: jest.fn() };
  const stream = { getVideoTracks: () => [track], getTracks: () => [track] };
  const capture = jest.fn().mockResolvedValue(stream);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia: capture } });
  client = new CrisisRoomClient({ session, broadcast: true, ...callbacks });
  const socket = FakeSocket.instances[0];
  socket.open();
  expect(socket.sent[0]).toEqual({ type: 'auth', mode: 'broadcast', token: 'signed-token' });
  await receive(socket, { type: 'ready', live: false });
  await client.start();
  expect(capture).toHaveBeenCalledWith(expect.objectContaining({ audio: false }));
  expect(socket.sent.at(-1)).toEqual({ type: 'start' });
  await receive(socket, { type: 'status', live: true });
  await receive(socket, { type: 'viewer-joined', peer: 'viewer-1' });
  await receive(socket, { type: 'viewer-joined', peer: 'viewer-2' });
  expect(FakePeer.instances).toHaveLength(2);
  FakePeer.instances.forEach(peer => expect(peer.tracks).toEqual([[track, stream]]));
  const signals = socket.sent.filter(message => ['offer', 'ice'].includes(message.type));
  expect(signals.map(message => message.type)).toEqual(['offer', 'ice', 'offer', 'ice']);
  const call = signals[0].call;
  await receive(socket, { type: 'ice', peer: 'viewer-1', call, candidate: { candidate: 'remote' } });
  expect(FakePeer.instances[0].candidates).toHaveLength(0);
  await receive(socket, { type: 'answer', peer: 'viewer-1', call, sdp: 'answer' });
  expect(FakePeer.instances[0].candidates).toEqual([{ candidate: 'remote' }]);
  client.stop();
  expect(track.stop).toHaveBeenCalledTimes(1);
  expect(client.peers.size).toBe(0);
  expect(callbacks.onStatus).toHaveBeenLastCalledWith('OFFLINE');
  expect(socket.sent.at(-1)).toEqual({ type: 'stop' });
});

test('heartbeat detects a silent socket, reconnects and republishes retained capture', async () => {
  const track = { stop: jest.fn(), addEventListener: jest.fn() };
  const stream = { getVideoTracks: () => [track], getTracks: () => [track] };
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia: jest.fn().mockResolvedValue(stream) } });
  client = new CrisisRoomClient({ session, broadcast: true, ...callbacks });
  const socket = FakeSocket.instances[0];
  socket.open();
  await receive(socket, { type: 'ready', live: false });
  await client.start();
  jest.advanceTimersByTime(15000);
  expect(socket.sent.at(-1)).toEqual({ type: 'ping' });
  jest.advanceTimersByTime(61000);
  expect(callbacks.onStatus).toHaveBeenLastCalledWith('RECONNECTING');
  jest.advanceTimersByTime(2000);
  const replacement = FakeSocket.instances.at(-1);
  expect(replacement).not.toBe(socket);
  replacement.open();
  await receive(replacement, { type: 'ready', live: false });
  expect(replacement.sent.at(-1)).toEqual({ type: 'start' });
  expect(track.stop).not.toHaveBeenCalled();
  client.updateSession({ ...session, sessionToken: 'renewed' });
  expect(replacement.sent.at(-1)).toEqual({ type: 'auth', token: 'renewed' });
});

test('viewer answers, receives live video and returns offline when broadcast stops', async () => {
  client = new CrisisRoomClient({ session: { ...session, user: { username: 'viewer' } }, broadcast: false, ...callbacks });
  const socket = FakeSocket.instances[0];
  socket.open();
  await receive(socket, { type: 'ready', live: true });
  await receive(socket, { type: 'offer', peer: 'astina', call: 'grid', sdp: 'offer' });
  expect(socket.sent.slice(-2).map(message => message.type)).toEqual(['answer', 'ice']);
  const peer = FakePeer.instances[0];
  expect(dashboardRequest).not.toHaveBeenCalled();
  expect(peer.config.iceServers.every(server => !JSON.stringify(server.urls).includes('turn:'))).toBe(true);
  const stream = {};
  peer.ontrack({ streams: [stream] });
  expect(callbacks.onStream).toHaveBeenLastCalledWith(stream);
  peer.connectionState = 'connected';
  peer.onconnectionstatechange();
  expect(callbacks.onStatus).toHaveBeenLastCalledWith('LIVE');
  await receive(socket, { type: 'status', live: false });
  expect(peer.connectionState).toBe('closed');
  expect(callbacks.onStream).toHaveBeenLastCalledWith(null);
  expect(callbacks.onStatus).toHaveBeenLastCalledWith('OFFLINE');
});

test('viewer requests TURN only after the STUN-only attempt fails', async () => {
  client = new CrisisRoomClient({ session, broadcast: false, ...callbacks });
  const socket = FakeSocket.instances[0];
  socket.open();
  await receive(socket, { type: 'ready', live: true });
  await receive(socket, { type: 'offer', peer: 'astina', call: 'direct', sdp: 'offer' });
  expect(dashboardRequest).not.toHaveBeenCalled();
  const direct = FakePeer.instances[0];
  direct.connectionState = 'failed';
  direct.onconnectionstatechange();
  jest.advanceTimersByTime(3000);
  expect(socket.sent.at(-1)).toEqual({ type: 'request-offer', useTurn: true });
  await receive(socket, { type: 'offer', peer: 'astina', call: 'fallback', sdp: 'offer', useTurn: true });
  expect(dashboardRequest).toHaveBeenCalledTimes(1);
  expect(client.diagnostics.attemptMode).toBe('TURN_FALLBACK');
});

test('publisher timeout falls back for one viewer while another remains STUN-only', async () => {
  const track = { stop: jest.fn() };
  client = new CrisisRoomClient({ session, broadcast: true, ...callbacks });
  client.stream = { getVideoTracks: () => [track], getTracks: () => [track] };
  const socket = FakeSocket.instances[0];
  socket.open();
  await receive(socket, { type: 'ready', live: true });
  await receive(socket, { type: 'viewer-joined', peer: 'external' });
  await receive(socket, { type: 'viewer-joined', peer: 'office' });
  expect(dashboardRequest).not.toHaveBeenCalled();
  const office = client.peers.get('office').pc;
  office.connectionState = 'connected';
  office.onconnectionstatechange();
  dashboardRequest.mockResolvedValue({ iceServers: [{ urls: ['turn:relay.example:3478'], username: 'temp', credential: 'temp' }], turnConfigured: true, expiresAt: Date.now() + 3600000 });
  jest.advanceTimersByTime(30000);
  await client.queue;
  expect(dashboardRequest).toHaveBeenCalledTimes(1);
  expect(client.peers.get('office').pc).toBe(office);
  expect(client.peers.get('office').useTurn).toBe(false);
  expect(client.peers.get('external').useTurn).toBe(true);
  expect(socket.sent.filter(signal => signal.type === 'offer').map(signal => signal.useTurn)).toEqual([false, false, true]);
  expect(track.stop).not.toHaveBeenCalled();
});

test('viewer leaving during TURN credential loading cancels the publisher fallback', async () => {
  const track = { stop: jest.fn() };
  client = new CrisisRoomClient({ session, broadcast: true, ...callbacks });
  client.stream = { getVideoTracks: () => [track], getTracks: () => [track] };
  client.ready = true;
  const socket = FakeSocket.instances[0];
  socket.open();
  let resolveCredentials;
  dashboardRequest.mockImplementation(() => new Promise(resolve => { resolveCredentials = resolve; }));
  const pending = client.offer('departing', true);
  await client.message({ type: 'viewer-left', peer: 'departing' });
  resolveCredentials({ iceServers: [{ urls: ['turn:relay.example:3478'], username: 'temp', credential: 'temp' }], turnConfigured: true, expiresAt: Date.now() + 3600000 });
  await pending;
  expect(client.peers.size).toBe(0);
  expect(socket.sent.some(signal => signal.type === 'offer')).toBe(false);
  expect(track.stop).not.toHaveBeenCalled();
});

test('destroy cancels reconnect and stops capture acquired after the page closes', async () => {
  let resolveCapture;
  const track = { stop: jest.fn() };
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia: () => new Promise(resolve => { resolveCapture = resolve; }) } });
  client = new CrisisRoomClient({ session, broadcast: true, ...callbacks });
  const pending = client.start();
  client.destroy();
  resolveCapture({ getTracks: () => [track] });
  await pending;
  expect(track.stop).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(120000);
  expect(FakeSocket.instances).toHaveLength(1);
});

test('a stale broadcaster slot during reconnect does not stop HCP capture', async () => {
  const track = { stop: jest.fn(), addEventListener: jest.fn() };
  const stream = { getVideoTracks: () => [track], getTracks: () => [track] };
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia: jest.fn().mockResolvedValue(stream) } });
  client = new CrisisRoomClient({ session, broadcast: true, ...callbacks });
  await client.start();
  const socket = FakeSocket.instances[0];
  socket.open();
  await receive(socket, { type: 'error', code: 'broadcaster-busy', message: 'Waiting for previous connection' });
  expect(track.stop).not.toHaveBeenCalled();
  expect(client.closed).toBe(false);
  expect(callbacks.onStatus).toHaveBeenLastCalledWith('RECONNECTING');
  jest.advanceTimersByTime(2000);
  const replacement = FakeSocket.instances[1];
  replacement.open();
  await receive(replacement, { type: 'ready', live: false });
  expect(replacement.sent.at(-1)).toEqual({ type: 'start' });
});

test('origin rejection is visible and retries without terminating capture', async () => {
  const track = { stop: jest.fn(), addEventListener: jest.fn() };
  const stream = { getVideoTracks: () => [track], getTracks: () => [track] };
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia: jest.fn().mockResolvedValue(stream) } });
  client = new CrisisRoomClient({ session, broadcast: true, ...callbacks });
  await client.start();
  const socket = FakeSocket.instances[0];
  socket.open();
  await receive(socket, { type: 'error', code: 'origin-not-allowed', message: 'Atur CRISIS_ALLOWED_ORIGINS sesuai URL dashboard.' });
  expect(callbacks.onError).toHaveBeenLastCalledWith(expect.stringContaining('CRISIS_ALLOWED_ORIGINS'));
  expect(track.stop).not.toHaveBeenCalled();
  expect(client.closed).toBe(false);
});

test('transport failure reports the signaling URL rather than silently reconnecting', () => {
  const onDiagnostics = jest.fn();
  client = new CrisisRoomClient({ session, broadcast: false, onDiagnostics, ...callbacks });
  FakeSocket.instances[0].onerror();
  expect(callbacks.onError).toHaveBeenLastCalledWith(expect.stringContaining('/api/crisis-room/ws'));
  expect(onDiagnostics).toHaveBeenLastCalledWith(expect.objectContaining({ signaling: 'RECONNECTING' }));
});

test('missing offer is distinguished from direct WebRTC connectivity failure', async () => {
  client = new CrisisRoomClient({ session, broadcast: false, ...callbacks });
  const socket = FakeSocket.instances[0];
  socket.open();
  await receive(socket, { type: 'ready', live: true, serverId: 'same-worker' });
  jest.advanceTimersByTime(15000);
  expect(callbacks.onError).toHaveBeenLastCalledWith(expect.stringContaining('belum mengirim tawaran video'));
  await receive(socket, { type: 'offer', peer: 'astina', call: 'grid', sdp: 'offer' });
  jest.advanceTimersByTime(30000);
  expect(callbacks.onError).toHaveBeenLastCalledWith(expect.stringContaining('koneksi video WebRTC belum berhasil'));
});

test('TURN fallback uses temporary backend credentials with direct connections allowed', async () => {
  const iceServers = [{ urls: ['turns:relay.example:443?transport=tcp'], username: 'temporary', credential: 'temporary-password' }];
  dashboardRequest.mockResolvedValue({ iceServers, turnConfigured: true, expiresAt: Date.now() + 3600000 });
  client = new CrisisRoomClient({ session, broadcast: false, ...callbacks });
  const socket = FakeSocket.instances[0];
  socket.open();
  await receive(socket, { type: 'ready', live: true });
  await receive(socket, { type: 'offer', peer: 'astina', call: 'grid', useTurn: true, sdp: 'offer' });
  expect(dashboardRequest).toHaveBeenCalledWith('/api/crisis-room/ice-servers', session, expect.any(AbortSignal));
  expect(FakePeer.instances[0].config).toEqual({ iceServers, iceTransportPolicy: 'all' });
  const pc = FakePeer.instances[0];
  pc.getStats = jest.fn().mockResolvedValue(new Map([
    ['transport', { type: 'transport', selectedCandidatePairId: 'pair' }],
    ['pair', { localCandidateId: 'local', remoteCandidateId: 'remote' }],
    ['local', { candidateType: 'relay' }], ['remote', { candidateType: 'host' }],
  ]));
  await client.reportPeerRoute(client.peers.get('astina'));
  expect(client.diagnostics.route).toBe('TURN');
});

test('unavailable TURN credentials preserve the direct path and display a configuration error', async () => {
  dashboardRequest.mockRejectedValue(new Error('backend unavailable'));
  client = new CrisisRoomClient({ session, broadcast: false, ...callbacks });
  const socket = FakeSocket.instances[0];
  socket.open();
  await receive(socket, { type: 'ready', live: true });
  await receive(socket, { type: 'offer', peer: 'astina', call: 'grid', useTurn: true, sdp: 'offer' });
  expect(FakePeer.instances[0].config.iceTransportPolicy).toBe('all');
  expect(client.diagnostics.turn).toBe('UNAVAILABLE');
  expect(callbacks.onError).toHaveBeenLastCalledWith(expect.stringContaining('konfigurasi TURN di Render'));
});

test('temporary TURN credentials renew and renegotiate while keeping Astina capture running', async () => {
  const track = { stop: jest.fn(), addEventListener: jest.fn() };
  const stream = { getVideoTracks: () => [track], getTracks: () => [track] };
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia: jest.fn().mockResolvedValue(stream) } });
  const originalExpiry = Date.now() + 300000;
  dashboardRequest.mockResolvedValueOnce({ iceServers: [{ urls: ['turn:relay.example:3478'], username: 'old', credential: 'old-password' }], turnConfigured: true, expiresAt: originalExpiry })
    .mockImplementation(async () => ({ iceServers: [{ urls: ['turn:relay.example:3478'], username: 'renewed', credential: 'new-password' }], turnConfigured: true, expiresAt: Date.now() + 3600000 }));
  client = new CrisisRoomClient({ session, broadcast: true, ...callbacks });
  const socket = FakeSocket.instances[0];
  socket.open();
  await receive(socket, { type: 'ready', live: false });
  await client.start();
  await receive(socket, { type: 'status', live: true });
  await receive(socket, { type: 'viewer-joined', peer: 'viewer', useTurn: true });
  const pc = FakePeer.instances[0];
  pc.connectionState = 'connected';
  pc.onconnectionstatechange();
  const send = socket.send.bind(socket);
  socket.send = value => { send(value); if (JSON.parse(value).type === 'ping') client.lastReceived = Date.now(); };
  jest.advanceTimersByTime(180000);
  await client.queue;
  expect(dashboardRequest).toHaveBeenCalledTimes(2);
  expect(FakePeer.instances.at(-1).config.iceServers[0].username).toBe('renewed');
  expect(track.stop).not.toHaveBeenCalled();
  expect(client.stream).toBe(stream);
  expect(socket.sent.filter(message => message.type === 'offer')).toHaveLength(2);
});
