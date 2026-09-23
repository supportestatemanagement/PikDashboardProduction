import React, { useEffect, useState } from "react";

/**
 * PusatPantauBencana
 * -------------------
 * Dashboard pemantauan bencana (gempa bumi & gunung api) untuk Indonesia.
 * Komponen React murni (.js, bukan .jsx/.tsx) — tempelkan langsung ke proyek
 * Create React App / Vite / Next.js (pages atau app router, tandai "use client"
 * di Next.js App Router karena komponen ini memakai hooks & interval).
 *
 * Tidak ada dependency eksternal (tanpa peta tile / Leaflet) — peta digambar
 * sebagai SVG stylized agar komponen ini tetap "drop-in" tanpa API key.
 * Ganti array QUAKES / VOLCANOES / WEATHER dengan data dari API BMKG / MAGMA
 * Indonesia bila tersedia.
 */

// ---------------------------------------------------------------------------
// Data (ganti dengan hasil fetch API sungguhan bila tersedia)
// ---------------------------------------------------------------------------

const WEATHER = {
  temp: 32,
  desc: "Cerah Berawan",
  location: "Kab. Tangerang, Banten",
  humidity: 75,
  windSpeed: 12,
  windDir: "Tenggara",
  icon: "⛅",
};

const LATEST_QUAKE = {
  magnitude: 4.7,
  location: "Pusat gempa berada di laut 48 km utara Ruteng-Manggarai",
  time: "23 Sep 2026, 09:02:44 WIB",
  depthKm: 9,
  felt: true,
};

const QUAKE_HISTORY = [
  { mag: 4.6, location: "Pusat gempa berada di laut 38 km selatan Sumur", time: "23 Sep 2026, 05:27:42 WIB" },
  { mag: 4.5, location: "Pusat gempa berada di laut 51 km utara Ruteng-Manggarai", time: "22 Sep 2026, 22:14:09 WIB" },
  { mag: 5.1, location: "Pusat gempa berada di darat 12 km tenggara Bengkulu", time: "22 Sep 2026, 16:48:31 WIB" },
  { mag: 5.3, location: "Pusat gempa berada di laut 64 km barat daya Pangandaran", time: "22 Sep 2026, 09:03:12 WIB" },
  { mag: 4.8, location: "Pusat gempa berada di laut 27 km utara Ternate", time: "21 Sep 2026, 19:55:47 WIB" },
];

const VOLCANOES = [
  { name: "G. Lewotobi Laki-laki", place: "Flores Timur, NTT", status: "AWAS" },
  { name: "G. Ibu", place: "Halmahera Barat, Maluku Utara", status: "AWAS" },
  { name: "G. Marapi", place: "Agam/Batusangkar, Sumatera Barat", status: "SIAGA" },
  { name: "G. Ili Lewotolok", place: "Lembata, NTT", status: "SIAGA" },
  { name: "G. Merapi", place: "Sleman, DI Yogyakarta", status: "SIAGA" },
  { name: "G. Semeru", place: "Lumajang, Jawa Timur", status: "SIAGA" },
  { name: "G. Ruang", place: "Sitaro, Sulawesi Utara", status: "SIAGA" },
];

// Marker gunung api pada peta SVG (koordinat pada viewBox 0 0 1000 460)
const VOLCANO_MARKERS = [
  { x: 560, y: 368, status: "AWAS", label: "G. Lewotobi Laki-laki" },
  { x: 682, y: 204, status: "AWAS", label: "G. Ibu" },
  { x: 152, y: 222, status: "SIAGA", label: "G. Marapi" },
  { x: 320, y: 332, status: "SIAGA", label: "G. Merapi" },
  { x: 352, y: 340, status: "SIAGA", label: "G. Semeru" },
  { x: 592, y: 388, status: "SIAGA", label: "G. Ili Lewotolok" },
  { x: 608, y: 158, status: "SIAGA", label: "G. Ruang" },
];

