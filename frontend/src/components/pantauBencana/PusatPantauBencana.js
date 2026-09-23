import { useEffect, useState } from 'react';
import DisasterMap from './DisasterMap';
import WeatherBanner from './WeatherBanner';
import EarthquakePanel from './EarthquakePanel';
import VolcanoPanel from './VolcanoPanel';
import { VOLCANOES } from '../../services/disaster/volcanoService';
import { fetchLatestEarthquake, fetchEarthquakeHistory, EARTHQUAKE_REFRESH_INTERVAL } from '../../services/disaster/bmkgEarthquake';
import { fetchWeather, WEATHER_ADM4, WEATHER_REFRESH_INTERVAL } from '../../services/disaster/bmkgWeather';
import useDisasterSource from '../../services/disaster/useDisasterSource';
import { formatWib } from '../../services/disaster/client';
import './pantauBencana.css';

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span className="ppb-clock">{formatWib(now)} / {new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now)}</span>;
}
export default function PusatPantauBencana() {
  const latest = useDisasterSource(fetchLatestEarthquake, EARTHQUAKE_REFRESH_INTERVAL);
  const history = useDisasterSource(fetchEarthquakeHistory, EARTHQUAKE_REFRESH_INTERVAL);
  const weather = useDisasterSource(fetchWeather, WEATHER_REFRESH_INTERVAL, Boolean(WEATHER_ADM4));
  return <div className="ppb-root"><div className="ppb-wrap">
    <header><div className="ppb-eyebrow"><span className="ppb-dot" />{latest.error || history.error || weather.error ? 'Sebagian sumber belum tersedia' : latest.loading || history.loading ? 'Menghubungkan sumber BMKG' : 'Sistem aktif - pemantauan BMKG berkala'}</div>
      <h1 className="ppb-h1">Pusat Pantau Bencana</h1><p className="ppb-subtitle">Pemantauan iklim, geologi, dan cuaca terintegrasi untuk wilayah Indonesia.</p>
      <WeatherBanner source={weather} configured={Boolean(WEATHER_ADM4)} />
    </header>
    <div className="ppb-main-grid"><DisasterMap latestSource={latest} historySource={history} /><div className="ppb-side-stack"><EarthquakePanel latestSource={latest} historySource={history} /><VolcanoPanel volcanoes={VOLCANOES} /></div></div>
    <footer className="ppb-footer"><span>Sumber data: <a href="https://data.bmkg.go.id/" target="_blank" rel="noreferrer">BMKG</a>. Gempa: pembaruan 60 detik; cuaca: 30 menit. Data gunung api sementara, belum diverifikasi PVMBG/MAGMA.</span><LiveClock /></footer>
  </div></div>;
}
