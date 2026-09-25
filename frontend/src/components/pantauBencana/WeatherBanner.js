import DisasterIcon from './DisasterIcon';
import { useState } from 'react';
import { formatWib } from '../../services/disaster/client';
export default function WeatherBanner({ source, configured, label }) {
  const [failedImage, setFailedImage] = useState(null);
  const weather = source.data;
  return <section className="ppb-weather" aria-label={`Cuaca BMKG ${label}`} aria-busy={source.loading}>
    <h2 className="ppb-weather-title">Prakiraan Cuaca {label}</h2>
    {!configured ? <p>Lokasi cuaca belum dikonfigurasi (ADM4).</p> : !weather ? <p role="status">{source.loading ? 'Memuat prakiraan cuaca...' : source.error ? 'Gagal mengambil prakiraan cuaca BMKG.' : 'Prakiraan cuaca belum tersedia.'}</p> : <>
      <div className="ppb-weather-left"><div className="ppb-weather-icon">{weather.image && failedImage !== weather.image ? <img src={weather.image} alt={weather.description} onError={() => setFailedImage(weather.image)} /> : <span aria-label="Cuaca">&#9925;</span>}</div><div><div><span className="ppb-weather-temp">{weather.temperature ?? '-'}&deg;C</span><span className="ppb-weather-desc"> | {weather.description}</span></div><div className="ppb-weather-loc">{weather.location}</div><small>Valid: {formatWib(weather.localDatetime)}</small></div></div>
      <div className="ppb-weather-right"><div className="ppb-wstat"><span className="ppb-metric-icon" title="Kelembapan"><DisasterIcon type="water" label="Kelembapan" /></span><b>{weather.humidity ?? '-'}%</b></div><div className="ppb-wstat"><span className="ppb-metric-icon" title="Angin dari"><DisasterIcon type="wind" label="Angin dari" /></span><b>{weather.windSpeed ?? '-'} km/jam</b> {weather.windDirection}</div>{weather.visibility && <div className="ppb-wstat"><span className="ppb-metric-icon" title="Visibility"><DisasterIcon type="eye" label="Visibility" /></span><b>{weather.visibility}</b></div>}{weather.cloudCover != null && <div className="ppb-wstat"><span className="ppb-metric-icon" title="Tutupan awan"><DisasterIcon type="cloud" label="Tutupan awan" /></span><b>{weather.cloudCover}%</b></div>}</div>
      <div className="ppb-source-note">{weather.timestampLabel}: {formatWib(weather.updatedAt)}{source.error && <span role="status"> / Pembaruan gagal; Data terakhir tersedia.</span>}</div>
    </>}
  </section>;
}
