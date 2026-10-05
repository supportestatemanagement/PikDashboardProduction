import { CrisisRoomClient, isCrisisBroadcaster } from './crisisRoom';

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
  constructor() { this.connectionState = 'new'; this.tracks = []; this.candidates = []; FakePeer.instances.push(this); }
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
