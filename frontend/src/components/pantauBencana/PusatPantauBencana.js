import { useCallback, useState } from 'react';
import DisasterMap from './DisasterMap';
import WeatherBanner from './WeatherBanner';
import EarthquakePanel from './EarthquakePanel';
import MaritimeConditionCard from './MaritimeConditionCard';
import EnsoCard from './EnsoCard';
import { validEarthquakeCoordinates } from './earthquakeMap';
import { fetchLatestEarthquake, fetchEarthquakeHistory, fetchFeltEarthquakes, EARTHQUAKE_REFRESH_INTERVAL } from '../../services/disaster/bmkgEarthquake';
import { weatherLoaders, WEATHER_LOCATIONS, WEATHER_REFRESH_INTERVAL } from '../../services/disaster/bmkgWeather';
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
  return <div className="ppb-root" role="region" aria-label="Pantau Bencana"><div className="ppb-wrap">
    <div className="ppb-weather-grid">{WEATHER_LOCATIONS.map((location, index) => <WeatherBanner key={location.id} label={location.label} source={weather[index]} configured={Boolean(location.adm4)} />)}</div>
    <div className="ppb-main-grid"><DisasterMap latestSource={latest} historySource={history} feltSource={felt} nowcastingSource={nowcasting} rdcaSource={rdca} selection={quakeSelection} focusRequest={quakeFocus} onEarthquakeSelect={selectEarthquake} />
      <div className="ppb-side-stack"><EarthquakePanel latestSource={latest} historySource={history} feltSource={felt} selection={quakeSelection} onSelect={selectEarthquake} /></div>
    </div>
    <div className="ppb-maritime-grid">{MARITIME_LOCATIONS.map((location, index) => <MaritimeConditionCard key={location.id} location={location} source={maritime[index]} />)}</div>
    <div className="ppb-climate-section"><EnsoCard source={enso} /></div>
  </div></div>;
}
