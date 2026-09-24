import { ensoImpact, ENSO_SOURCE_URL, getEnsoCategory } from '../../services/disaster/bmkgEnso';
import { formatWib } from '../../services/disaster/client';
export default function EnsoCard({ source }) {
  const data = source.data;
  const category = data ? getEnsoCategory(data.value, data.officialCategory) : null;
  const impact = ensoImpact(category);
  return <section className="ppb-panel" aria-label="ENSO / El Niño-La Niña">
    <div className="ppb-panel-head"><h2 className="ppb-panel-title">ENSO / El Niño-La Niña</h2></div>
    <div className="ppb-card-body"><p>Kondisi iklim skala besar</p>
      {!data && <p role="status">Data ENSO resmi sementara tidak tersedia.</p>}
      {source.error && data && <p>Data terakhir tersedia — pembaruan gagal.</p>}
      <dl className="ppb-facts"><div><dt>STATUS</dt><dd>{category || 'Tidak tersedia'}</dd></div>
        <div><dt>NIÑO 3.4</dt><dd>{Number.isFinite(data?.value) ? `${data.value >= 0 ? '+' : ''}${data.value.toFixed(2)} °C` : 'Tidak tersedia'}</dd></div>
        <div><dt>PERIODE</dt><dd>{data?.period || 'Tidak tersedia'}</dd></div>
        <div><dt>UPDATE</dt><dd>{data?.updatedAt ? formatWib(data.updatedAt) : 'Tidak tersedia'}</dd></div></dl>
      {impact && <><h3>Dampak potensial untuk Indonesia</h3><p>{impact.text}</p>{impact.attention && <p>Perhatian: {impact.attention}</p>}</>}
      <p className="ppb-muted">ENSO adalah indikator iklim skala Pasifik dan bukan kondisi cuaca langsung di PIK.</p>
      <a href={ENSO_SOURCE_URL} target="_blank" rel="noreferrer">Sumber: BMKG — Dinamika Atmosfer</a>
    </div>
  </section>;
}
