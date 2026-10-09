"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from 'react-dom';
import { cameraMetrics } from './cctvMetrics';
import CctvGroupMap from './CctvGroupMap';

const offlineAreaNames = {
  BGM: "Bukit Golf Mediterania",
  GI: "Golf Island",
  RWI: "Riverwalk Island",
  PIK2: "Toll Kataraja",
};

function offlineProgress(camera) {
  return String(camera.Progress ?? '').trim() || '—';
}

export default function CctvDashboard() {
  const [datasets, setDatasets] = useState({ pik1: null, pik2: null });
  const [errors, setErrors] = useState({});
  const [selection, setSelection] = useState({ trend: 'pik1', brand: 'pik1', area: 'pik1', condition: 'pik1' });
  const [hoveredPoint, setHoveredPoint] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    [['pik1', '/api/cctv-growth-data'], ['pik2', '/api/cctv-pik2-data']].forEach(([key, endpoint]) => {
      fetch(`${process.env.REACT_APP_API_URL || ''}${endpoint}`, { signal: controller.signal })
        .then(response => response.json()).then(result => {
          if (result.status !== 'success') throw new Error('Gagal memuat CCTV');
          setDatasets(previous => ({ ...previous, [key]: result.data }));
        }).catch(error => { if (error.name !== 'AbortError') setErrors(previous => ({ ...previous, [key]: true })); });
    });
    return () => controller.abort();
  }, []);
  const metrics = useMemo(() => ({ pik1: cameraMetrics(datasets.pik1 || []), pik2: cameraMetrics(datasets.pik2 || [], true) }), [datasets]);
  const trendData = metrics[selection.trend].trend;
  const brandData = metrics[selection.brand].brands;
  const areaData = metrics[selection.area].areas;
  const conditionData = metrics[selection.condition].condition;
  const totalCctv = datasets.pik1 && datasets.pik2 ? metrics.pik1.total + metrics.pik2.total : null;
  const offlineData = datasets.pik1 ? metrics.pik1.offline : null;
  const loadError = errors.pik1;
  const locationData = [], distData = {};
  const choice = key => <div className="cctv-choice" role="group" aria-label={`Pilihan PIK ${key}`}>{['pik1', 'pik2'].map(value => <button key={value} type="button" aria-pressed={selection[key] === value} onClick={() => { setSelection(previous => ({ ...previous, [key]: value })); setHoveredPoint(null); }}>{value === 'pik1' ? 'PIK 1' : 'PIK 2'}</button>)}</div>;

  // --- Kalkulasi Koordinat Dinamis untuk SVG Trend ---
  const chartWidth = 800;
  const chartHeight = 180;
  const padding = { top: 30, right: 20, bottom: 30, left: 40 }; 
  
  const maxDataCount = trendData.length > 0 ? Math.max(...trendData.map((d) => d.count)) : 10;
  const maxY = Math.ceil(maxDataCount * 1.1);

  const svgPoints = trendData.map((d, index) => {
    const x = padding.left + (index * (chartWidth - padding.left - padding.right)) / (trendData.length > 1 ? trendData.length - 1 : 1);
    const y = chartHeight - padding.bottom - (d.count * (chartHeight - padding.top - padding.bottom)) / maxY;
    return { ...d, x, y };
  });

  const linePath = svgPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = svgPoints.length > 0 
    ? `${linePath} L ${svgPoints[svgPoints.length - 1].x} ${chartHeight - padding.bottom} L ${svgPoints[0].x} ${chartHeight - padding.bottom} Z` 
    : "";


  // --- Format Data Untuk Grafik Baris Ke-2 & Ke-3 ---
  const maxBrandCount = brandData.length > 0 ? Math.ceil(brandData[0].count * 1.2) : 100;
  const brandColors = ["#06B6D4", "#EC4899", "#8B5CF6", "#F59E0B"]; 

  const areaColors = ["#06B6D4", "#3B82F6", "#8B5CF6", "#EC4899"]; 
  const areaChartData = areaData.slice(0, 4).map((item, idx) => ({
    label: item.label,
    val: item.count,
    color: areaColors[idx % areaColors.length]
  }));

  // PERUBAHAN WARNA UNTUK KONDISI (ON: Hijau, OFF: Merah)
  const conditionChartData = [
    { label: "ON", val: conditionData.on, color: "#10B981" },
    { label: "OFF", val: conditionData.off, color: "#EF4444" }
  ];

  const locColors = ["#EC4899", "#06B6D4", "#8B5CF6", "#F59E0B", "#3B82F6"];
  const maxLocCount = locationData.length > 0 ? locationData[0].count : 100;

  // 1. MAPPING WARNA KONSISTEN
  const locColorMap = {};
  locationData.slice(0, 5).forEach((loc, idx) => {
    locColorMap[loc.label] = locColors[idx % locColors.length];
  });

  // 2. Format data Grouped Bar Chart
  let maxDistCount = 10;
  const groupedDistData = Object.entries(distData).slice(0, 5).map(([area, locs]) => {
    const vals = Object.entries(locs).map(([loc, count]) => {
      if (count > maxDistCount) maxDistCount = count;
      return {
        val: count,
        color: locColorMap[loc] || "#CBD5E1", 
        title: `${loc}: ${count} Unit`
      };
    });
    return { label: area, vals };
  });

  // 3. Komponen Legend di pojok kanan atas
  const distributionLegend = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
      {locationData.slice(0, 5).map((loc, idx) => (
        <div key={idx} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <div style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: locColorMap[loc.label] }} />
          <span style={{ fontSize: "10px", fontWeight: "700", color: "#64748B", textTransform: "capitalize" }}>
            {loc.label}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* MENAMBAHKAN STYLE GLOBAL UNTUK ANIMASI */}
      <style>{`
        @keyframes slideFadeIn {
          0% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-card {
          animation: slideFadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0; /* Awal tersembunyi sebelum animasi selesai */
        }
        .cctv-panel-container { container-type: inline-size; }
        .cctv-panels { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 20px; }
        .cctv-panels > div { min-width: 0; }
        .cctv-locations { grid-area: 2 / 5 / 3 / 7; }
        .cctv-offline { grid-area: 2 / 1 / 3 / 7; }
        .cctv-brand { grid-area: 1 / 3 / 2 / 5; }
        .cctv-area { grid-area: 1 / 5 / 2 / 7; }
        .cctv-condition { grid-area: 1 / 1 / 2 / 3; }
        .cctv-offline-pik2 { grid-area: 3 / 1 / 4 / 7; }
        .cctv-pik2-table { min-width: 800px; }
        .cctv-choice { display:flex; gap:4px; margin-top:6px; }
        .cctv-total-breakdown { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; width:min(100%,320px); margin:16px 0 0; }
        .cctv-total-breakdown > div { padding:10px 18px; border:1px solid rgba(255,255,255,.18); border-radius:8px; background:rgba(255,255,255,.06); text-align:center; }
        .cctv-total-breakdown dt { font-size:10px; font-weight:600; letter-spacing:1px; color:#CBD5F5; }
        .cctv-total-breakdown dd { margin:4px 0 0; font-size:22px; line-height:1.2; font-weight:700; color:white; font-variant-numeric:tabular-nums; }
        .cctv-choice button { border:1px solid #CBD5E1; border-radius:5px; padding:4px 8px; font-size:10px; background:#F8FAFC; color:#475569; cursor:pointer; }
        .cctv-choice button[aria-pressed="true"] { background:#1E3A8A; color:white; border-color:#1E3A8A; }
        .cctv-panels > [hidden] { display:none !important; }
        .cctv-distribution { grid-area: 3 / 1 / 4 / 7; }
        .cctv-offline-areas { height: 100%; box-sizing: border-box; overflow: auto; border: 1px solid #D5DFEA; border-radius: 10px; background: #FFFFFF; scrollbar-color: #64748B #EDF2F7; }
        .cctv-offline-table { width: 100%; min-width: 1400px; table-layout: fixed; border-collapse: separate; border-spacing: 0; }
        .cctv-offline-table th { padding: 12px 10px; background: #203B5C; color: #F8FAFC; font-size: 11px; font-weight: 800; text-align: left; border-bottom: 1px solid #314E70; }
        .cctv-offline-table th { position: sticky; top: 0; z-index: 1; }
        .cctv-offline-table th + th { border-left: 1px solid #314E70; }
        .cctv-offline-table td + td { border-left: 1px solid #D5DFEA; }
        .cctv-offline-table td { padding: 0; vertical-align: top; }
        .cctv-offline-count { display: inline-block; margin-left: 4px; padding: 1px 5px; border-radius: 12px; background: #385575; color: #F1F5F9; font-size: 10px; white-space: nowrap; }
        .cctv-offline-list { font-size: 12px; line-height: 1.6; color: #475569; }
        .cctv-offline-list ul { list-style: none; margin: 0; padding: 0; }
        .cctv-offline-list li { padding: 9px 12px; overflow-wrap: anywhere; border-bottom: 1px solid #E7EDF4; background: #FFFFFF; color: #334155; }
        .cctv-offline-list li:nth-child(even) { background: #F3F6FA; }
        .cctv-offline-list li:hover { background: #EAF1F8; }
        .cctv-offline-list li,.cctv-offline-detail-head { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12px; }
        .cctv-offline-detail-head { padding: 6px 10px; font-size: 9px; line-height: 1.4; gap: 8px; font-weight: 700; background: #E8EEF5; color: #294461; border-bottom: 1px solid #D5DFEA; }
        .cctv-expand-button { display: inline-flex; align-items: center; justify-content: center; min-height: 32px; padding: 6px 10px; border: 1px solid #CBD5E1; border-radius: 7px; background: white; color: #1E3A8A; cursor: pointer; }
        .cctv-offline-dialog { position: fixed; inset: 0; margin: auto; box-sizing: border-box; width: min(94vw,1600px); max-width: 94vw; height: min(88dvh,900px); max-height: 92dvh; padding: 20px; border: 0; border-radius: 16px; box-shadow: 0 24px 90px #132e5555; background: white; color: #475569; }
        .cctv-offline-dialog::backdrop { background: #13243db3; backdrop-filter: blur(3px); }
        .cctv-offline-dialog-content { display: flex; flex-direction: column; gap: 16px; height: 100%; min-height: 0; }
        .cctv-offline-dialog-heading { display: flex; justify-content: space-between; align-items: center; color: #1E3A8A; }
        .cctv-offline-dialog-heading h2 { margin: 0; font-size: 18px; }
        .cctv-offline-dialog-body { flex: 1; min-height: 0; }
        .cctv-offline-list p { margin: 0; padding: 12px; color: #64748B; }
        @container (max-width: 700px) {
          .cctv-panels { display: flex; flex-direction: column; }
          .cctv-condition { order: 0; }
          .cctv-brand { order: 1; }
          .cctv-area { order: 2; }
          .cctv-offline { order: 3; }
          .cctv-offline-pik2 { order: 4; }
          .cctv-locations { order: 4; }
          .cctv-distribution { order: 5; }
        }
      `}</style>

      <div style={{ 
        padding: "2px", 
        display: "flex", 
        flexDirection: "column", 
        gap: "20px", 
        background: "#F1F5F9", 
        minHeight: "100vh",
        color: "#1E3A8A", 
        fontFamily: "Inter, sans-serif"
      }}>
        
        {/* BARIS 1: TREND & TOTAL - Diubah ke auto-fit untuk responsivitas */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
          
          {/* Card 1: Animasi dengan delay 0s */}
          <div className="animate-card" style={{ 
            animationDelay: "0s",
            background: "white", 
            padding: "20px 24px", 
            borderRadius: "12px", 
            border: "2px solid #E2E8F0", 
            position: "relative", 
            minWidth: 0,
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <div style={{ fontWeight: "800", fontSize: "14px", color: "#1E3A8A" }}>Yearly CCTV Installations{choice("trend")}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: "700", color: "#64748B" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#3B82F6" }} /> Units Installed
              </div>
            </div>

            <div style={{ width: "100%", position: "relative" }}> 
              <svg 
                width="100%" 
                height={chartHeight} 
                viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
                preserveAspectRatio="none"
                style={{ overflow: "visible" }}
              >
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const val = Math.round(maxY * ratio);
                  const y = chartHeight - padding.bottom - (ratio * (chartHeight - padding.top - padding.bottom));
                  return (
                    <g key={ratio}>
                      <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke="#F1F5F9" strokeWidth="1" />
                      {val !== 0 && <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#94A3B8" fontWeight="600">{val}</text>}
                    </g>
                  );
                })}
                
                {trendData.length > 0 && (
                  <>
                    <path d={areaPath} fill="rgba(59, 130, 246, 0.1)" />
                    <path d={linePath} fill="none" stroke="#3B82F6" strokeWidth="2.5" />
                    
                    {svgPoints.map((p, i) => (
                      <g key={i}>
                        {hoveredPoint?.year === p.year && (
                          <line x1={p.x} y1={padding.top} x2={p.x} y2={chartHeight - padding.bottom} stroke="#3B82F6" strokeWidth="1" strokeDasharray="4" />
                        )}
                        <circle cx={p.x} cy={p.y} r="4" fill="#3B82F6" stroke="white" strokeWidth="2" />
                        <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="11" fontWeight="800" fill="#3B82F6">{p.count}</text>

                        <circle 
                          cx={p.x} cy={p.y} r="15" 
                          fill="transparent" 
                          style={{ cursor: "pointer" }}
                          onMouseEnter={() => setHoveredPoint(p)}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                        <text 
                          x={p.x} 
                          y={chartHeight - padding.bottom + 15} 
                          fontSize="10" 
                          fill="#64748B" 
                          fontWeight="700" 
                          textAnchor="middle"
                        >
                          {p.year}
                        </text>
                      </g>
                    ))}
                  </>
                )}
              </svg>

              {hoveredPoint && (
                <div style={{
                  position: "absolute",
                  top: `calc(${(hoveredPoint.y / chartHeight) * 100}% - 80px)`, 
                  left: `calc(${(hoveredPoint.x / chartWidth) * 100}% - 60px)`,
                  background: "white",
                  padding: "10px",
                  borderRadius: "8px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                  border: "1px solid #E2E8F0",
                  zIndex: 100,
                  pointerEvents: "none",
                  minWidth: "120px"
                }}>
                  <div style={{ fontSize: "11px", fontWeight: "bold", color: "#1E293B", marginBottom: "4px" }}>
                    Year {hoveredPoint.year}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3B82F6" }} />
                    <span style={{ color: "#3b3b3b", flex: 1 }}>Units Installed</span>
                    <span style={{ fontWeight: "bold", color: "#1E293B" }}>{hoveredPoint.count}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Animasi dengan delay 0.1s */}
          <div className="animate-card" style={{ 
            animationDelay: "0.1s",
            background: "#1E3A8A", 
            color: "white",
            padding: "20px 24px",
            borderRadius: "12px", 
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)", 
            display: "flex", 
            flexDirection: "column",
            minWidth: 0
          }}>
            <div style={{ fontWeight: "800", fontSize: "14px", color: "white", marginBottom: "10px" }}> 
              Total CCTV
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
              <div style={{ fontSize: "68px", fontWeight: "800", fontFamily: "'Rajdhani', sans-serif", lineHeight: "1" }}> 
                {errors.pik1 || errors.pik2 ? "—" : totalCctv ?? "..."}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.8, letterSpacing: "2px", marginTop: "5px" }}>UNITS INSTALLED</div> 
              {datasets.pik1 && datasets.pik2 ? <dl className="cctv-total-breakdown" aria-label="Jumlah CCTV per wilayah"><div><dt>PIK 1</dt><dd>{metrics.pik1.total.toLocaleString('id-ID')}</dd></div><div><dt>PIK 2</dt><dd>{metrics.pik2.total.toLocaleString('id-ID')}</dd></div></dl> : <div style={{ fontSize: 11, marginTop: 8 }}>{errors.pik1 || errors.pik2 ? 'Gagal memuat total CCTV.' : 'Memuat kedua sheet…'}</div>}
              <div style={{ marginTop: "15px", display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", fontWeight: "600" }}> 
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10B981", animation: "pulse 2s infinite" }}></span>
                  Live Update
              </div>
            </div>
          </div>
        </div>

        <div className="cctv-panel-container">
        <div className="cctv-panels">
          <CctvGroupMap records={datasets.pik1 || []} />
          
          {/* Card 3: Animasi dengan delay 0.2s */}
          <div className="animate-card cctv-brand" style={{ animationDelay: "0.2s" }}>
            <ChartBox title="Total CCTV by Brand" headerRight={choice("brand")}>
              <div style={{ display: "flex", flexDirection: "column", gap: "18px", height: "100%", justifyContent: "center" }}>
                {brandData.length === 0 && <div style={{ fontSize: "12px", color: "#94A3B8", textAlign: "center" }}>Memuat data...</div>}
                {brandData.slice(0, 4).map((item, idx) => (
                  <ProgressBar 
                    key={idx}
                    label={item.label} 
                    val={item.count} 
                    max={maxBrandCount} 
                    color={brandColors[idx % brandColors.length]} 
                  />
                ))}
              </div>
            </ChartBox>
          </div>

          {/* Card 4: Animasi dengan delay 0.3s */}
          <div className="animate-card cctv-area" style={{ animationDelay: "0.3s" }}>
            <ChartBox title="Total CCTV per Area" headerRight={choice("area")}>
              <div style={{ width: "100%", height: "100%" }}>
                <BarChartWithGrid data={areaChartData} />
              </div>
            </ChartBox>
          </div>

          {/* Card 5: Animasi dengan delay 0.4s */}
          <div className="animate-card cctv-condition" style={{ animationDelay: "0.4s" }}>
            <ChartBox title="Total CCTV by Condition" headerRight={choice("condition")}>
              <div style={{ width: "100%", height: "100%" }}>
                {errors[selection.condition] ? <p>Gagal memuat data CCTV.</p> : !datasets[selection.condition] ? <p>Memuat data...</p> : <BarChartWithGrid data={conditionChartData} />}
              </div>
            </ChartBox>
          </div>

          {/* Card 6: Animasi dengan delay 0.5s */}
          <div hidden className="animate-card cctv-locations" style={{ animationDelay: "0.2s" }}>
            <ChartBox title="Total CCTV by Locations">
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", height: "100%", justifyContent: "center" }}>
                {locationData.length === 0 && <div style={{ fontSize: "12px", color: "#94A3B8", textAlign: "center" }}>Memuat data...</div>}
                {locationData.slice(0, 5).map((item, idx) => (
                    <ProgressBar 
                      key={idx} 
                      label={item.label} 
                      val={item.count} 
                      max={maxLocCount} 
                      color={locColorMap[item.label]} 
                    />
                ))}
              </div>
            </ChartBox>
          </div>

          <div className="animate-card cctv-offline" style={{ animationDelay: "0.3s" }}>
            <OfflineCard title="CCTV Offline PIK 1">
              <div className="cctv-offline-areas" tabIndex={0} role="region" aria-label="Daftar CCTV offline per area">
                {loadError ? <p role="alert">Gagal memuat data CCTV offline.</p> : !offlineData ? <p role="status">Memuat data...</p> :
                  <table className="cctv-offline-table" aria-label="CCTV offline menurut area">
                    <thead><tr>{Object.entries(offlineData).map(([area, cameras]) => (
                      <th key={area} id={`offline-area-${area}`} scope="col">
                        {offlineAreaNames[area]} <span className="cctv-offline-count">({cameras.length})</span>
                      </th>
                    ))}</tr></thead>
                    <tbody><tr>{Object.entries(offlineData).map(([area, cameras]) => (
                    <td key={area} aria-labelledby={`offline-area-${area}`}>
                      <div className="cctv-offline-list">
                        {cameras.length === 0 ? <p>Tidak ada CCTV offline.</p> : (
                          <><div className="cctv-offline-detail-head"><span>CCTV</span><span>Detail</span><span>Progress</span></div><ul>{cameras.map((camera, index) => (
                            <li key={index}><span>{String(camera["Nama Pada Layar (OSD)"] ?? "").trim() || "—"}</span><span>{String(camera["Detail"] ?? "").trim() || "—"}</span><span>{offlineProgress(camera)}</span></li>
                          ))}</ul></>
                        )}
                      </div>
                    </td>
                    ))}</tr></tbody>
                  </table>}
              </div>
            </OfflineCard>
          </div>

          <div className="animate-card cctv-offline-pik2">
            <OfflineCard title="CCTV Offline PIK 2">
              <div className="cctv-offline-areas" tabIndex={0} role="region" aria-label="Daftar CCTV offline PIK 2">
                {errors.pik2 ? <p role="alert">Gagal memuat CCTV PIK 2.</p> : !datasets.pik2 ? <p role="status">Memuat data...</p> : <table className="cctv-offline-table cctv-pik2-table" aria-label="CCTV offline PIK 2 menurut area">
                  <thead><tr>{Object.entries(metrics.pik2.offline).map(([area, rows]) => <th key={area}>{area} <span className="cctv-offline-count">({rows.reduce((sum, row) => sum + row.offlineCount, 0)})</span></th>)}</tr></thead>
                  <tbody><tr>{Object.entries(metrics.pik2.offline).map(([area, rows]) => <td key={area}><div className="cctv-offline-list">{!rows.length ? <p>Tidak ada CCTV offline.</p> : <><div className="cctv-offline-detail-head"><span>CCTV</span><span>Detail</span><span>Progress</span></div><ul>{rows.map((row, index) => <li key={index}><span>{row['Sub Area']} <small>({row.offlineCount} offline)</small></span><span>{row.Detail}</span><span>{offlineProgress(row)}</span></li>)}</ul></>}</div></td>)}</tr></tbody>
                </table>}
              </div>
            </OfflineCard>
          </div>

          {/* Distribusi di baris keempat agar panel offline mendapat dua kolom. */}
          <div hidden className="animate-card cctv-distribution" style={{ animationDelay: "0.6s" }}>
            <ChartBox title="CCTV Distribution by Area and Locations" headerRight={distributionLegend}>
              <div style={{ width: "100%", height: "100%", overflowX: "auto" }}>
                <div style={{ minWidth: Math.max(300, 35 + groupedDistData.reduce((width, group) => width + group.vals.length * 43 + 24, 0)), paddingBottom: "30px" }}>
                <GroupedBarChartWithGrid data={groupedDistData} maxDistCount={maxDistCount} />
                </div>
              </div>
            </ChartBox>
          </div>

        </div>
        </div>
      </div>
    </>
  );
}

