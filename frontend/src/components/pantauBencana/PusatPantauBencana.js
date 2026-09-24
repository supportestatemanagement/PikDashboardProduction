import { useEffect, useState } from 'react';
import DisasterMap from './DisasterMap';
import WeatherBanner from './WeatherBanner';
import EarthquakePanel from './EarthquakePanel';
import VolcanoPanel from './VolcanoPanel';
import useVolcanoSource, { filterVolcanoes, isValidLatLng } from '../../services/disaster/pvmbgVolcano';
import { fetchLatestEarthquake, fetchEarthquakeHistory, EARTHQUAKE_REFRESH_INTERVAL } from '../../services/disaster/bmkgEarthquake';
import { weatherLoaders, WEATHER_LOCATIONS, WEATHER_REFRESH_INTERVAL } from '../../services/disaster/bmkgWeather';
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
  const weatherPik1 = useDisasterSource(weatherLoaders[0], WEATHER_REFRESH_INTERVAL, Boolean(WEATHER_LOCATIONS[0].adm4));
  const weatherPik2 = useDisasterSource(weatherLoaders[1], WEATHER_REFRESH_INTERVAL, Boolean(WEATHER_LOCATIONS[1].adm4));
  const weatherSources = [weatherPik1, weatherPik2];
  const volcanoSource = useVolcanoSource();
  const [volcanoFilter, setVolcanoFilter] = useState('ALL');
  const [selectedVolcanoId, setSelectedVolcanoId] = useState(null);
  const [volcanoFocus, setVolcanoFocus] = useState(null);
  const volcanoes = filterVolcanoes(volcanoSource.data.data, volcanoFilter);
  const changeVolcanoFilter = status => {
    setVolcanoFilter(status);
    setSelectedVolcanoId(null);
    setVolcanoFocus(null);
  };
  const focusVolcano = volcano => {
    if (volcanoSource.data.isFallback || !isValidLatLng(volcano.latitude, volcano.longitude)) return;
    setSelectedVolcanoId(volcano.id);
    setVolcanoFocus({ id: volcano.id });
  };
  return <div className="ppb-root"><div className="ppb-wrap">
    <header><div className="ppb-eyebrow"><span className="ppb-dot" />{latest.error || history.error || weatherSources.some(source => source.error) ? 'Sebagian sumber belum tersedia' : latest.loading || history.loading || weatherSources.some(source => source.loading) ? 'Menghubungkan sumber BMKG' : 'Sistem aktif - pemantauan BMKG berkala'}</div>
      <h1 className="ppb-h1">Pusat Pantau Bencana</h1><p className="ppb-subtitle">Pemantauan iklim, geologi, dan cuaca terintegrasi untuk wilayah Indonesia.</p>
      {WEATHER_LOCATIONS.map((location, index) => <WeatherBanner key={location.id} label={location.label} source={weatherSources[index]} configured={Boolean(location.adm4)} />)}
    </header>
    <div className="ppb-main-grid"><DisasterMap latestSource={latest} historySource={history} volcanoes={volcanoes} volcanoSource={volcanoSource} volcanoFocus={volcanoFocus} onVolcanoSelect={volcano => setSelectedVolcanoId(volcano.id)} /><div className="ppb-side-stack"><EarthquakePanel latestSource={latest} historySource={history} /><VolcanoPanel source={volcanoSource} volcanoes={volcanoes} filter={volcanoFilter} onFilterChange={changeVolcanoFilter} selectedId={selectedVolcanoId} onSelect={focusVolcano} /></div></div>
    <footer className="ppb-footer"><span>Sumber data: <a href="https://data.bmkg.go.id/" target="_blank" rel="noreferrer">BMKG</a>. Gempa: pembaruan 60 detik; cuaca: 30 menit. Data gunung api sementara, belum diverifikasi PVMBG/MAGMA.</span><LiveClock /></footer>
  </div></div>;
}
