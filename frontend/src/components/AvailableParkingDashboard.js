import { useEffect, useState } from "react";
import { fetchParkingRows, formatParkingTime } from "../services/parkingService";
import "./AvailableParkingDashboard.css";

const AREAS = ["BGM", "GI", "RWI"];
const AREA_LOGOS = { BGM: "/logobgm.png", GI: "/logogi2.png", RWI: "/logorwi2.png" };
const number = (value) => value.toLocaleString("id-ID");
const percent = (location) => location.capacity > 0 ? location.occupied / location.capacity * 100 : location.occupied > 0 ? 100 : 0;
const status = (location) => percent(location) >= 95 ? "full" : percent(location) >= 80 ? "busy" : "available";
const LABELS = { full: "PENUH", busy: "PADAT", available: "TERSEDIA" };


const VEHICLES = [{ key: 'car', label: 'Mobil' }, { key: 'bike', label: 'Motor' }];
const vehicleMetrics = (location, vehicle) => ({ capacity: location[`${vehicle}Capacity`], occupied: location[`${vehicle}Qty`] });
const occupancyLabel = metrics => `${percent(metrics).toFixed(1)}%`;

function OverCapacity({ metrics }) {
  const excess = metrics.occupied - metrics.capacity;
  return excess > 0 ? <span className="parking-over">Melebihi kapasitas: <strong>{number(excess)}</strong> kendaraan</span> : null;
}

function Availability({ metrics, slots = false, showOver = true }) {
  const remaining = metrics.capacity - metrics.occupied;
  return <span className={`parking-availability-value parking-${status(metrics)}`}>
    <span className="parking-availability-count">{number(Math.max(0, remaining))}{slots && <small> slot</small>}</span>
    {showOver && <OverCapacity metrics={metrics} />}
  </span>;
}

function VehicleChart({ location, vehicle }) {
  const metrics = vehicleMetrics(location, vehicle.key);
  const state = status(metrics);
  const label = occupancyLabel(metrics);
  return (
    <section className={`parking-vehicle parking-${state}`} aria-label={`${location.name} ${vehicle.label}`}>
      <header><h5>{vehicle.label}</h5><span className="parking-status">{metrics.capacity === 0 && metrics.occupied === 0 ? 'TANPA KAPASITAS' : LABELS[state]}</span></header>
      <div className="parking-donut" style={{ "--occupancy": `${Math.min(100, percent(metrics))}%` }} role="img" aria-label={`${location.name}: ${vehicle.label} ${label} terisi`}>
        <strong>{label}</strong>
      </div>
      <dl className="parking-counts">
        <div><dt>Kapasitas</dt><dd>{number(metrics.capacity)}</dd></div>
        <div><dt>Terisi</dt><dd>{number(metrics.occupied)}</dd></div>
        <div><dt>Tersedia</dt><dd><Availability metrics={metrics} showOver={false} /></dd></div>
      </dl>
      <OverCapacity metrics={metrics} />
    </section>
  );
}

function LocationCard({ location }) {
  return (
    <article className="parking-location" aria-label={`Parkir ${location.name}`}>
      <div className="parking-location-heading"><h4>{location.name}</h4></div>
      <div className="parking-vehicle-grid">
        {VEHICLES.map(vehicle => <VehicleChart key={vehicle.key} location={location} vehicle={vehicle} />)}
      </div>
      <p className="parking-summary-snapshot">Pembaruan: {formatParkingTime(location.timestamp)}</p>
    </article>
  );
}