// Marker gempa riwayat (M >= 5) pada peta SVG
const QUAKE_MARKERS = [
  { x: 90, y: 210, label: "M5.1 — 242 km barat Sumatera Utara" },
  { x: 128, y: 238, label: "M5.4 — lepas pantai Sumatera Barat" },
  { x: 252, y: 378, label: "M5.0 — Selatan Jawa Barat" },
  { x: 298, y: 384, label: "M5.3 — Selatan Jawa Tengah" },
  { x: 352, y: 390, label: "M5.2 — Selatan Jawa Timur" },
  { x: 480, y: 404, label: "M5.1 — Selatan Bali" },
  { x: 578, y: 412, label: "M5.5 — Laut Sawu, NTT" },
  { x: 648, y: 268, label: "M5.0 — Laut Maluku" },
  { x: 700, y: 258, label: "M5.3 — Halmahera" },
  { x: 905, y: 258, label: "M5.2 — Papua Barat" },
];

const QUAKE_RECENT_MARKER = { x: 565, y: 368 };

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function WeatherBanner({ weather }) {
  return (
    <div className="ppb-weather">
      <div className="ppb-weather-left">
        <div className="ppb-weather-icon">{weather.icon}</div>
        <div>
          <div>
            <span className="ppb-weather-temp">{weather.temp}°C</span>
            <span className="ppb-weather-desc"> &nbsp;|&nbsp; {weather.desc}</span>
          </div>
          <div className="ppb-weather-loc">{weather.location}</div>
        </div>
      </div>
      <div className="ppb-weather-right">
        <div className="ppb-wstat">💧 Kelembapan <b>{weather.humidity}%</b></div>
        <div className="ppb-wstat">🌬️ Angin <b>{weather.windSpeed} km/jam</b> {weather.windDir}</div>
      </div>
    </div>
  );
}

