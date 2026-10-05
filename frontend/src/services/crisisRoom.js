import { API_URL } from './dashboardSession';

export { isCrisisBroadcaster } from './dashboardSession';

export function crisisSocketUrl() {
  const url = new URL(`${API_URL.replace(/\/$/, '')}/api/crisis-room/ws`, window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}

// One captured HCP window; one direct peer connection per viewer.
export class CrisisRoomClient {
  constructor({ session, broadcast, onStatus, onStream, onError, onSessionExpired, onDiagnostics = () => {} }) {
    Object.assign(this, { session, broadcast, onStatus, onStream, onError, onSessionExpired });
    this.peers = new Map();
    this.stream = null;
    this.closed = false;
    this.live = false;
    this.ready = false;
    this.attempt = 0;
    this.queue = Promise.resolve();
    this.onDiagnostics = onDiagnostics;
    this.diagnostics = { origin: window.location.origin, signalingUrl: crisisSocketUrl(), signaling: 'CONNECTING', broadcast: 'UNKNOWN', video: 'WAITING', ice: 'NEW' };
    this.connect();
  }

  diagnose(changes) {
    Object.assign(this.diagnostics, changes);
    this.onDiagnostics({ ...this.diagnostics });
  }

  send(message) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  updateSession(session) {
    this.session = session;
    if (this.ready) this.send({ type: 'auth', token: session.sessionToken });
  }

  connect() {
    if (this.closed) return;
    this.onStatus(this.attempt ? 'RECONNECTING' : 'CONNECTING');
    this.diagnose({ signaling: this.attempt ? 'RECONNECTING' : 'CONNECTING' });
    this.failureMessage = '';
    let socket;
    try {
      socket = new WebSocket(crisisSocketUrl());
    } catch {
      this.onError('URL WebSocket tidak dapat digunakan. Dashboard HTTPS memerlukan backend HTTPS/WSS. Periksa REACT_APP_API_URL.');
      this.diagnose({ signaling: 'CONFIGURATION_ERROR' });
      this.onStatus('OFFLINE');
      return;
    }
    this.socket = socket;
    this.lastReceived = Date.now();
    this.heartbeat = setInterval(() => {
      if (Date.now() - this.lastReceived > 60000) {
        this.failureMessage = 'Signaling tidak merespons heartbeat. Menghubungkan kembali ke backend.';
        socket.close();
      }
      else if (socket.readyState === WebSocket.OPEN) this.send({ type: 'ping' });
    }, 15000);
    socket.onopen = () => {
      this.diagnose({ signaling: 'AUTHENTICATING' });
      this.send({ type: 'auth', mode: this.broadcast ? 'broadcast' : 'viewer', token: this.session.sessionToken });
    };
    socket.onmessage = event => {
      this.lastReceived = Date.now();
      this.queue = this.queue.then(async () => {
        if (!this.closed && this.socket === socket) await this.message(JSON.parse(event.data));
      }).catch(() => {
        this.onError('Koneksi video gagal. Mencoba menghubungkan kembali.');
        this.retryViewer();
      });
    };
    socket.onerror = () => {
      this.failureMessage = `WebSocket signaling belum dapat tersambung ke ${this.diagnostics.signalingUrl}. Periksa URL backend, layanan WebSocket, dan jaringan.`;
      socket.close();
    };
    socket.onclose = event => {
      const wasReady = this.ready;
      clearInterval(this.heartbeat);
      this.ready = false;
      this.clearPeers();
      if (this.closed) return;
      const cause = event?.code === 1008 ? `Origin ${window.location.origin} ditolak. Tambahkan URL ini ke CRISIS_ALLOWED_ORIGINS di backend.` : this.failureMessage || (wasReady ? 'Signaling terputus. Menghubungkan kembali tanpa menghentikan screen sharing.' : 'Signaling belum tersambung. Periksa CRISIS_ALLOWED_ORIGINS dan jalankan backend dengan satu worker serta threads untuk WebSocket.');
      this.onError(cause);
      this.diagnose({ signaling: 'RECONNECTING', closeCode: event?.code ?? null, reconnectAttempt: this.attempt + 1, video: 'WAITING' });
      if (!this.broadcast) this.onStream(null);
      this.onStatus('RECONNECTING');
      const delay = Math.min(30000, 1000 * 2 ** Math.min(this.attempt++, 5)) + Math.random() * 500;
      this.reconnect = setTimeout(() => this.connect(), delay);
    };
  }

  async message(message) {
    switch (message.type) {
      case 'ready':
        this.ready = true;
        this.attempt = 0;
        this.live = message.live;
        this.onError('');
        this.diagnose({ signaling: 'CONNECTED', broadcast: this.live ? 'ACTIVE' : 'OFFLINE', serverId: message.serverId || 'unknown' });
        this.waitForOffer();
        if (this.broadcast && this.stream) this.send({ type: 'start' });
        else {
          if (!this.broadcast && !this.live) this.onStream(null);
          this.onStatus(this.live ? 'CONNECTING' : 'OFFLINE');
        }
        break;
      case 'status':
        this.live = message.live;
        this.diagnose({ broadcast: this.live ? 'ACTIVE' : 'OFFLINE' });
        this.waitForOffer();
        if (!this.live) {
          this.clearPeers();
          if (!this.broadcast) this.onStream(null);
          this.onStatus('OFFLINE');
        } else if (this.broadcast) this.onStatus(this.stream ? 'LIVE' : 'OFFLINE');
        else if (![...this.peers.values()].some(peer => peer.pc.connectionState === 'connected')) this.onStatus('CONNECTING');
        break;
      case 'viewer-joined':
        if (this.broadcast && this.stream) await this.offer(message.peer);
        break;
      case 'viewer-left':
        this.removePeer(message.peer);
        break;
      case 'offer':
        if (!this.broadcast) {
          clearTimeout(this.offerWait);
          this.clearPeers();
          this.onStatus('CONNECTING');
          const peer = this.createPeer(message.peer, message.call);
          await peer.pc.setRemoteDescription({ type: 'offer', sdp: message.sdp });
          await peer.pc.setLocalDescription(await peer.pc.createAnswer());
          this.send({ type: 'answer', peer: message.peer, call: message.call, sdp: peer.pc.localDescription.sdp });
          this.flushIce(peer);
        }
        break;
      case 'answer': {
        const peer = this.peers.get(message.peer);
        if (this.broadcast && peer?.call === message.call) await peer.pc.setRemoteDescription({ type: 'answer', sdp: message.sdp });
        break;
      }
      case 'ice': {
        const peer = this.peers.get(message.peer);
        if (peer?.call === message.call && message.candidate) {
          if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(message.candidate);
          else peer.pendingIce.push(message.candidate);
        }
        break;
      }
      case 'unauthorized':
        this.destroy();
        this.onSessionExpired();
        return;
      case 'forbidden':
      case 'error':
        this.onError(message.message || 'Anda tidak memiliki akses broadcast.');
        this.failureMessage = message.message || '';
        if (['broadcaster-busy', 'origin-not-allowed', 'signaling-unavailable'].includes(message.code)) {
          // A broken TCP connection may remain registered until its heartbeat
          // times out. Retry without discarding the active HCP capture.
          this.socket.close();
          return;
        }
        this.destroy();
        this.onStatus('OFFLINE');
        return;
      default: break;
    }
    for (const peer of this.peers.values()) {
      if (peer.pc.remoteDescription) {
        for (const candidate of peer.pendingIce.splice(0)) await peer.pc.addIceCandidate(candidate);
      }
    }
  }

  waitForOffer() {
    clearTimeout(this.offerWait);
    if (this.broadcast || !this.live || this.peers.size) return;
    this.offerWait = setTimeout(() => {
      if (this.closed || !this.ready || !this.live || this.peers.size) return;
      this.onError('Signaling terhubung, tetapi Astina belum mengirim tawaran video. Pastikan Astina LIVE dan backend memakai satu worker serta satu instance.');
      this.retryViewer();
    }, 15000);
  }

  createPeer(id, call) {
    this.removePeer(id);
    const urls = (process.env.REACT_APP_CRISIS_STUN_URLS || 'stun:stun.cloudflare.com:3478').split(',').map(url => url.trim()).filter(url => /^stuns?:/.test(url));
    const pc = new RTCPeerConnection({ iceServers: urls.length ? [{ urls }] : [] });
    const peer = { id, call, pc, pendingIce: [], outgoingIce: [], sentDescription: false };
    this.peers.set(id, peer);
    this.diagnose({ video: 'NEGOTIATING', ice: pc.iceConnectionState || 'new', peers: this.peers.size });
    peer.timeout = setTimeout(() => {
      if (pc.connectionState !== 'connected') {
        this.onError('Signaling terhubung, tetapi koneksi video WebRTC belum berhasil. Periksa jaringan atau firewall antara PC Astina dan viewer.');
        this.removePeer(id);
        this.retryViewer();
      }
    }, 30000);
    pc.onicecandidate = event => {
      if (!event.candidate) return;
      const message = { type: 'ice', peer: id, call, candidate: event.candidate.toJSON() };
      if (peer.sentDescription) this.send(message);
      else peer.outgoingIce.push(message);
    };
    pc.ontrack = event => {
      if (!this.broadcast && this.peers.get(id) === peer) this.onStream(event.streams[0] || new MediaStream([event.track]));
    };
    pc.onconnectionstatechange = () => {
      if (this.closed || this.peers.get(id) !== peer) return;
      this.diagnose({ video: pc.connectionState, ice: pc.iceConnectionState || 'unknown' });
      if (pc.connectionState === 'connected') {
        clearTimeout(peer.timeout);
        clearTimeout(peer.disconnected);
        if (!this.broadcast) { this.onError(''); this.onStatus(this.ready ? 'LIVE' : 'RECONNECTING'); }
      } else if (pc.connectionState === 'failed') {
        this.onError('Koneksi video WebRTC gagal meskipun signaling terhubung. Periksa jaringan atau firewall antara PC Astina dan viewer.');
        this.removePeer(id);
        this.retryViewer();
      } else if (pc.connectionState === 'disconnected') {
        if (!this.broadcast) this.onStatus('RECONNECTING');
        clearTimeout(peer.disconnected);
        peer.disconnected = setTimeout(() => { this.removePeer(id); this.retryViewer(); }, 8000);
      }
    };
    pc.oniceconnectionstatechange = () => {
      if (this.peers.get(id) === peer) this.diagnose({ ice: pc.iceConnectionState });
    };
    return peer;
  }

  flushIce(peer) {
    peer.sentDescription = true;
    peer.outgoingIce.splice(0).forEach(message => this.send(message));
  }

  async offer(id) {
    const call = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const peer = this.createPeer(id, call);
    this.stream.getVideoTracks().forEach(track => peer.pc.addTrack(track, this.stream));
    await peer.pc.setLocalDescription(await peer.pc.createOffer());
    if (this.closed || this.peers.get(id) !== peer) return;
    this.send({ type: 'offer', peer: id, call, sdp: peer.pc.localDescription.sdp });
    this.flushIce(peer);
  }

  retryViewer() {
    if (this.closed || this.broadcast || !this.live) return;
    this.onStatus('RECONNECTING');
    clearTimeout(this.peerRetry);
    this.peerRetry = setTimeout(() => {
      if (this.ready && this.live) this.send({ type: 'request-offer' });
      this.waitForOffer();
    }, 3000);
  }

  async start() {
    if (!this.broadcast || this.closed || this.stream) return;
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Screen sharing memerlukan Chrome/Edge pada HTTPS atau localhost.');
    // Must be called directly from a user click; the browser owns the picker.
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'window', frameRate: { ideal: 15, max: 30 } }, audio: false });
    if (this.closed) { stream.getTracks().forEach(track => track.stop()); return; }
    if (!stream.getVideoTracks().length) { stream.getTracks().forEach(track => track.stop()); return; }
    this.stream = stream;
    stream.getVideoTracks()[0].addEventListener('ended', () => this.stop(), { once: true });
    this.onStream(stream);
    this.onError('');
    this.onStatus(this.ready ? 'CONNECTING' : 'RECONNECTING');
    if (this.ready) this.send({ type: 'start' });
  }

  stop() {
    this.send({ type: 'stop' });
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.live = false;
    this.clearPeers();
    this.onStream(null);
    this.onStatus('OFFLINE');
  }

  removePeer(id) {
    const peer = this.peers.get(id);
    if (!peer) return;
    this.peers.delete(id);
    clearTimeout(peer.timeout);
    clearTimeout(peer.disconnected);
    peer.pc.close();
  }

  clearPeers() {
    clearTimeout(this.offerWait);
    clearTimeout(this.peerRetry);
    [...this.peers.keys()].forEach(id => this.removePeer(id));
  }

  destroy() {
    this.closed = true;
    this.stop();
    clearInterval(this.heartbeat);
    clearTimeout(this.reconnect);
    this.socket?.close();
  }
}