export default function AvailableParkingDashboard() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [rankingVehicles, setRankingVehicles] = useState({ BGM: 'car', GI: 'car', RWI: 'car' });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timer;
    const load = async () => {
      try {
        const rows = await fetchParkingRows(controller.signal);
        if (active) { setLocations(rows); setError(''); }
      } catch (failure) {
        if (active && failure.name !== 'AbortError') setError('Gagal memperbarui data SPI_Parking. Data yang sudah tampil merupakan pembaruan sebelumnya.');
      } finally {
        if (active) { setLoading(false); timer = setTimeout(load, 60000); }
      }
    };
    load();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [refresh]);

  const summaries = AREAS.map((area) => {
    const areaLocations = locations.filter((location) => location.area === area);
    const vehicles = VEHICLES.map(vehicle => ({ ...vehicle,
      capacity: areaLocations.reduce((sum, location) => sum + location[`${vehicle.key}Capacity`], 0),
      occupied: areaLocations.reduce((sum, location) => sum + location[`${vehicle.key}Qty`], 0),
    }));
    return { area, vehicles, count: areaLocations.length, updated: Math.max(0, ...areaLocations.map(location => location.timestamp)) };
  });

  return (
    <main className="available-parking">
      {loading && <p role="status">Memuat data SPI_Parking...</p>}
      {error && <p role="alert">{error} <button onClick={() => setRefresh(value => value + 1)}>Coba lagi</button></p>}
      {!loading && !error && !locations.length && <p role="status">Belum ada data parkir BGM, GI, atau RWI.</p>}
      <p className="parking-section-description">Tingkat terisi = jumlah kendaraan / kapasitas × 100%. Jika kapasitas nol, indikator menunjukkan 100% saat ada kendaraan dan 0% saat kosong. Diperbarui otomatis setiap menit.</p>
      <section aria-label="Ringkasan ketersediaan parkir">
        <div className="parking-summary-grid">
          {summaries.map((item) => (
            <article key={item.area} className="parking-summary" data-area={item.area} aria-label={`Ringkasan parkir ${item.area}`}>
              <header className="parking-summary-heading">
                <img className="parking-area-logo" src={AREA_LOGOS[item.area]} alt={item.area} />
                <span>{item.count} lokasi parkir</span>
              </header>
              <div className="parking-summary-vehicles">
                {item.vehicles.map(vehicle => (
                  <section key={vehicle.key} aria-label={`Ringkasan ${vehicle.label} ${item.area}`}>
                    <div className="parking-summary-capacity"><h3>Total Kapasitas {vehicle.label}</h3><strong>{number(vehicle.capacity)} <small>slot</small></strong></div>
                    <dl className="parking-summary-metrics">
                      <div><dt>Terisi</dt><dd>{number(vehicle.occupied)} <small>slot</small></dd></div>
                      <div><dt>Tersedia</dt><dd><Availability metrics={vehicle} slots /></dd></div>
                      <div><dt>Tingkat terisi</dt><dd className={`parking-occupancy-value parking-${status(vehicle)}`}>{occupancyLabel(vehicle)}</dd></div>
                    </dl>
                  </section>
                ))}
              </div>
              <p className="parking-summary-snapshot">Pembaruan: {formatParkingTime(item.updated)}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-label="Status parkir per area">
        <div className="parking-area-stack">
          {AREAS.map((area) => {
            const areaLocations = locations.filter((location) => location.area === area);
            const metrics = {
              capacity: areaLocations.reduce((sum, location) => sum + location.capacity, 0),
              occupied: areaLocations.reduce((sum, location) => sum + location.occupied, 0),
            };
            return (
              <section className="parking-area" data-area={area} key={area} aria-labelledby={`parking-area-${area}`}>
                <header className="parking-area-heading">
                  <div className="parking-area-identity">
                    <img className="parking-area-logo" src={AREA_LOGOS[area]} alt={area} />
                    <div>
                      <h2 id={`parking-area-${area}`}><span>{area} · </span>Status Parkir per Lokasi</h2>
                      <p className="parking-area-meta"><span>{areaLocations.length} lokasi</span><span className="parking-area-availability"><Availability metrics={metrics} slots /> tersedia</span></p>
                    </div>
                  </div>
                  <p className="parking-area-updated"><span>Pembaruan terakhir</span><time dateTime={areaLocations.length ? new Date(Math.max(...areaLocations.map(location => location.timestamp))).toISOString() : undefined}>{formatParkingTime(Math.max(0, ...areaLocations.map(location => location.timestamp)))}</time></p>
                </header>
                <div className="parking-legend" aria-label={`Keterangan status parkir ${area}`}>
                  <span className="parking-available">Tersedia &lt;80%</span>
                  <span className="parking-busy">Padat 80–&lt;95%</span>
                  <span className="parking-full">Penuh ≥95%</span>
                </div>
                <div className="parking-area-locations">{areaLocations.map((location) => <LocationCard key={location.id} location={location} />)}</div>
              </section>
            );
          })}
        </div>
      </section>

      <section className="parking-ranking-panel" aria-labelledby="parking-ranking-title">
        <h2 id="parking-ranking-title">Lokasi dengan Tingkat Terisi Tertinggi</h2>
        <p className="parking-section-description">Diurutkan berdasarkan tingkat terisi jenis kendaraan yang dipilih pada masing-masing area</p>
        <div className="parking-area-grid">
          {AREAS.map((area) => (
            <article className="parking-ranking" data-area={area} key={area} aria-label={`Grafik tingkat terisi ${area}`}>
              <header><h3>{area}</h3><label className="parking-ranking-filter">Jenis kendaraan
                <select aria-label={`Jenis kendaraan ranking ${area}`} value={rankingVehicles[area]} onChange={event => setRankingVehicles(previous => ({ ...previous, [area]: event.target.value }))}>
                  {VEHICLES.map(vehicle => <option key={vehicle.key} value={vehicle.key}>{vehicle.label}</option>)}
                </select>
              </label><span>Tingkat terisi (%)</span></header>
              <div className="parking-ranking-bars">
                {locations.filter((location) => location.area === area).map(location => ({ ...location, ...vehicleMetrics(location, rankingVehicles[area]) })).sort((a, b) => percent(b) - percent(a)).map((location) => (
                  <div key={location.id} className={`parking-rank-row parking-${status(location)}`}>
                    <div className="parking-rank-label"><span>{location.name}</span><strong>{percent(location).toFixed(1)}%</strong></div>
                    <div className="parking-bar-track"><div className="parking-bar" style={{ width: `${Math.min(100, percent(location))}%` }} /></div>
                  </div>
                ))}
              </div>
              <div className="parking-chart-axis" aria-hidden="true">{[0, 25, 50, 75, 100].map((tick) => <span key={tick}>{tick}%</span>)}</div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
