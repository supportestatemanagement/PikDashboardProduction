import { formatWib } from '../../services/disaster/client';
export default function MaritimeConditionCard({ location, source }) {
  const data = source.data;
  const outside = data && (Date.now() < Date.parse(data.validFrom) || Date.now() >= Date.parse(data.validUntil));
  const fields = data ? [
    ['Pasut', data.tides, 'm'], ['Tinggi gelombang', data.waveHeight, 'm'],
    ['Angin dari', data.windFrom, ''], ['Kecepatan angin', data.windSpeed, 'kt'],
    ['Arus ke', data.currentTo, ''], ['Kecepatan arus', data.currentSpeed, 'kt'],
    ['Visibility', data.visibility, 'km'], ['Cuaca', data.weather, ''],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '') : [];
  return <section className="ppb-panel" aria-label={`Kondisi Maritim Sekitar ${location.label}`}>
    <div className="ppb-panel-head"><h2 className="ppb-panel-title">Kondisi Maritim Sekitar {location.label}</h2></div>
    <div className="ppb-card-body"><p><strong>Referensi: {location.port}</strong></p>
      <p className="ppb-muted">Prakiraan pelabuhan referensi, bukan sensor langsung {location.label}.</p>
      {!data && <p role="status">{source.loading ? 'Memuat prakiraan maritim...' : 'Data maritim resmi sementara tidak tersedia.'}</p>}
      {data && <>
        {(source.error || outside) && <p role="status">Data terakhir tersedia — {source.error ? 'pembaruan gagal' : 'di luar periode berlaku saat ini'}.</p>}
        <dl className="ppb-facts">{fields.map(([label, value, unit]) => <div key={label}><dt>{label}</dt><dd>{value} {unit}</dd></div>)}</dl>
        <p className="ppb-muted">Pasut mengikuti datum sumber; tidak dibandingkan dengan sensor lokal.</p>
        <p>Prakiraan: {formatWib(data.validAt)}<br />Periode: {formatWib(data.validFrom)} — {formatWib(data.validUntil)}<br />Update sumber: {formatWib(data.updatedAt)}</p>
      </>}
      <a href={`https://maritim.bmkg.go.id/cuaca/pelabuhan/${location.slug}`} target="_blank" rel="noreferrer">Sumber: BMKG Maritim</a>
    </div>
  </section>;
}
