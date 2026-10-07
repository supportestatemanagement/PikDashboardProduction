import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import { AttributionControl, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './CctvGroupMap.css';

const icon = L.divIcon({ className: 'cctv-group-pin', html: '<span>●</span>', iconSize: [26, 26], iconAnchor: [13, 13] });
const base = process.env.REACT_APP_API_URL || '';

function MapActions({ points, place }) {
  const map = useMap();
  const fitted = useRef(false);
  useMapEvents({ click: event => place(event.latlng) });
  useEffect(() => {
    if (points.length && !fitted.current) {
      map.fitBounds(points.map(point => [point.Latitude, point.Longitude]), { padding: [45, 45], maxZoom: 15 });
      fitted.current = true;
    }
  }, [map, points]);
  return null;
}

export default function CctvGroupMap({ records, session }) {
  const [locations, setLocations] = useState([]);
  const [draft, setDraft] = useState({});
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dialog = useRef(null);
  const expandButton = useRef(null);
  const canEdit = session?.user?.username === 'Daniel';
  const groups = useMemo(() => {
    const counts = {};
    records.forEach(row => {
      const name = String(row.Kelompok || '').trim();
      if (name && (row.Tahun || String(row['Nama Pada Layar (OSD)'] || '').trim())) counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([name, total]) => ({ name, total }));
  }, [records]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${base}/api/cctv-map`, { signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok || result.status !== 'success') throw new Error('Gagal memuat lokasi kelompok CCTV.');
      setLocations(result.data);
    }).catch(err => { if (err.name !== 'AbortError') setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!expanded) return;
    dialog.current.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; expandButton.current?.focus(); };
  }, [expanded]);
  const points = useMemo(() => groups.flatMap(group => {
    const location = draft[group.name] || locations.find(row => row.Kelompok === group.name);
    if (!location || location.Latitude === '' || location.Longitude === '') return [];
    const lat = Number(location.Latitude), lng = Number(location.Longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [{ ...group, Latitude: lat, Longitude: lng }] : [];
  }), [groups, locations, draft]);
  const change = (name, position) => {
    if (canEdit && editing && !busy) { setDraft(previous => ({ ...previous, [name]: { Kelompok: name, Latitude: position.lat, Longitude: position.lng } })); setNotice(''); }
  };
  const save = async () => {
    setBusy(true); setError('');
    try {
      for (const location of Object.values(draft)) {
        const response = await fetch(`${base}/api/cctv-map`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.sessionToken}` }, body: JSON.stringify(location) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Gagal menyimpan lokasi.');
        setLocations(previous => [...previous.filter(row => row.Kelompok !== location.Kelompok), location]);
        setDraft(previous => { const next = { ...previous }; delete next[location.Kelompok]; return next; });
      }
      setEditing(false); setSelected(''); setNotice('Lokasi berhasil disimpan.');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const content = <>
    {loading && <p role="status">Memuat lokasi CCTV…</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {canEdit && !loading && !error && !editing && <button onClick={() => setEditing(true)}>Edit lokasi</button>}
    {canEdit && editing && <div className="cctv-map-tools"><select aria-label="Kelompok CCTV untuk ditempatkan" disabled={busy} value={selected} onChange={event => setSelected(event.target.value)}><option value="">Pilih kelompok untuk ditempatkan</option>{groups.map(group => <option key={group.name} value={group.name}>{group.name}</option>)}</select><button disabled={busy || !Object.keys(draft).length} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan lokasi'}</button><button disabled={busy} onClick={() => { setEditing(false); setDraft({}); setSelected(''); setError(''); }}>Batal</button><small>Pilih kelompok lalu klik peta, atau geser titik yang sudah ada.</small></div>}
    <div className="cctv-group-map-canvas"><MapContainer center={[-6.095, 106.72]} zoom={12} attributionControl={false} style={{ height: '100%', width: '100%' }}>
      <AttributionControl position="bottomright" prefix={false} />
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution={'Map data from &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> | <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a>'} />
      <MapActions points={points} place={position => selected && change(selected, position)} />
      {points.map(point => <Marker key={point.name} position={[point.Latitude, point.Longitude]} icon={icon} draggable={canEdit && editing && !busy} eventHandlers={{ dragend: event => change(point.name, event.target.getLatLng()) }}><Tooltip permanent direction="top">{point.name}</Tooltip><Popup><strong>{point.name}</strong><p>Total CCTV: <b>{point.total}</b></p></Popup></Marker>)}
    </MapContainer></div>
    {!loading && <small>{points.length} titik kelompok · {groups.length - points.length} kelompok belum memiliki lokasi</small>}
  </>;
  return <section className="cctv-group-map-card"><header><h2>Peta Kelompok CCTV</h2><button ref={expandButton} aria-label="Perbesar peta CCTV" onClick={() => setExpanded(true)}>⛶</button></header>{!expanded && content}{expanded && createPortal(<dialog ref={dialog} className="cctv-group-map-dialog" aria-label="Peta CCTV diperbesar" onCancel={() => setExpanded(false)} onClick={event => { if (event.target === event.currentTarget) setExpanded(false); }}><header><h2>Peta Kelompok CCTV</h2><button onClick={() => setExpanded(false)}>Tutup</button></header>{content}</dialog>, document.body)}</section>;
}
