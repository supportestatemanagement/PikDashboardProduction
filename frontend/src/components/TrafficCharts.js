"use client";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

// Raw hourly data (net vehicles entering PIK)
const BASE_HOURLY = [
  -131, -108, -136, -74, 20, 233, 415, 556, 517, 86, 40, 20,
  10, 5, 8, 12, 30, 55, 40, 25, 15, 10, 8, 5
];

const GATES_IN = [
  { name: "IN BGM JORR W2", value: 4200, color: "#3B82F6" },
  { name: "ANPR IN BGM MARINA", value: 3400, color: "#8B5CF6" },
  { name: "IN BGM Soedyatmo", value: 2600, color: "#10B981" },
  { name: "KATARAJA IN PIK2", value: 290, color: "#06B6D4" },
];

const GATES_OUT = [
  { name: "ANPR OUT BGM MARINA", value: 3300, color: "#EC4899" },
  { name: "ANPR Out BGM JORR", value: 3200, color: "#F59E0B" },
  { name: "ANPR Out BGM Daikot", value: 2000, color: "#EF4444" },
  { name: "KATARAJA OUT PIK2", value: 545, color: "#06B6D4" },
  { name: "ANPR OUT Congker", value: 170, color: "#10B981" },
];

const GATE_PIE = [
  { name: "IN BGM_Toll JORR W2", pct: 21.5, color: "#3B82F6" },
  { name: "ANPR IN BGM MARINA", pct: 17.1, color: "#8B5CF6" },
  { name: "ANPR OUT BGM M...", pct: 16.8, color: "#EC4899" },
  { name: "ANPR Out BGM_Tol...", pct: 16.1, color: "#F59E0B" },
  { name: "IN BGM_Toll Soedya...", pct: 13.2, color: "#10B981" },
  { name: "ANPR Out BGM_Toll...", pct: 10.1, color: "#06B6D4" },
  { name: "TOLL KATARAJA IN...", pct: 3.5, color: "#F97316" },
  { name: "ANPR OUT BGM_C...", pct: 1.7, color: "#84CC16" },
];

function LineChart({ hourly }) {
  const W = 820, H = 240, PL = 45, PR = 20, PT = 20, PB = 40;
  const cW = W - PL - PR, cH = H - PT - PB;
  const min = Math.min(...hourly) - 30;
  const max = Math.max(...hourly) + 30;
  const range = max - min;
  const xStep = cW / 23;
  const toX = i => PL + i * xStep;
  const toY = v => PT + cH - ((v - min) / range) * cH;
  const points = hourly.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
  const areaPath = `M${toX(0)},${toY(hourly[0])} ` +
    hourly.map((v, i) => `L${toX(i)},${toY(v)}`).join(" ") +
    ` L${toX(23)},${toY(min)} L${toX(0)},${toY(min)} Z`;
  const zero = toY(0);
  const gridVals = [-200, -100, 0, 100, 200, 300, 400, 500, 600];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" style={{ width: "100%", height: "240px" }}>
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Grid */}
      {gridVals.map(v => {
        const y = toY(v);
        if (y < PT || y > PT + cH) return null;
        return (
          <g key={v}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#E2E8F0" strokeWidth="1" />
            <text x={PL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94A3B8">{v}</text>
          </g>
        );
      })}
      {/* Zero line */}
      <line x1={PL} y1={zero} x2={W - PR} y2={zero} stroke="rgba(30,58,138,0.2)" strokeWidth="1.5" strokeDasharray="4,3" />

      {/* Area fill */}
      <path d={areaPath} fill="url(#lineGrad)" />

      {/* Line */}
      <polyline points={points} fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinejoin="round" />

      {/* Data points + labels for notable ones */}
      {hourly.map((v, i) => {
        const showLabel = [0,1,2,3,4,5,6,7,8,9].includes(i);
        return (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(v)} r={showLabel ? 4 : 2.5}
              fill={v < 0 ? "#EF4444" : "#3B82F6"}
              stroke="#fff" strokeWidth="1.5" />
            {showLabel && (
              <text x={toX(i)} y={toY(v) + (v < 0 ? 14 : -8)}
                textAnchor="middle" 
                style={{ fill: v < 0 ? "#EF4444" : "#1E3A8A", fontSize: 9, fontWeight: 600 }}>
                {v}
              </text>
            )}
          </g>
        );
      })}

      {/* X Axis */}
      {HOURS.map((h, i) => (
        <text key={h} x={toX(i)} y={H - 4} textAnchor="middle" fontSize="10" fill="#94A3B8">{h}</text>
      ))}
    </svg>
  );
}

