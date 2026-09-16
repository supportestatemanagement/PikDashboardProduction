import "./AvailableParkingDashboard.css";

const AREAS = ["BGM", "GI", "RWI"];
const AREA_LOGOS = { BGM: "/logobgm.png", GI: "/logogi2.png", RWI: "/logorwi2.png" };
const LOCATIONS = [
  // Capacities and occupancy are illustrative dummy values.
  { id: 101, name: "EMERALD PARK", area: "BGM", capacity: 1500, occupied: 1349 },
  { id: 102, name: "RUKAN EXCLUSIVE", area: "BGM", capacity: 800, occupied: 402 },
  { id: 103, name: "RUKAN CORDOBA", area: "BGM", capacity: 650, occupied: 112 },
  { id: 104, name: "CROWN GOLF", area: "BGM", capacity: 450, occupied: 288 },
  { id: 105, name: "RUKAN GARDEN HOUSE", area: "BGM", capacity: 500, occupied: 425 },
  { id: 106, name: "RUKAN GOLD COAST", area: "BGM", capacity: 600, occupied: 576 },
  { id: 141, name: "RUKAN PALLADIUM", area: "GI", capacity: 400, occupied: 351 },
  { id: 144, name: "RUKAN GOLF ISLAND", area: "GI", capacity: 550, occupied: 330 },
  { id: 148, name: "RUKAN THEME PARK", area: "GI", capacity: 350, occupied: 140 },
  { id: 153, name: "RUKAN AMSTERDAM", area: "RWI", capacity: 300, occupied: 48 },
  { id: 154, name: "RUKAN EBONY BATAVIA", area: "RWI", capacity: 450, occupied: 234 },
];
const number = (value) => value.toLocaleString("id-ID");
const percent = (location) => location.occupied / location.capacity * 100;
const status = (location) => percent(location) >= 95 ? "full" : percent(location) >= 80 ? "busy" : "available";
const LABELS = { full: "PENUH", busy: "PADAT", available: "TERSEDIA" };
const UPDATED = "16 Sep 2026, 09:32 WIB";

function LocationCard({ location }) {
  const value = percent(location);
  return (
    <article className={`parking-location parking-${status(location)}`}>
      <div className="parking-location-heading">
        <h4>{location.name}</h4>
        <span className="parking-status">{LABELS[status(location)]}</span>
      </div>
      <div className="parking-location-body">
        <div className="parking-donut" style={{ "--occupancy": `${value}%` }} role="img" aria-label={`${value.toFixed(1)}% terisi`}>
          <strong>{value.toFixed(1)}%</strong>
        </div>
        <dl className="parking-counts">
          <div><dt>Tersedia</dt><dd>{number(location.capacity - location.occupied)}</dd></div>
          <div><dt>Terisi</dt><dd>{number(location.occupied)}</dd></div>
          <div><dt>Kapasitas</dt><dd>{number(location.capacity)}</dd></div>
        </dl>
      </div>
    </article>
  );
}

export default function AvailableParkingDashboard() {
  const summaries = AREAS.map((area) => {
    const locations = LOCATIONS.filter((location) => location.area === area);
    const capacity = locations.reduce((sum, location) => sum + location.capacity, 0);
    const occupied = locations.reduce((sum, location) => sum + location.occupied, 0);
    return { area, capacity, occupied, available: capacity - occupied, count: locations.length };
  });

  return (
    <main className="available-parking">
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
              <p className="parking-summary-snapshot">Pembaruan: {UPDATED}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-label="Status parkir per area">
        <div className="parking-area-stack">
          {AREAS.map((area) => {
            const locations = LOCATIONS.filter((location) => location.area === area);
            const available = locations.reduce((sum, location) => sum + location.capacity - location.occupied, 0);
            return (
              <section className="parking-area" data-area={area} key={area} aria-labelledby={`parking-area-${area}`}>
                <header className="parking-area-heading">
                  <div className="parking-area-identity">
                    <img className="parking-area-logo" src={AREA_LOGOS[area]} alt={area} />
                    <div>
                      <h2 id={`parking-area-${area}`}><span className="parking-visually-hidden">{area} · </span>Status Parkir per Lokasi</h2>
                      <p className="parking-area-meta"><span>{locations.length} lokasi</span><span className="parking-area-availability"><strong>{number(available)}</strong> slot tersedia</span></p>
                    </div>
                  </div>
                  <p className="parking-area-updated"><span>Pembaruan terakhir</span><time dateTime="2026-09-16T09:32:00+07:00">{UPDATED}</time></p>
                </header>
                <div className="parking-legend" aria-label={`Keterangan status parkir ${area}`}>
                  <span className="parking-available">Tersedia &lt;80%</span>
                  <span className="parking-busy">Padat 80–&lt;95%</span>
                  <span className="parking-full">Penuh ≥95%</span>
                </div>
                <div className="parking-area-locations">{locations.map((location) => <LocationCard key={location.id} location={location} />)}</div>
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
                {LOCATIONS.filter((location) => location.area === area).sort((a, b) => percent(b) - percent(a)).map((location) => (
                  <div key={location.id} className={`parking-rank-row parking-${status(location)}`}>
                    <div className="parking-rank-label"><span>{location.name}</span><strong>{percent(location).toFixed(1)}%</strong></div>
                    <div className="parking-bar-track"><div className="parking-bar" style={{ width: `${percent(location)}%` }} /></div>
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
