import { useState } from 'react';
import { formatWib } from '../../services/disaster/client';
export default function WeatherBanner({ source, configured, label }) {
  const [failedImage, setFailedImage] = useState(null);
  const weather = source.data;
  return <section className="ppb-weather" aria-label={`Cuaca BMKG ${label}`} aria-busy={source.loading}>
    <h2 className="ppb-weather-title">{label}</h2>
    {!configured ? <p>Lokasi cuaca belum dikonfigurasi (ADM4).</p> : !weather ? <p role="status">{source.error ? 'Data cuaca sementara tidak tersedia.' : 'Memuat data cuaca...'}</p> : <>
      <div className="ppb-weather-left"><div className="ppb-weather-icon">{weather.image && failedImage !== weather.image ? <img src={weather.image} alt={weather.description} onError={() => setFailedImage(weather.image)} /> : <span aria-label="Cuaca">&#9925;</span>}</div><div><div><span className="ppb-weather-temp">{weather.temperature ?? '-'}&deg;C</span><span className="ppb-weather-desc"> | {weather.description}</span></div><div className="ppb-weather-loc">{weather.location}</div><small>Prakiraan: {formatWib(weather.localDatetime)}</small></div></div>
      <div className="ppb-weather-right"><div className="ppb-wstat">Kelembapan <b>{weather.humidity ?? '-'}%</b></div><div className="ppb-wstat">Angin dari <b>{weather.windSpeed ?? '-'} km/jam</b> {weather.windDirection}</div>{weather.visibility && <div className="ppb-wstat">Visibility <b>{weather.visibility}</b></div>}{weather.cloudCover != null && <div className="ppb-wstat">Tutupan awan <b>{weather.cloudCover}%</b></div>}</div>
      <div className="ppb-source-note">BMKG Cuaca - {weather.timestampLabel}: {formatWib(weather.updatedAt)}{source.error && <span role="status"> / Pembaruan gagal; menampilkan data terakhir.</span>}</div>
    </>}
  </section>;
}
