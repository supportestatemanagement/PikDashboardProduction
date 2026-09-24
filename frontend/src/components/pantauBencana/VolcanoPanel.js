import { countVolcanoes, isValidLatLng, VOLCANO_SOURCE, VOLCANO_SOURCE_URL, VOLCANO_STATUS_CONFIG, VOLCANO_STATUS_ORDER } from '../../services/disaster/pvmbgVolcano';
import { formatWib } from '../../services/disaster/client';

export default function VolcanoPanel({ source, volcanoes, filter, onFilterChange, selectedId, onSelect }) {
  const dataset = source.data;
  const counts = countVolcanoes(dataset.data);
  return <section className="ppb-panel" aria-label="Aktivitas Gunung Api" aria-busy={source.loading}>
    <div className="ppb-panel-head"><div className="ppb-panel-title"><span className="ppb-ind ppb-ind-warn" />Aktivitas Gunung Api</div></div>
    <div className="ppb-source-note">
      {source.unavailable && <p role="status">Data aktivitas gunung api sementara tidak tersedia.</p>}
      {dataset.isFallback ? <p><strong>Fallback sementara — data ilustratif, bukan status resmi terkini.</strong> Koordinat belum terverifikasi; marker tidak ditampilkan.</p> : <>
        <p>Sumber: <a href={VOLCANO_SOURCE_URL} target="_blank" rel="noreferrer">{VOLCANO_SOURCE}</a></p>
        {source.error && <p role="status">Data terakhir tersedia — pembaruan gagal.</p>}
        {dataset.updatedAt && <p>Terakhir diperbarui: {formatWib(dataset.updatedAt)}</p>}
      </>}
      {dataset.isFallback && <a href={VOLCANO_SOURCE_URL} target="_blank" rel="noreferrer">Lihat status resmi di PVMBG — MAGMA Indonesia</a>}
    </div>
    <div className="ppb-volc-summary" aria-label={dataset.isFallback ? 'Jumlah data ilustratif' : 'Jumlah gunung api'}>
      {VOLCANO_STATUS_ORDER.map(status => <span key={status} style={{ color: VOLCANO_STATUS_CONFIG[status].color }}>{status} <b>{counts[status]}</b></span>)}
    </div>
    <div className="ppb-volc-filters" role="group" aria-label="Filter status gunung api">
      {['ALL', ...VOLCANO_STATUS_ORDER].map(status => <button type="button" key={status} aria-pressed={filter === status} onClick={() => onFilterChange(status)}>{status === 'ALL' ? 'Semua' : status[0] + status.slice(1).toLowerCase()}</button>)}
    </div>
    <div className="ppb-volc-list">
      {!volcanoes.length && <p className="ppb-source-note">Tidak ada gunung api untuk filter ini.</p>}
      {volcanoes.map(volcano => {
        const canFocus = !dataset.isFallback && isValidLatLng(volcano.latitude, volcano.longitude);
        return <button type="button" key={volcano.id} className={`ppb-volc-item${selectedId === volcano.id ? ' ppb-volc-active' : ''}`} aria-pressed={selectedId === volcano.id} disabled={!canFocus} onClick={() => onSelect(volcano)}>
          <span><span className="ppb-volc-name">{volcano.name}</span><span className="ppb-volc-loc">{volcano.location || 'Lokasi tidak tersedia'}</span>
            {volcano.updatedAt && <span className="ppb-volc-loc">Update: {formatWib(volcano.updatedAt)}</span>}
            {!canFocus && <span className="ppb-volc-loc">Koordinat terverifikasi belum tersedia</span>}
          </span>
          <span className="ppb-badge" style={{ background: VOLCANO_STATUS_CONFIG[volcano.status].color, color: '#101827' }}>{volcano.status}</span>
        </button>;
      })}
    </div>
  </section>;
}
