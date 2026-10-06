import DisasterIcon from './DisasterIcon';
import { formatWib } from '../../services/disaster/client';
export default function MaritimeConditionCard({ location, source }) {
  const data = source.data;
  const outside = data && (Date.now() < Date.parse(data.validFrom) || Date.now() >= Date.parse(data.validUntil));
  const fields = data ? [
    ['Prakiraan Pasut', data.tides, 'm'], ['Tinggi gelombang', data.waveHeight, 'm'],
    ['Angin dari', data.windFrom, ''], ['Kecepatan angin', data.windSpeed, 'kt'],
    ['Arus ke', data.currentTo, ''], ['Kecepatan arus', data.currentSpeed, 'kt'],
    ['Visibility', data.visibility, 'km'], ['Cuaca', data.weather, ''],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '') : [];
  return <section className="ppb-panel" aria-label={`Kondisi Maritim Sekitar ${location.label}`}>
    <div className="ppb-panel-head"><h2 className="ppb-panel-title">Kondisi Maritim Sekitar {location.label}</h2></div>
    <div className="ppb-card-body"><p><strong>Referensi: {location.port}</strong></p>
      <details className="ppb-maritime-info">
        <summary aria-label={`Informasi prakiraan maritim ${location.label}`}><span className="ppb-info-icon" aria-hidden="true">i</span><span>Arti informasi maritim</span></summary>
        <ul>
          <li><strong>Prakiraan pasut:</strong> tinggi muka air akibat pasang surut terhadap acuan sumber data.</li>
          <li><strong>Tinggi gelombang:</strong> perkiraan tinggi gelombang laut.</li>
          <li><strong>Angin dari:</strong> arah asal angin; dari Timur berarti menuju Barat.</li>
          <li><strong>Kecepatan angin:</strong> dalam knot (kt); 5 kt sekitar 9,3 km/jam.</li>
          <li><strong>Arus ke:</strong> arah tujuan aliran air laut.</li>
          <li><strong>Kecepatan arus:</strong> dalam knot (kt); 1,31 kt sekitar 2,4 km/jam.</li>
          <li><strong>Visibility:</strong> perkiraan jarak pandang.</li>
          <li><strong>Cuaca:</strong> kondisi langit yang diprakirakan.</li>
        </ul>
        <p>Prakiraan untuk menunjukkan waktu kondisi yang diprakirakan, bukan jaminan ketepatan. Kondisi di PIK dapat berbeda dari lokasi referensi.</p>
      </details>
      {!data && <p role="status">{source.loading ? 'Memuat prakiraan maritim...' : 'Data maritim resmi sementara tidak tersedia.'}</p>}
      {data && <>
        {(source.error || outside) && <p role="status">Data terakhir tersedia — {source.error ? 'pembaruan gagal' : 'di luar periode berlaku saat ini'}.</p>}
        <dl className="ppb-facts">{fields.map(([label, value, unit]) => <div key={label}><dt title={label}><DisasterIcon type={label.includes("angin") || label === "Angin dari" ? "wind" : label.includes("arus") || label === "Arus ke" || label.includes("gelombang") || label.includes("Pasut") ? "wave" : label === "Visibility" ? "eye" : "cloud"} label={label} color="#ff913c" /><span className="ppb-metric-name">{label}</span></dt><dd>{value} {unit}</dd></div>)}</dl>
        <p>Prakiraan untuk: {formatWib(data.validAt)}<br />Periode: {formatWib(data.validFrom)} — {formatWib(data.validUntil)}<br />Update sumber: {formatWib(data.updatedAt)}</p>
      </>}
    </div>
  </section>;
}
