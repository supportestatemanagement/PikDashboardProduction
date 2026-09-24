import { ensoImpact, ENSO_SOURCE_URL, getEnsoCategory, getEnsoTrend } from '../../services/disaster/noaaEnsoService';
import DataTypeBadge from './DataTypeBadge';
export default function EnsoCard({ source }) {
  const data = source.data;
  const category = data ? getEnsoCategory(data.value, data.officialCategory) : null;
  const impact = ensoImpact(category);
  const series = data?.series || [];
  const min = Math.min(...series.map(row => row.value)), max = Math.max(...series.map(row => row.value));
  const points = series.map((row, i) => `${4 + i * 232 / Math.max(1, series.length - 1)},${44 - (row.value - min) * 36 / (max - min || 1)}`).join(' ');
  return <section className="ppb-panel" aria-label="ENSO / El Niño-La Niña">
    <div className="ppb-panel-head"><h2 className="ppb-panel-title">ENSO / El Niño-La Niña</h2><DataTypeBadge type="CLIMATE INDICATOR" description="ENSO merupakan fenomena iklim di Samudra Pasifik yang dapat memengaruhi pola curah hujan Indonesia dalam skala mingguan hingga musiman. ENSO bukan indikator cuaca langsung di PIK." /></div>
    <div className="ppb-card-body"><p>Kondisi iklim skala besar</p>
      {!data && <p role="status">{source.error ? 'Gagal mengambil data ENSO NOAA/CPC.' : source.loading ? 'Memuat indikator iklim...' : 'Data ENSO terbaru sementara tidak tersedia.'}</p>}
      {source.error && data && <p>Data terakhir tersedia — pembaruan gagal.</p>}
      <dl className="ppb-facts"><div><dt>STATUS</dt><dd>{category || 'Tidak tersedia'}</dd></div>
        <div><dt>NIÑO 3.4</dt><dd>{Number.isFinite(data?.value) ? `${data.value >= 0 ? '+' : ''}${data.value.toFixed(2)} °C` : 'Tidak tersedia'}</dd></div>
        <div><dt>PERIODE</dt><dd>{data?.period || 'Tidak tersedia'}</dd></div>
        <div><dt title="Perubahan indeks bertanda dari minggu sebelumnya; perubahan di bawah 0,05 °C = Stabil. Bukan intensitas ENSO.">Trend indeks</dt><dd>{getEnsoTrend(data?.series) || 'Tidak tersedia'}</dd></div></dl>
      {series.length > 1 && <figure className="ppb-sparkline"><svg viewBox="0 0 240 52" role="img" aria-label={`Trend ${series.length} periode Niño 3.4, dari ${series[0].value} ke ${data.value} derajat Celsius`}><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" /></svg><figcaption>{series.length} periode mingguan terakhir · °C</figcaption></figure>}
      {source.error && source.retry && <button className="ppb-retry" onClick={source.retry}>Coba Lagi</button>}
      {data && <p className="ppb-muted">Status dasar anomali mingguan: ≤ −0,5 °C La Niña; ≥ +0,5 °C El Niño; di antaranya Neutral. Bukan penetapan kejadian ENSO resmi NOAA. Trend menunjukkan kenaikan/penurunan indeks dengan ambang 0,05 °C, bukan intensitas kejadian. Periode mengikuti tanggal tengah minggu sumber.</p>}
      {impact && <><h3>Dampak potensial untuk Indonesia</h3><p>{impact.text}</p>{impact.attention && <p>Perhatian: {impact.attention}</p>}</>}
      <p className="ppb-muted">ENSO adalah indikator iklim skala Pasifik dan bukan kondisi cuaca langsung di PIK.</p>
      <a href={ENSO_SOURCE_URL} target="_blank" rel="noreferrer">Source: NOAA/CPC</a>
    </div>
  </section>;
}
