import "./AvailableParkingDashboard.css";

const AREAS = ["BGM", "GI", "RWI"];
const LOCATIONS = [
  { name: "PIK ICON", area: "BGM", capacity: 1500, occupied: 1349 },
  { name: "La Riviera", area: "BGM", capacity: 800, occupied: 402 },
  { name: "The Breeze", area: "BGM", capacity: 650, occupied: 112 },
  { name: "Golf Island Marina", area: "GI", capacity: 400, occupied: 351 },
  { name: "Riverwalk Boardwalk", area: "RWI", capacity: 300, occupied: 48 },
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
  const capacity = LOCATIONS.reduce((sum, location) => sum + location.capacity, 0);
  const occupied = LOCATIONS.reduce((sum, location) => sum + location.occupied, 0);
  const crowded = LOCATIONS.filter((location) => status(location) !== "available").length;
  const summaries = [
    { label: "Total kapasitas parkir", value: `${number(capacity)} slot`, note: `Dari ${LOCATIONS.length} lokasi · 3 area`, theme: "primary" },
    { label: "Slot tersedia saat ini", value: `${number(capacity - occupied)} slot`, note: `Snapshot ${UPDATED}`, theme: "green" },
    { label: "Slot terisi", value: `${number(occupied)} slot`, note: "Kendaraan yang sedang parkir", theme: "navy" },
    { label: "Rata-rata tingkat terisi", value: `${(occupied / capacity * 100).toFixed(1)}%`, note: `${crowded} dari ${LOCATIONS.length} lokasi berstatus PADAT/PENUH`, theme: "orange" },
  ];

  return (
    <main className="available-parking">
      <section aria-label="Ringkasan ketersediaan parkir">
        <div className="parking-summary-grid">
          {summaries.map((item) => (
            <article key={item.label} className={`parking-summary parking-summary-${item.theme}`}>
              <h3>{item.label}</h3><strong>{item.value}</strong><p>{item.note}</p>
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
              <section className="parking-area" key={area} aria-labelledby={`parking-area-${area}`}>
                <header className="parking-area-heading">
                  <div>
                    <h2 id={`parking-area-${area}`}>{area} · Status Parkir Per Lokasi</h2>
                    <p>{locations.length} lokasi · {number(available)} slot tersedia</p>
                  </div>
                  <p>{UPDATED}</p>
                </header>
                <div className="parking-legend" aria-label={`Keterangan status parkir ${area}`}>
                  <span className="parking-available">Tersedia &lt;80%</span>
                  <span className="parking-busy">Padat 80–&lt;95%</span>
                  <span className="parking-full">Penuh ≥95%</span>
                </div>
                <div className="parking-area-locations">{locations.map((location) => <LocationCard key={location.name} location={location} />)}</div>
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
            <article className="parking-ranking" key={area} aria-label={`Grafik tingkat terisi ${area}`}>
              <header><h3>{area}</h3><span>Tingkat terisi (%)</span></header>
              <div className="parking-ranking-bars">
                {LOCATIONS.filter((location) => location.area === area).sort((a, b) => percent(b) - percent(a)).map((location) => (
                  <div key={location.name} className={`parking-rank-row parking-${status(location)}`}>
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