// ==========================================
// UI HELPER COMPONENTS
// ==========================================

// Komponen Bar Chart Tunggal
function BarChartWithGrid({ data }) {
  if (!data || data.length === 0) {
    return <div style={{ fontSize: "12px", color: "#94A3B8", textAlign: "center", width: "100%", marginTop: "60px" }}>Memuat data...</div>;
  }

  const chartAreaHeight = 150; 
  const maxData = Math.max(...data.map(d => d.val), 0);

  let chartMax = 10;
  if (maxData > 10) chartMax = Math.ceil((maxData * 1.1) / 10) * 10;
  if (maxData > 100) chartMax = Math.ceil((maxData * 1.1) / 100) * 100;
  if (maxData > 1000) chartMax = Math.ceil((maxData * 1.1) / 500) * 500;

  const gridLevels = [
    chartMax,
    Math.round(chartMax * 0.75),
    Math.round(chartMax * 0.5),
    Math.round(chartMax * 0.25),
    0
  ];

  return (
    <div style={{ position: "relative", width: "100%", height: `${chartAreaHeight}px`, paddingLeft: "35px", marginTop: "15px" }}>
      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", pointerEvents: "none" }}>
        {gridLevels.map((val, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", width: "100%", height: "0px" }}>
            <span style={{ width: "30px", fontSize: "10px", color: "#94A3B8", textAlign: "right", paddingRight: "8px", fontWeight: "600" }}>
              {val}
            </span>
            <div style={{ flex: 1, borderBottom: "1.5px solid #F1F5F9" }} />
          </div>
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "space-around", alignItems: "flex-end", height: "100%", width: "100%" }}>
        {data.map((item, idx) => {
          const barHeight = chartMax > 0 ? (item.val / chartMax) * chartAreaHeight : 0;
          return (
            <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "40px", height: "100%", justifyContent: "flex-end", position: "relative" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: item.color, marginBottom: "6px" }}>{item.val}</span>
              <div style={{ width: "35px", height: `${Math.max(2, barHeight)}px`, background: item.color, borderRadius: "4px 4px 0 0", transition: "height 0.5s ease" }} />
              <div style={{ position: "absolute", top: "100%", marginTop: "8px", fontSize: "10px", fontWeight: "600", color: "#64748B", textAlign: "center", whiteSpace: "nowrap" }}>
                {item.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// KOMPONEN BARU: Bar Chart Berkelompok dengan Garis Latar (Untuk Distribusi)
function GroupedBarChartWithGrid({ data, maxDistCount }) {
  if (!data || data.length === 0) {
    return <div style={{ fontSize: "12px", color: "#94A3B8", textAlign: "center", width: "100%", marginTop: "60px" }}>Memuat data...</div>;
  }

  const chartAreaHeight = 150; 
  
  let chartMax = 10;
  if (maxDistCount > 10) chartMax = Math.ceil((maxDistCount * 1.1) / 10) * 10;
  if (maxDistCount > 100) chartMax = Math.ceil((maxDistCount * 1.1) / 100) * 100;
  if (maxDistCount > 1000) chartMax = Math.ceil((maxDistCount * 1.1) / 500) * 500;

  const gridLevels = [
    chartMax,
    Math.round(chartMax * 0.75),
    Math.round(chartMax * 0.5),
    Math.round(chartMax * 0.25),
    0
  ];

  return (
    <div style={{ position: "relative", width: "100%", height: `${chartAreaHeight}px`, paddingLeft: "35px", marginTop: "15px" }}>
      
      {/* LAYER LATAR BELAKANG: Garis Grid & Angka Y-Axis */}
      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", pointerEvents: "none" }}>
        {gridLevels.map((val, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", width: "100%", height: "0px" }}>
            <span style={{ width: "30px", fontSize: "10px", color: "#94A3B8", textAlign: "right", paddingRight: "8px", fontWeight: "600" }}>
              {val}
            </span>
            <div style={{ flex: 1, borderBottom: "1.5px solid #F1F5F9" }} />
          </div>
        ))}
      </div>

      {/* LAYER DEPAN: Diagram Batang Kelompok & Label X-Axis */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "space-around", alignItems: "flex-end", height: "100%", width: "100%" }}>
        {data.map((group, idx) => (
          <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", position: "relative" }}>
            
            {/* Wadah untuk batang berkelompok */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
              {group.vals.map((v, i) => {
                const barHeight = chartMax > 0 ? (v.val / chartMax) * chartAreaHeight : 0;
                return (
                  <div key={i} title={v.title} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: v.color, marginBottom: "6px" }}>{v.val}</span>
                    <div style={{ width: "35px", height: `${Math.max(2, barHeight)}px`, background: v.color, borderRadius: "4px 4px 0 0", transition: "height 0.5s ease" }} />
                  </div>
                );
              })}
            </div>

            {/* Label X-Axis (Area) */}
            <div style={{ position: "absolute", top: "100%", marginTop: "8px", fontSize: "10px", fontWeight: "600", color: "#64748B", textAlign: "center", whiteSpace: "nowrap" }}>
              {group.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// UPDATE: Standarisasi Judul pada fungsi ChartBox
function OfflineCard({ children, title = 'CCTV Offline' }) {
  const [expanded, setExpanded] = useState(false);
  const dialogRef = useRef(null);
  const expandRef = useRef(null);
  useEffect(() => {
    if (!expanded) return;
    const dialog = dialogRef.current;
    const button = expandRef.current;
    dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = previous; button?.focus(); };
  }, [expanded]);
  return <><ChartBox title={title} headerRight={<button ref={expandRef} type="button" className="cctv-expand-button" aria-label={`Perbesar ${title}`} onClick={() => setExpanded(true)}><svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4M3 3l5 5m9-5-5 5M3 17l5-5m9 5-5-5" /></svg></button>}>{children}</ChartBox>
    {expanded && createPortal(<dialog ref={dialogRef} className="cctv-offline-dialog" aria-label={`${title} diperbesar`} onCancel={() => setExpanded(false)} onClick={event => { if (event.target === event.currentTarget) setExpanded(false); }}><div className="cctv-offline-dialog-content"><div className="cctv-offline-dialog-heading"><h2>{title}</h2><button type="button" className="cctv-expand-button" onClick={() => setExpanded(false)}>Tutup</button></div><div className="cctv-offline-dialog-body">{children}</div></div></dialog>, document.body)}</>;
}

function ChartBox({ title, children, bgColor, textColor, headerRight }) {
  return (
    <div style={{ 
      background: bgColor || "white", 
      padding: "20px", 
      borderRadius: "12px", 
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)", 
      height: "280px",
      display: "flex", 
      flexDirection: "column",
      border: bgColor ? "none" : "1px solid #E2E8F0"
    }}>
      {/* Wrapper untuk Title yang ukurannya telah disamakan dengan Yearly CCTV Installations */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "15px" }}>
        <div style={{ 
          fontSize: "14px", 
          fontWeight: "800", 
          color: textColor || "#1E3A8A"
        }}>
          {title}
        </div>
        {/* Tempat Legend di Render */}
        {headerRight && <div>{headerRight}</div>}
      </div>
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, color: textColor || "inherit" }}>{children}</div>
    </div>
  );
}

function ProgressBar({ label, val, max, color }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "6px", color: "#64748B", fontWeight: "600" }}>
        <span style={{ textTransform: "capitalize" }}>{label}</span>
        <span style={{ color: color }}>{val}</span>
      </div>
      <div style={{ height: "10px", background: "#F1F5F9", borderRadius: "5px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(val/max)*100}%`, background: color, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}