function DonutChart({ inPct, outPct }) {
  const cx = 90, cy = 90, r = 65, strokeW = 26;
  const circ = 2 * Math.PI * r;
  const inDash = (inPct / 100) * circ;
  const outDash = (outPct / 100) * circ;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg viewBox="0 0 180 180" style={{ width: 180, height: 180 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EEF2F7" strokeWidth={strokeW} />
        {/* OUT arc */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EC4899" strokeWidth={strokeW}
          strokeDasharray={`${outDash} ${circ}`}
          strokeDashoffset={-(inDash)}
          strokeLinecap="butt"
          transform={`rotate(-90 ${cx} ${cy})`} />
        {/* IN arc */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#06B6D4" strokeWidth={strokeW}
          strokeDasharray={`${inDash} ${circ}`}
          strokeDashoffset={0}
          strokeLinecap="butt"
          transform={`rotate(-90 ${cx} ${cy})`} />
        {/* Center text */}
        <text x={cx} y={cy - 6} textAnchor="middle" style={{ fill: "#1E3A8A", fontSize: 11, fontWeight: 700, fontFamily: "'Rajdhani',sans-serif" }}>IN</text>
        <text x={cx} y={cy + 10} textAnchor="middle" style={{ fill: "#06B6D4", fontSize: 18, fontWeight: 800, fontFamily: "'Rajdhani',sans-serif" }}>{inPct}%</text>
        {/* Labels on arcs */}
        <text x={cx + 50} y={cy - 18} textAnchor="middle" style={{ fill: "#94A3B8", fontSize: 9, fontFamily: "Inter" }}>{outPct}%</text>
      </svg>

      <div style={{ display: "flex", gap: "16px", marginTop: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#06B6D4" }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>IN</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#06B6D4" }}>{inPct}%</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#EC4899" }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>OUT</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#EC4899" }}>{outPct}%</span>
        </div>
      </div>
    </div>
  );
}

function BarSection({ title, total, gates, totalColor }) {
  const max = Math.max(...gates.map(g => g.value));
  return (
    <div style={{ background: "white", padding: "16px", borderRadius: "12px", border: "1px solid #E2E8F0", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: "12px", fontWeight: "800", color: "#1E3A8A", letterSpacing: "0.5px" }}>{title}</div>
        <div style={{
          background: totalColor, color: "#fff",
          borderRadius: 8, padding: "4px 14px",
          fontFamily: "'Rajdhani',sans-serif", fontSize: 16, fontWeight: 700
        }}>{total.toLocaleString("id-ID")}</div>
      </div>
      {gates.map(g => {
        const pct = (g.value / max) * 100;
        const label = g.value >= 1000 ? (g.value / 1000).toFixed(1) + " rb" : String(g.value);
        return (
          <div key={g.name} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>{g.name}</span>
              <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 14, fontWeight: 700, color: g.color }}>{label}</span>
            </div>
            <div style={{ height: 6, background: "#EEF2F7", borderRadius: 3 }}>
              <div style={{
                height: "100%", width: `${pct}%`, background: g.color, borderRadius: 3,
                transition: "width 0.6s ease"
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GatePieChart() {
  const cx = 70, cy = 70, r = 52, strokeW = 22;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const slices = GATE_PIE.map(g => {
    const dash = (g.pct / 100) * circ;
    const s = { ...g, dash, offset };
    offset += dash;
    return s;
  });

  return (
    <div style={{ background: "white", padding: "16px", borderRadius: "12px", border: "1px solid #E2E8F0", minWidth: 0 }}>
      <div style={{ fontSize: "12px", fontWeight: "800", color: "#1E3A8A", letterSpacing: "0.5px", marginBottom: 12 }}>KONTRIBUSI GATE MASUK & KELUAR</div>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "center" }}>
        <svg viewBox="0 0 140 140" style={{ width: 140, height: 140, flexShrink: 0 }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EEF2F7" strokeWidth={strokeW} />
          {slices.map(s => (
            <circle key={s.name} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={strokeW}
              strokeDasharray={`${s.dash} ${circ - s.dash}`}
              strokeDashoffset={-s.offset}
              transform={`rotate(-90 ${cx} ${cy})`} />
          ))}
          <text x={cx} y={cy - 5} textAnchor="middle" style={{ fill: "#94A3B8", fontSize: 10 }}>Total</text>
          <text x={cx} y={cy + 10} textAnchor="middle" style={{ fill: "#1E3A8A", fontSize: 12, fontWeight: 700 }}>Gate</text>
        </svg>
        <div style={{ flex: 1, minWidth: "140px" }}>
          {GATE_PIE.map(g => (
            <div key={g.name} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: g.color, flexShrink: 0 }} />
              <span style={{ fontSize: 9, color: "#4B5563", flex: 1, lineHeight: 1.2, fontWeight: 600 }}>{g.pct}% {g.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TrafficCharts({ data }) {
  const hourly = BASE_HOURLY.map((v, i) => {
    const delta = Math.round((data.totalVehicles - 1319) / 10);
    return i >= 5 && i <= 9 ? v + delta : v;
  });

  const totalIn = data.totalIn;
  const totalOut = data.totalOut;
  const inPct = parseFloat(((totalIn / (totalIn + totalOut)) * 100).toFixed(1));
  const outPct = parseFloat((100 - inPct).toFixed(1));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Line + Donut row (Grid Responsif Auto-Fit) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
        
        {/* Line Chart Card */}
        <div style={{ background: "white", padding: "20px", borderRadius: "12px", border: "1px solid #E2E8F0", minWidth: 0 }}>
          <div style={{ fontSize: "14px", fontWeight: "800", color: "#1E3A8A", letterSpacing: "0.5px" }}>KEPADATAN LALU LINTAS PER JAM</div>
          <div style={{ fontSize: "11px", color: "#64748B", display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px", marginTop: "6px" }}>
            <span style={{ display: "inline-block", width: 24, height: 3, background: "#3B82F6", borderRadius: 2 }} />
            Total Kendaraan
          </div>
          <div style={{ width: "100%", overflowX: "auto" }}>
            <div style={{ minWidth: "500px" }}> 
              <LineChart hourly={hourly} />
            </div>
          </div>
        </div>

        {/* Donut Chart Card */}
        <div style={{ background: "white", padding: "20px", borderRadius: "12px", border: "1px solid #E2E8F0", display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }}>
          <div style={{ fontSize: "14px", fontWeight: "800", color: "#1E3A8A", width: "100%", textAlign: "left", letterSpacing: "0.5px" }}>PRESENTASE KETIMPANGAN ARUS</div>
          <div style={{ marginTop: "24px", width: "100%", display: "flex", justifyContent: "center", flex: 1, alignItems: "center" }}>
            <DonutChart inPct={inPct} outPct={outPct} />
          </div>
        </div>
      </div>

      {/* Bar + Pie row (Grid Responsif Auto-Fit) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
        <BarSection title="TOTAL KENDARAAN MASUK" total={totalIn} gates={GATES_IN} totalColor="#06B6D4" />
        <BarSection title="TOTAL KENDARAAN KELUAR" total={totalOut} gates={GATES_OUT} totalColor="#EC4899" />
        <GatePieChart />
      </div>
    </div>
  );
}