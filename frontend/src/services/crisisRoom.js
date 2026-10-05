import { API_URL, dashboardRequest } from './dashboardSession';

export { isCrisisBroadcaster } from './dashboardSession';

export function crisisSocketUrl() {
  const url = new URL(`${API_URL.replace(/\/$/, '')}/api/crisis-room/ws`, window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}

// One captured HCP window; each viewer tries direct ICE with TURN fallback.
export class CrisisRoomClient {
  constructor({ session, broadcast, onStatus, onStream, onError, onSessionExpired, onDiagnostics = () => {} }) {
    Object.assign(this, { session, broadcast, onStatus, onStream, onError, onSessionExpired });
    this.peers = new Map();
    this.offerRequests = new Map();
    this.stream = null;
    this.closed = false;
    this.live = false;
    this.ready = false;
    this.attempt = 0;
    this.queue = Promise.resolve();
    this.iceAbort = new AbortController();
    const stunUrls = (process.env.REACT_APP_CRISIS_STUN_URLS || 'stun:stun.cloudflare.com:3478').split(',').map(url => url.trim()).filter(url => /^stuns?:/.test(url));
    this.defaultIceServers = stunUrls.length ? [{ urls: stunUrls }] : [];
    this.iceServers = this.defaultIceServers;
    this.iceExpiresAt = 0;
    this.onDiagnostics = onDiagnostics;
    this.diagnostics = { origin: window.location.origin, signalingUrl: crisisSocketUrl(), signaling: 'CONNECTING', broadcast: 'UNKNOWN', video: 'WAITING', ice: 'NEW', mode: 'STUN_FIRST', turn: 'NOT_REQUESTED' };
    this.connect();
  }

  diagnose(changes) {
    Object.assign(this.diagnostics, changes);
    this.onDiagnostics({ ...this.diagnostics });
  }

  async ensureIceConfiguration(force = false) {
    if (!force && this.iceExpiresAt > Date.now() + 60000) return;
    if (this.loadingIce) return this.loadingIce;
    this.loadingIce = (async () => {
      try {
        const config = await dashboardRequest('/api/crisis-room/ice-servers', this.session, this.iceAbort.signal);
        if (this.closed) return;
        if (!Array.isArray(config.iceServers) || !Number.isFinite(config.expiresAt) || config.expiresAt <= Date.now() + 60000) throw new Error('Invalid ICE configuration');
        this.iceServers = config.iceServers;
        this.iceExpiresAt = config.expiresAt;
        this.iceRetryAfter = 0;
        this.turnConfigured = Boolean(config.turnConfigured);
        this.diagnose({ turn: this.turnConfigured ? 'CONFIGURED' : 'NOT_CONFIGURED' });
        if (!this.turnConfigured) this.onError('TURN belum dikonfigurasi di backend. Koneksi langsung tetap dicoba; perangkat pada jaringan lain mungkin gagal.');
      } catch (failure) {
        if (this.closed) return;
        if (failure.code === 'session-expired') {
          this.destroy();
          this.onSessionExpired();
          return;
        }
        if (this.turnConfigured && this.iceExpiresAt > Date.now() + 30000) {
          this.iceRetryAfter = Date.now() + 30000;
          this.diagnose({ turn: 'RENEWAL_RETRY' });
          this.onError('Pembaruan kredensial TURN tertunda. Koneksi aktif dipertahankan sambil mencoba kembali.');
          return;
        }
        this.iceServers = this.defaultIceServers;
        this.iceExpiresAt = Date.now() + 90000;
        this.turnConfigured = false;
        this.diagnose({ turn: 'UNAVAILABLE' });
        this.onError('Kredensial TURN belum tersedia dari backend. Koneksi langsung tetap dicoba. Periksa konfigurasi TURN di Render.');
      }
    })();
    try { await this.loadingIce; }
    finally { this.loadingIce = null; }
  }

  scheduleIceRefresh() {
    clearTimeout(this.iceRefresh);
    if (!this.turnConfigured || ![...this.peers.values()].some(peer => peer.useTurn) || this.closed) return;
    this.iceRefresh = setTimeout(() => {
      this.queue = this.queue.then(async () => {
        const previousExpiry = this.iceExpiresAt;
        await this.ensureIceConfiguration(true);
        if (this.closed || !this.ready) return;
        if (this.iceExpiresAt <= previousExpiry) { this.scheduleIceRefresh(); return; }
        // Fresh credentials and a new ICE allocation keep a 24-hour capture
        // working without putting permanent TURN secrets in the browser.
        for (const peer of this.peers.values()) if (peer.useTurn) peer.pc.setConfiguration({ iceServers: this.iceServers, iceTransportPolicy: 'all' });
        if (this.broadcast && this.stream) {
          for (const peer of [...this.peers.values()]) if (peer.useTurn) await this.offer(peer.id, true);
        }
        this.scheduleIceRefresh();
      }).catch(() => { this.retryViewer(); });
    }, Math.max(1000, this.iceExpiresAt - Date.now() - 120000, (this.iceRetryAfter || 0) - Date.now()));
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
        if (this.broadcast && this.stream) await this.offer(message.peer, message.useTurn === true);
        break;
      case 'viewer-left':
        this.offerRequests.delete(message.peer);
        this.removePeer(message.peer);
        break;
      case 'offer':
        if (!this.broadcast) {
          const useTurn = message.useTurn === true;
          if (useTurn) await this.ensureIceConfiguration();
          if (this.closed || !this.ready) return;
          clearTimeout(this.offerWait);
          this.clearPeers();
          this.onStatus('CONNECTING');
          const peer = this.createPeer(message.peer, message.call, useTurn);
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

  createPeer(id, call, useTurn = false) {
    this.removePeer(id);
    const pc = new RTCPeerConnection({ iceServers: useTurn ? this.iceServers : this.defaultIceServers, iceTransportPolicy: 'all' });
    const peer = { id, call, pc, useTurn, pendingIce: [], outgoingIce: [], sentDescription: false };
    this.peers.set(id, peer);
    this.scheduleIceRefresh();
    this.diagnose({ video: 'NEGOTIATING', ice: pc.iceConnectionState || 'new', peers: this.peers.size, attemptMode: useTurn ? 'TURN_FALLBACK' : 'STUN_ONLY', route: 'PENDING' });
    peer.timeout = setTimeout(() => {
      if (pc.connectionState !== 'connected') {
        this.onError('Signaling terhubung, tetapi koneksi video WebRTC belum berhasil. Periksa jaringan atau firewall antara PC Astina dan viewer.');
        this.failPeer(peer);
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
        else this.onError('');
        this.reportPeerRoute(peer);
      } else if (pc.connectionState === 'failed') {
        this.onError('Koneksi video WebRTC gagal meskipun signaling terhubung. Periksa jaringan atau firewall antara PC Astina dan viewer.');
        this.failPeer(peer);
      } else if (pc.connectionState === 'disconnected') {
        if (!this.broadcast) this.onStatus('RECONNECTING');
        clearTimeout(peer.disconnected);
        peer.disconnected = setTimeout(() => this.failPeer(peer), 8000);
      }
    };
    pc.oniceconnectionstatechange = () => {
      if (this.peers.get(id) === peer) this.diagnose({ ice: pc.iceConnectionState });
    };
    return peer;
  }

  async reportPeerRoute(peer) {
    if (!peer.pc.getStats) return;
    try {
      const stats = await peer.pc.getStats();
      if (this.closed || this.peers.get(peer.id) !== peer) return;
      let pair;
      stats.forEach(entry => {
        if (entry.type === 'transport' && entry.selectedCandidatePairId) pair = stats.get(entry.selectedCandidatePairId);
      });
      if (!pair) stats.forEach(entry => {
        if (entry.type === 'candidate-pair' && entry.state === 'succeeded' && entry.nominated) pair = entry;
      });
      if (pair) {
        const local = stats.get(pair.localCandidateId);
        const remote = stats.get(pair.remoteCandidateId);
        this.diagnose({ route: local?.candidateType === 'relay' || remote?.candidateType === 'relay' ? 'TURN' : 'DIRECT' });
      }
    } catch { /* Diagnostics must never disrupt a working video. */ }
  }

  flushIce(peer) {
    peer.sentDescription = true;
    peer.outgoingIce.splice(0).forEach(message => this.send(message));
  }

  failPeer(peer) {
    if (this.closed || this.peers.get(peer.id) !== peer) return;
    this.removePeer(peer.id);
    if (this.broadcast) {
      const previousRequest = this.offerRequests.get(peer.id);
      if (!peer.useTurn) this.queue = this.queue.then(() => {
        if (!this.closed && this.ready && this.live && this.offerRequests.get(peer.id) === previousRequest) return this.offer(peer.id, true);
      }).catch(() => this.onError('Percobaan TURN gagal. Viewer akan mencoba menghubungkan kembali.'));
    } else {
      this.onStream(null);
      this.retryViewer(true);
    }
  }

  async offer(id, useTurn = false) {
    const request = {};
    this.offerRequests.set(id, request);
    if (useTurn) await this.ensureIceConfiguration();
    if (this.closed || !this.stream || !this.ready || this.offerRequests.get(id) !== request) return;
    const call = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const peer = this.createPeer(id, call, useTurn);
    this.stream.getVideoTracks().forEach(track => peer.pc.addTrack(track, this.stream));
    await peer.pc.setLocalDescription(await peer.pc.createOffer());
    if (this.closed || this.peers.get(id) !== peer || this.offerRequests.get(id) !== request) return;
    this.send({ type: 'offer', peer: id, call, useTurn, sdp: peer.pc.localDescription.sdp });
    this.flushIce(peer);
  }

  retryViewer(useTurn = false) {
    if (this.closed || this.broadcast || !this.live) return;
    this.onStatus('RECONNECTING');
    clearTimeout(this.peerRetry);
    this.peerRetry = setTimeout(() => {
      if (this.ready && this.live) this.send({ type: 'request-offer', useTurn });
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
    if (![...this.peers.values()].some(active => active.useTurn)) clearTimeout(this.iceRefresh);
    clearTimeout(peer.timeout);
    clearTimeout(peer.disconnected);
    peer.pc.close();
  }

  clearPeers() {
    this.offerRequests.clear();
    clearTimeout(this.iceRefresh);
    clearTimeout(this.offerWait);
    clearTimeout(this.peerRetry);
    [...this.peers.keys()].forEach(id => this.removePeer(id));
  }

  destroy() {
    this.closed = true;
    this.iceAbort.abort();
    this.stop();
    clearInterval(this.heartbeat);
    clearTimeout(this.reconnect);
    this.socket?.close();
  }
}
