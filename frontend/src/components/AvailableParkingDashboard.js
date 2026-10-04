import { useEffect, useState } from "react";
import { fetchParkingRows, formatParkingTime } from "../services/parkingService";
import "./AvailableParkingDashboard.css";

const AREAS = ["BGM", "GI", "RWI"];
const AREA_LOGOS = { BGM: "/logobgm.png", GI: "/logogi2.png", RWI: "/logorwi2.png" };
const number = (value) => value.toLocaleString("id-ID");
const percent = (location) => location.capacity > 0 ? location.occupied / location.capacity * 100 : location.occupied > 0 ? 100 : 0;
const status = (location) => percent(location) >= 95 ? "full" : percent(location) >= 80 ? "busy" : "available";
const LABELS = { full: "PENUH", busy: "PADAT", available: "TERSEDIA" };


function LocationCard({ location }) {
  const value = percent(location);
  return (
    <article className={`parking-location parking-${status(location)}`}>
      <div className="parking-location-heading">
        <h4>{location.name}</h4>
        <span className="parking-status">{LABELS[status(location)]}</span>
      </div>
      <div className="parking-location-body">
        <div className="parking-donut" style={{ "--occupancy": `${Math.min(100, value)}%` }} role="img" aria-label={`${value.toFixed(1)}% terisi`}>
          <strong>{value.toFixed(1)}%</strong>
        </div>
        <dl className="parking-counts">
          <div><dt>Tersedia</dt><dd>{number(location.capacity - location.occupied)}</dd></div>
          <div><dt>Terisi</dt><dd>{number(location.occupied)}</dd></div>
          <div><dt>Kapasitas</dt><dd>{number(location.capacity)}</dd></div>
        </dl>
      </div>
      <dl className="parking-counts parking-vehicle-counts">
        <div><dt>Mobil: tersedia / masuk / kapasitas</dt><dd>{number(location.carCapacity - location.carQty)} / {number(location.carQty)} / {number(location.carCapacity)}</dd></div>
        <div><dt>Motor: tersedia / masuk / kapasitas</dt><dd>{number(location.bikeCapacity - location.bikeQty)} / {number(location.bikeQty)} / {number(location.bikeCapacity)}</dd></div>
      </dl>
      <p className="parking-summary-snapshot">Pembaruan: {formatParkingTime(location.timestamp)}</p>
    </article>
  );
}

export default function AvailableParkingDashboard() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
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
    const capacity = areaLocations.reduce((sum, location) => sum + location.capacity, 0);
    const occupied = areaLocations.reduce((sum, location) => sum + location.occupied, 0);
    return { area, capacity, occupied, available: capacity - occupied, count: areaLocations.length, updated: Math.max(0, ...areaLocations.map(location => location.timestamp)) };
  });

  return (
    <main className="available-parking">
      {loading && <p role="status">Memuat data SPI_Parking...</p>}
      {error && <p role="alert">{error} <button onClick={() => setRefresh(value => value + 1)}>Coba lagi</button></p>}
      {!loading && !error && !locations.length && <p role="status">Belum ada data parkir BGM, GI, atau RWI.</p>}
      <p className="parking-section-description">Total mencakup mobil dan motor. Diperbarui otomatis setiap menit; nilai tersedia negatif berarti jumlah kendaraan melebihi kapasitas.</p>
      <section aria-label="Ringkasan ketersediaan parkir">
        <div className="parking-summary-grid">
          {summaries.map((item) => (
            <article key={item.area} className="parking-summary" data-area={item.area} aria-label={`Ringkasan parkir ${item.area}`}>
              <header className="parking-summary-heading">
                <img className="parking-area-logo" src={AREA_LOGOS[item.area]} alt={item.area} />
                <span>{item.count} lokasi parkir</span>
              </header>
              <div className="parking-summary-capacity"><h3>Total kapasitas parkir</h3><strong>{number(item.capacity)} <small>slot</small></strong></div>
              <dl className="parking-summary-metrics">
                <div><dt>Tersedia</dt><dd className="parking-summary-available">{number(item.available)} <small>slot</small></dd></div>
                <div><dt>Terisi</dt><dd>{number(item.occupied)} <small>slot</small></dd></div>
                <div><dt>Tingkat terisi</dt><dd>{percent(item).toFixed(1)}<small>%</small></dd></div>
              </dl>
              <p className="parking-summary-snapshot">Pembaruan: {formatParkingTime(item.updated)}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-label="Status parkir per area">
        <div className="parking-area-stack">
          {AREAS.map((area) => {
            const areaLocations = locations.filter((location) => location.area === area);
            const available = areaLocations.reduce((sum, location) => sum + location.capacity - location.occupied, 0);
            return (
              <section className="parking-area" data-area={area} key={area} aria-labelledby={`parking-area-${area}`}>
                <header className="parking-area-heading">
                  <div className="parking-area-identity">
                    <img className="parking-area-logo" src={AREA_LOGOS[area]} alt={area} />
                    <div>
                      <h2 id={`parking-area-${area}`}><span className="parking-visually-hidden">{area} · </span>Status Parkir per Lokasi</h2>
                      <p className="parking-area-meta"><span>{areaLocations.length} lokasi</span><span className="parking-area-availability"><strong>{number(available)}</strong> slot tersedia</span></p>
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
        <p className="parking-section-description">Diurutkan dari yang paling padat pada masing-masing area</p>
        <div className="parking-area-grid">
          {AREAS.map((area) => (
            <article className="parking-ranking" data-area={area} key={area} aria-label={`Grafik tingkat terisi ${area}`}>
              <header><h3>{area}</h3><span>Tingkat terisi (%)</span></header>
              <div className="parking-ranking-bars">
                {locations.filter((location) => location.area === area).sort((a, b) => percent(b) - percent(a)).map((location) => (
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
