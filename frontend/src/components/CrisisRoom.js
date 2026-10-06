import { useEffect, useRef, useState } from 'react';
import { CrisisRoomClient, isCrisisBroadcaster } from '../services/crisisRoom';
import './CrisisRoom.css';

export default function CrisisRoom({ session, onSessionExpired }) {
  const broadcast = isCrisisBroadcaster(session.user);
  const [status, setStatus] = useState('CONNECTING');
  const [stream, setStream] = useState(null);
  const [error, setError] = useState('');
  const [diagnostics, setDiagnostics] = useState({});
  const [selecting, setSelecting] = useState(false);
  const video = useRef(null);
  const client = useRef(null);
  const currentSession = useRef(session);
  currentSession.current = session;
  useEffect(() => {
    let backgroundTimer;
    let disposed = false;
    let generation = 0;
    const disconnect = () => {
      const connection = client.current;
      client.current = null;
      generation += 1;
      // Closing the viewer socket unsubscribes it on the signaling server,
      // which tells Astina to close this viewer's outgoing peer as well.
      connection?.destroy();
    };
    const connect = () => {
      if (disposed || client.current) return;
      const activeGeneration = ++generation;
      const guard = callback => value => {
        if (!disposed && generation === activeGeneration) callback(value);
      };
      setStatus('CONNECTING');
      setError('');
      client.current = new CrisisRoomClient({ session: currentSession.current, broadcast, onStatus: guard(setStatus), onStream: guard(setStream), onError: guard(setError), onSessionExpired: guard(onSessionExpired), onDiagnostics: guard(setDiagnostics) });
    };
    const visibilityChanged = () => {
      clearTimeout(backgroundTimer);
      if (document.visibilityState === 'hidden') {
        backgroundTimer = setTimeout(() => {
          disconnect();
          setStream(null);
          setStatus('OFFLINE');
          setError('');
          setDiagnostics({ signaling: 'DISCONNECTED', video: 'PAUSED', reason: 'BACKGROUND' });
        }, 30000);
      } else {
        connect();
      }
    };
    connect();
    // Publisher capture and signaling must continue regardless of visibility.
    if (!broadcast) {
      document.addEventListener('visibilitychange', visibilityChanged);
      visibilityChanged();
    }
    return () => {
      disposed = true;
      clearTimeout(backgroundTimer);
      document.removeEventListener('visibilitychange', visibilityChanged);
      disconnect();
    };
  }, [broadcast, onSessionExpired]);
  useEffect(() => { client.current?.updateSession(session); }, [session]);
  useEffect(() => {
    const element = video.current;
    element.srcObject = stream;
    if (stream) element.play().catch(() => setError('Video belum dapat diputar. Tekan tombol Play pada video.'));
    return () => { element.srcObject = null; };
  }, [stream]);
  const start = async () => {
    setSelecting(true);
    try { await client.current.start(); }
    catch (failure) { setError(failure.name === 'NotAllowedError' ? 'Screen sharing dibatalkan atau tidak diizinkan.' : failure.message || 'Tidak dapat membagikan window HCP.'); }
    finally { setSelecting(false); }
  };
  return <section className="crisis-room" aria-label={broadcast ? 'Crisis Room Broadcast' : 'Crisis Room'}>
    <header className="crisis-room-header"><div><h1>Crisis Room{broadcast ? ' Broadcast' : ''}</h1>{broadcast && <p>Pilih window HCP Hikvision yang menampilkan CCTV 3×3.</p>}</div><span className={`crisis-status crisis-status-${status.toLowerCase()}`} role="status"><i />{status}</span></header>
    {broadcast && <div className="crisis-actions"><button onClick={start} disabled={selecting || Boolean(stream)}>{selecting ? 'Memilih window…' : 'Start Share Screen'}</button><button className="crisis-stop" onClick={() => client.current.stop()} disabled={!stream}>Stop Broadcast</button><span>Biarkan window HCP dan halaman ini tetap terbuka.</span></div>}
    {error && <p className="crisis-error" role="alert">{error}</p>}
    {broadcast && <details className="crisis-connection-details"><summary>Detail koneksi</summary><dl>{Object.entries(diagnostics).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl></details>}
    <div className="crisis-video-stage"><video ref={video} autoPlay muted playsInline controls={!broadcast && Boolean(stream)} aria-label="Live CCTV HCP Hikvision" />{!stream && <div className="crisis-placeholder"><span className="crisis-placeholder-icon">▣</span><h2>{status === 'OFFLINE' ? 'Broadcast belum aktif' : 'Menghubungkan Crisis Room…'}</h2><p>{broadcast ? 'Tekan Start Share Screen untuk memulai.' : 'Video akan tampil otomatis saat broadcaster terhubung.'}</p></div>}</div>
  </section>;
}