function DisasterMap() {
  const [scale, setScale] = useState(1);
  const min = 1, max = 2.4, step = 0.25;

  const zoomIn = () => setScale((s) => Math.min(max, +(s + step).toFixed(2)));
  const zoomOut = () => setScale((s) => Math.max(min, +(s - step).toFixed(2)));

  return (
    <section className="ppb-panel">
      <div className="ppb-panel-head">
        <div className="ppb-panel-title"><span className="ppb-ind" />WebGIS Peta Bencana Indonesia</div>
      </div>
      <div className="ppb-map-body">
        <div className="ppb-map-frame">
          <div className="ppb-map-ctrl">
            <button onClick={zoomIn} aria-label="Perbesar peta">+</button>
            <button onClick={zoomOut} aria-label="Perkecil peta">−</button>
          </div>

          <svg
            viewBox="0 0 1000 460"
            style={{ transform: `scale(${scale})` }}
            role="img"
            aria-label="Peta persebaran gempa dan gunung api Indonesia"
          >
            <defs>
              <linearGradient id="ppbOceanGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16344a" />
                <stop offset="100%" stopColor="#0c1e2c" />
              </linearGradient>
              <pattern id="ppbGraticule" width="46" height="46" patternUnits="userSpaceOnUse">
                <path d="M46 0 L0 0 0 46" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="1" />
              </pattern>
            </defs>

            <rect x="0" y="0" width="1000" height="460" fill="url(#ppbOceanGrad)" />
            <rect x="0" y="0" width="1000" height="460" fill="url(#ppbGraticule)" />

            <g fill="var(--ppb-land)" stroke="var(--ppb-land-line)" strokeWidth="1.2">
              <path d="M40,205 C55,150 95,95 130,70 C150,55 168,70 160,92 C185,120 178,165 158,205 C170,235 165,270 140,300 C120,325 95,330 82,305 C60,300 45,270 48,245 C30,235 28,215 40,205 Z" />
              <path d="M205,345 C260,330 330,332 385,345 C420,352 430,365 405,372 C340,382 265,380 210,368 C190,362 188,352 205,345 Z" />
              <path d="M415,362 C428,356 440,362 436,372 C445,368 456,372 452,380 C462,376 474,380 468,388 C486,382 500,388 494,396 C512,390 528,396 520,404 C536,400 550,406 540,412 C520,414 500,410 480,404 C458,408 440,402 428,394 C412,392 402,382 408,372 C400,370 400,362 415,362 Z" />
              <path d="M300,120 C345,95 410,90 455,115 C490,135 495,175 470,205 C480,240 460,270 425,275 C395,290 355,285 335,258 C305,255 285,225 295,195 C270,180 275,140 300,120 Z" />
              <path d="M535,150 C555,130 578,128 585,150 C600,140 615,150 605,168 C625,175 632,198 612,208 C620,230 608,255 585,252 C580,272 560,285 548,268 C528,275 515,258 522,240 C505,232 502,210 518,198 C505,185 512,165 535,150 Z" />
              <path d="M642,160 C652,150 666,152 664,166 C676,162 684,174 674,182 C682,196 670,208 656,200 C644,210 632,200 638,186 C626,182 628,168 642,160 Z" />
              <path d="M690,205 C700,198 712,202 708,214 C718,212 724,224 712,230 C716,242 702,248 694,238 C682,240 680,226 690,205 Z" />
              <path d="M770,150 C830,130 900,140 945,175 C965,195 955,225 920,235 C935,260 915,285 880,278 C860,300 825,295 810,270 C780,268 760,240 770,210 C750,200 752,168 770,150 Z" />
            </g>

            <g fontFamily="Manrope,sans-serif" fontSize="10.5" fill="rgba(210,222,238,0.55)" fontWeight="600">
              <text x="150" y="248">Sumatra</text>
              <text x="222" y="358">Jakarta</text>
              <text x="330" y="360">Jawa Tengah</text>
              <text x="428" y="380">Denpasar</text>
              <text x="512" y="400">Kupang</text>
              <text x="355" y="160">Kalimantan</text>
              <text x="548" y="145">Manado</text>
              <text x="686" y="250">Ambon</text>
              <text x="835" y="195">Papua</text>
            </g>

            {/* Riwayat gempa M>=5 */}
            <g fill="var(--ppb-warn)">
              {QUAKE_MARKERS.map((m, i) => (
                <circle key={i} cx={m.x} cy={m.y} r="6">
                  <title>{m.label}</title>
                </circle>
              ))}
            </g>

            {/* Gempa terkini, pulsing */}
            <g transform={`translate(${QUAKE_RECENT_MARKER.x},${QUAKE_RECENT_MARKER.y})`}>
              <circle className="ppb-pulse-ring" r="7" />
              <circle r="7" fill="var(--ppb-danger)">
                <title>M{LATEST_QUAKE.magnitude} — TERKINI</title>
              </circle>
            </g>

            {/* Gunung api */}
            {VOLCANO_MARKERS.map((v, i) => (
              <path
                key={i}
                d={`M${v.x},${v.y - 12} L${v.x + 12},${v.y + 12} L${v.x - 12},${v.y + 12} Z`}
                fill={v.status === "AWAS" ? "var(--ppb-danger)" : "var(--ppb-warn)"}
              >
                <title>{v.label} — {v.status}</title>
              </path>
            ))}
          </svg>

          <div className="ppb-legend">
            <div className="ppb-legend-title">LEGENDA (INDONESIA)</div>
            <div className="ppb-legend-row"><span className="ppb-swatch ppb-circle" style={{ background: "var(--ppb-danger)" }} />Gempa Terkini</div>
            <div className="ppb-legend-row"><span className="ppb-swatch ppb-circle" style={{ background: "var(--ppb-warn)" }} />Riwayat Gempa M≥5</div>
            <div className="ppb-legend-row"><span className="ppb-swatch ppb-tri" style={{ borderBottomColor: "var(--ppb-danger)" }} />Gunung Api Awas</div>
            <div className="ppb-legend-row"><span className="ppb-swatch ppb-tri" style={{ borderBottomColor: "var(--ppb-warn)" }} />Gunung Api Siaga</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuakePanel({ latest, history }) {
  return (
    <section className="ppb-panel">
      <div className="ppb-panel-head">
        <div className="ppb-panel-title"><span className="ppb-ind" />Gempa Bumi (M ≥ 5.0)</div>
      </div>

      <div className="ppb-quake-highlight">
        <div className="ppb-quake-highlight-top">
          <div className="ppb-quake-mag">M {latest.magnitude}</div>
          <span className="ppb-badge ppb-badge-terkini">TERKINI</span>
        </div>
        <div className="ppb-quake-loc">{latest.location}</div>
        <div className="ppb-quake-meta">
          <span>🕒 {latest.time}</span>
          <span>Kedalaman: {latest.depthKm} km</span>
        </div>
        {latest.felt && (
          <div className="ppb-quake-warn">GEMPA INI DIRASAKAN, HARAP TETAP WASPADA</div>
        )}
      </div>

      <div className="ppb-list-label">RIWAYAT SEBELUMNYA</div>
      <div className="ppb-quake-list">
        {history.map((q, i) => (
          <div className="ppb-quake-item" key={i}>
            <div className="ppb-num">{q.mag}</div>
            <div className="ppb-txt">
              <b>{q.location}</b>
              <span>{q.time}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function VolcanoPanel({ volcanoes }) {
  return (
    <section className="ppb-panel">
      <div className="ppb-panel-head">
        <div className="ppb-panel-title"><span className="ppb-ind ppb-ind-warn" />Aktivitas Gunung Api</div>
      </div>
      <div className="ppb-volc-list">
        {volcanoes.map((v, i) => (
          <div className="ppb-volc-item" key={i}>
            <div>
              <div className="ppb-volc-name">{v.name}</div>
              <div className="ppb-volc-loc">{v.place}</div>
            </div>
            <span className={`ppb-badge ${v.status === "AWAS" ? "ppb-badge-awas" : "ppb-badge-siaga"}`}>
              {v.status}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function LiveClock() {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const format = () => {
      const now = new Date();
      const day = now.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
      const time = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
      setLabel(`${day} · ${time} WIB`);
    };
    format();
    const id = setInterval(format, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="ppb-clock">{label}</span>;
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export default function PusatPantauBencana() {
  return (
    <div className="ppb-root">
      <style>{CSS}</style>
      <div className="ppb-wrap">
        <header>
          <div className="ppb-eyebrow"><span className="ppb-dot" />Sistem aktif &middot; data diperbarui otomatis</div>
          <h1 className="ppb-h1">Pusat Pantau Bencana</h1>
          <p className="ppb-subtitle">Pemantauan iklim, geologi, dan cuaca terintegrasi waktu nyata untuk wilayah Indonesia.</p>
          <WeatherBanner weather={WEATHER} />
        </header>

        <div className="ppb-main-grid">
          <DisasterMap />
          <div className="ppb-side-stack">
            <QuakePanel latest={LATEST_QUAKE} history={QUAKE_HISTORY} />
            <VolcanoPanel volcanoes={VOLCANOES} />
          </div>
        </div>

        <footer className="ppb-footer">
          <span>Data bersifat ilustratif untuk keperluan tampilan &middot; sumber acuan: BMKG &amp; PVMBG (MAGMA Indonesia)</span>
          <LiveClock />
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles (CSS-in-JS via a plain <style> tag — no external stylesheet needed)
// ---------------------------------------------------------------------------

const CSS = `
.ppb-root{
  --ppb-bg:#060b15; --ppb-card:#0e1729; --ppb-line:rgba(148,163,184,0.10);
  --ppb-ocean:#122a3a; --ppb-land:#173a24; --ppb-land-line:rgba(120,180,140,0.28);
  --ppb-text:#e7edf6; --ppb-text-dim:#8996ab; --ppb-text-faint:#5c6980;
  --ppb-cyan:#3fd4f2; --ppb-blue:#5b8bf7;
  --ppb-grad:linear-gradient(90deg,#3fd4f2 0%,#5b8bf7 100%);
  --ppb-danger:#f0475a; --ppb-warn:#f7943c; --ppb-ok:#39c98d;
  font-family:'Manrope',system-ui,-apple-system,'Segoe UI',sans-serif;
  background:
    radial-gradient(1100px 620px at 12% -8%, rgba(63,212,242,0.10), transparent 60%),
    radial-gradient(900px 500px at 100% 0%, rgba(91,139,247,0.08), transparent 55%),
    var(--ppb-bg);
  color:var(--ppb-text); min-height:calc(100dvh - 60px);
}
.ppb-root *{box-sizing:border-box}
.ppb-wrap{max-width:1320px;margin:0 auto;padding:34px 28px 60px}
.ppb-eyebrow{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--ppb-text-dim);margin-bottom:10px}
.ppb-dot{width:7px;height:7px;border-radius:50%;background:var(--ppb-ok);box-shadow:0 0 0 4px rgba(57,201,141,.15)}
.ppb-h1{margin:0 0 8px;font-size:clamp(30px,4vw,44px);font-weight:800;letter-spacing:-0.02em;
  background:var(--ppb-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.ppb-subtitle{margin:0;color:var(--ppb-text-dim);font-size:16px;max-width:60ch}
.ppb-weather{margin-top:22px;background:var(--ppb-card);border:1px solid var(--ppb-line);border-radius:18px;
  padding:20px 26px;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap}
.ppb-weather-left{display:flex;align-items:center;gap:16px}
.ppb-weather-icon{width:58px;height:58px;border-radius:14px;background:linear-gradient(160deg,#2a2410,#14120a);
  display:flex;align-items:center;justify-content:center;font-size:28px;flex:none}
.ppb-weather-temp{font-size:26px;font-weight:800;letter-spacing:-.01em}
.ppb-weather-desc{color:var(--ppb-text-dim);font-weight:500}
.ppb-weather-loc{color:var(--ppb-cyan);font-size:14px;font-weight:600;margin-top:2px}
.ppb-weather-right{display:flex;gap:28px;flex-wrap:wrap}
.ppb-wstat{display:flex;align-items:center;gap:8px;color:var(--ppb-text-dim);font-size:14.5px}
.ppb-wstat b{color:var(--ppb-text);font-weight:700}
.ppb-main-grid{margin-top:22px;display:grid;grid-template-columns:1.6fr 1fr;gap:20px;align-items:start}
@media (max-width:920px){.ppb-main-grid{grid-template-columns:1fr}}
.ppb-panel{background:var(--ppb-card);border:1px solid var(--ppb-line);border-radius:18px;overflow:hidden}
.ppb-panel-head{display:flex;align-items:center;gap:10px;padding:18px 20px;border-bottom:1px solid var(--ppb-line)}
.ppb-panel-title{display:flex;align-items:center;gap:9px;font-weight:700;font-size:16px}
.ppb-ind{width:8px;height:8px;border-radius:50%;background:var(--ppb-danger);flex:none;box-shadow:0 0 0 4px rgba(240,71,90,.15)}
.ppb-ind-warn{background:var(--ppb-warn);box-shadow:0 0 0 4px rgba(247,148,60,.15)}
.ppb-map-frame{position:relative;height:520px;overflow:hidden;background:var(--ppb-ocean)}
.ppb-map-frame svg{width:100%;height:100%;display:block;transition:transform .25s ease}
.ppb-map-ctrl{position:absolute;top:14px;left:14px;z-index:3;display:flex;flex-direction:column;
  background:#0b1220;border:1px solid var(--ppb-line);border-radius:8px;overflow:hidden}
.ppb-map-ctrl button{width:34px;height:34px;border:none;background:transparent;color:var(--ppb-text);
  font-size:17px;cursor:pointer;line-height:1}
.ppb-map-ctrl button:first-child{border-bottom:1px solid var(--ppb-line)}
.ppb-map-ctrl button:hover{background:rgba(255,255,255,.06)}
.ppb-legend{position:absolute;right:14px;bottom:14px;z-index:3;background:rgba(10,16,28,0.92);
  border:1px solid var(--ppb-line);border-radius:10px;padding:12px 14px;font-size:12px;color:var(--ppb-text-dim);
  min-width:172px}
.ppb-legend-title{color:var(--ppb-cyan);font-weight:700;letter-spacing:.03em;font-size:10.5px;margin-bottom:8px}
.ppb-legend-row{display:flex;align-items:center;gap:8px;margin:5px 0}
.ppb-swatch{width:11px;height:11px;flex:none;display:inline-block}
.ppb-circle{border-radius:50%}
.ppb-tri{width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:10px solid;background:none !important}
.ppb-pulse-ring{fill:none;stroke:var(--ppb-danger);stroke-width:2;transform-origin:center;animation:ppbPulse 2.2s ease-out infinite}
@keyframes ppbPulse{0%{transform:scale(.5);opacity:.9}80%{transform:scale(2.6);opacity:0}100%{transform:scale(2.6);opacity:0}}
@media (prefers-reduced-motion:reduce){.ppb-pulse-ring{animation:none;opacity:0}}
.ppb-side-stack{display:flex;flex-direction:column;gap:20px}
.ppb-badge{font-size:11px;font-weight:800;letter-spacing:.04em;padding:5px 11px;border-radius:999px;flex:none}
.ppb-badge-terkini,.ppb-badge-awas{background:var(--ppb-danger);color:#fff}
.ppb-badge-siaga{background:var(--ppb-warn);color:#1a1204}
.ppb-quake-highlight{margin:16px;padding:16px;border-radius:12px;
  background:linear-gradient(180deg, rgba(240,71,90,.14), rgba(240,71,90,.05));border:1px solid rgba(240,71,90,.35)}
.ppb-quake-highlight-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.ppb-quake-mag{font-size:26px;font-weight:800;color:var(--ppb-danger);font-family:ui-monospace,monospace}
.ppb-quake-loc{margin:8px 0 10px;font-weight:600;line-height:1.4;font-size:14.5px}
.ppb-quake-meta{display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:var(--ppb-text-dim)}
.ppb-quake-warn{margin-top:10px;font-size:12px;font-weight:800;color:var(--ppb-danger)}
.ppb-list-label{padding:2px 16px 8px;font-size:11px;letter-spacing:.06em;color:var(--ppb-text-faint);font-weight:700}
.ppb-quake-list,.ppb-volc-list{max-height:260px;overflow-y:auto;padding:0 8px 10px}
.ppb-quake-item{display:flex;gap:12px;align-items:flex-start;padding:11px 10px;border-radius:10px}
.ppb-quake-item:hover{background:rgba(255,255,255,.03)}
.ppb-num{width:34px;height:34px;border-radius:50%;flex:none;background:#3a2510;color:var(--ppb-warn);
  font-family:ui-monospace,monospace;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center}
.ppb-txt b{font-size:13.5px;font-weight:600;display:block;line-height:1.35}
.ppb-txt span{font-size:11.5px;color:var(--ppb-text-faint)}
.ppb-volc-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px;margin:2px 8px;
  border-radius:10px;border:1px solid transparent}
.ppb-volc-item:hover{background:rgba(255,255,255,.03);border-color:var(--ppb-line)}
.ppb-volc-name{font-weight:700;font-size:14px}
.ppb-volc-loc{font-size:12px;color:var(--ppb-text-faint);margin-top:2px}
.ppb-footer{margin-top:26px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;
  color:var(--ppb-text-faint);font-size:12px;padding:0 4px}
.ppb-clock{color:var(--ppb-text-dim);font-family:ui-monospace,monospace}
`;
