import { useCallback, useState } from 'react';
import DisasterMap from './DisasterMap';
import WeatherBanner from './WeatherBanner';
import EarthquakePanel from './EarthquakePanel';
import MaritimeConditionCard from './MaritimeConditionCard';
import EnsoCard from './EnsoCard';
import CurrentSituationCard from './CurrentSituationCard';
import SourceStatus from './SourceStatus';
import { validEarthquakeCoordinates } from './earthquakeMap';
import { fetchLatestEarthquake, fetchEarthquakeHistory, fetchFeltEarthquakes, EARTHQUAKE_REFRESH_INTERVAL } from '../../services/disaster/bmkgEarthquake';
import { weatherLoaders, WEATHER_LOCATIONS, WEATHER_REFRESH_INTERVAL } from '../../services/disaster/bmkgWeather';
import { fetchHotspots, HOTSPOT_REFRESH_INTERVAL } from '../../services/disaster/bmkgHotspot';
import { fetchNowcasting, NOWCASTING_REFRESH_INTERVAL } from '../../services/disaster/bmkgNowcasting';
import { fetchRdca, RDCA_REFRESH_INTERVAL } from '../../services/disaster/bmkgRdca';
import { maritimeLoaders, MARITIME_LOCATIONS, MARITIME_REFRESH_INTERVAL } from '../../services/disaster/bmkgMaritime';
import { fetchEnso, ENSO_REFRESH_INTERVAL } from '../../services/disaster/noaaEnsoService';
import useDisasterSource from '../../services/disaster/useDisasterSource';
import './pantauBencana.css';

export default function PusatPantauBencana() {
  const latest = useDisasterSource(fetchLatestEarthquake, EARTHQUAKE_REFRESH_INTERVAL);
  const history = useDisasterSource(fetchEarthquakeHistory, EARTHQUAKE_REFRESH_INTERVAL);
  const felt = useDisasterSource(fetchFeltEarthquakes, EARTHQUAKE_REFRESH_INTERVAL);
  const weatherPik1 = useDisasterSource(weatherLoaders[0], WEATHER_REFRESH_INTERVAL, Boolean(WEATHER_LOCATIONS[0].adm4));
  const weatherPik2 = useDisasterSource(weatherLoaders[1], WEATHER_REFRESH_INTERVAL, Boolean(WEATHER_LOCATIONS[1].adm4));
  const hotspot = useDisasterSource(fetchHotspots, HOTSPOT_REFRESH_INTERVAL);
  const nowcasting = useDisasterSource(fetchNowcasting, NOWCASTING_REFRESH_INTERVAL);
  const rdca = useDisasterSource(fetchRdca, RDCA_REFRESH_INTERVAL);
  const maritimePik1 = useDisasterSource(maritimeLoaders[0], MARITIME_REFRESH_INTERVAL);
  const maritimePik2 = useDisasterSource(maritimeLoaders[1], MARITIME_REFRESH_INTERVAL);
  const enso = useDisasterSource(fetchEnso, ENSO_REFRESH_INTERVAL);
  const [quakeSelection, setQuakeSelection] = useState(null);
  const [quakeFocus, setQuakeFocus] = useState(null);
  const selectEarthquake = useCallback((quake, kind, navigate = true) => {
    if (!validEarthquakeCoordinates(quake.coordinates)) return;
    setQuakeSelection({ id: quake.id, kind });
    if (navigate) setQuakeFocus({ id: quake.id, kind });
  }, []);
  const weather = [weatherPik1, weatherPik2], maritime = [maritimePik1, maritimePik2];
  const sources = { latest, history, felt, weather, hotspot, nowcasting, rdca, maritime, enso };
  const refreshedAt = Math.max(0, ...[latest, history, felt, ...weather, hotspot, nowcasting, rdca, ...maritime, enso].map(source => source.refreshedAt || 0));
  // Sources load once per cadence for the situation summary; map toggles only
  // control visibility and do not issue duplicate requests.
  return <div className="ppb-root"><div className="ppb-wrap">
    <header className="ppb-dashboard-header"><div><div className="ppb-eyebrow">Monitoring sumber resmi</div><h1 className="ppb-h1">Pusat Pantau Bencana</h1><p className="ppb-subtitle">Integrated Weather, Disaster &amp; Climate Monitoring</p></div>
      <div className="ppb-refresh"><span>Last Refresh</span><strong>{refreshedAt ? new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(refreshedAt).replace('.', ':') + ' WIB' : 'Menunggu sumber'}</strong><small><span className="ppb-dot" /> Auto Refresh</small></div>
    </header>
    <CurrentSituationCard sources={sources} onEarthquakeSelect={selectEarthquake} />
    <h2 className="ppb-section-title">Prakiraan Cuaca Lokal</h2>
    <div className="ppb-weather-grid">{WEATHER_LOCATIONS.map((location, index) => <WeatherBanner key={location.id} label={location.label} source={weather[index]} configured={Boolean(location.adm4)} />)}</div>
    <div className="ppb-main-grid"><DisasterMap latestSource={latest} historySource={history} feltSource={felt} hotspotSource={hotspot} nowcastingSource={nowcasting} rdcaSource={rdca} selection={quakeSelection} focusRequest={quakeFocus} onEarthquakeSelect={selectEarthquake} />
      <div className="ppb-side-stack"><EarthquakePanel latestSource={latest} historySource={history} feltSource={felt} selection={quakeSelection} onSelect={selectEarthquake} /></div>
    </div>
    <h2 className="ppb-section-title">Kondisi Maritim</h2><p className="ppb-muted">Prakiraan kondisi perairan dari titik referensi BMKG Maritim.</p>
    <div className="ppb-maritime-grid">{MARITIME_LOCATIONS.map((location, index) => <MaritimeConditionCard key={location.id} location={location} source={maritime[index]} />)}</div>
    <h2 className="ppb-section-title">Kondisi Iklim</h2><div className="ppb-climate-section"><EnsoCard source={enso} /></div>
    <SourceStatus sources={sources} />
    <footer className="ppb-footer">Last Refresh adalah waktu keberhasilan pengambilan terakhir, bukan waktu kejadian atau berlaku data. Cadence: gempa/nowcasting/RDCA 5 menit; hotspot 15 menit; cuaca/maritim 30 menit; ENSO 6 jam.</footer>
  </div></div>;
}
