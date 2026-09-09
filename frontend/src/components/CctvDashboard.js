"use client";
import React, { useState, useEffect } from "react";

export default function CctvDashboard() {
  const [trendData, setTrendData] = useState([]);
  const [totalCctv, setTotalCctv] = useState(0);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [offlineData, setOfflineData] = useState(null);
  const [loadError, setLoadError] = useState(false);

  // STATE UNTUK GRAFIK BARIS KE-2
  const [brandData, setBrandData] = useState([]);
  const [areaData, setAreaData] = useState([]);
  const [conditionData, setConditionData] = useState({ on: 0, off: 0 });

  // STATE UNTUK GRAFIK BARIS KE-3
  const [locationData, setLocationData] = useState([]);
  const [distData, setDistData] = useState({});

  useEffect(() => {
    // Sesuaikan URL dengan port backend Flask Anda
    fetch(`${process.env.REACT_APP_API_URL}/api/cctv-growth-data`)
      .then((res) => res.json())
      .then((res) => {
        if (res.status === "success") {
          const data = res.data;

          // 1. Kalkulasi Total CCTV
          const totalValidCctv = data.filter((item) => 
            item["Tahun"] || (item["Nama Pada Layar (OSD)"] && String(item["Nama Pada Layar (OSD)"]).trim() !== "")
          ).length;

          setTotalCctv(totalValidCctv);

          // Penampung hitungan
          const yearCounts = {};
          const brandCounts = {};
          const areaCounts = {};
          const locCounts = {};
          const distMap = {}; // Format: { Area: { Lokasi: count } }
          const offlineByArea = { BGM: [], GI: [], RWI: [], PIK2: [] };
          let onCount = 0;
          let offCount = 0;

          data.forEach((item) => {
            if (!item["Tahun"] && !(item["Nama Pada Layar (OSD)"] && String(item["Nama Pada Layar (OSD)"]).trim() !== "")) return;

            // --- TAHUN ---
            const year = item["Tahun"];
            if (year) {
              yearCounts[year] = (yearCounts[year] || 0) + 1;
            }

            // --- BRAND ---
            const brand = item["Brand"] ? String(item["Brand"]).trim() : "";
            if (brand && brand.toLowerCase() !== "unknown") {
              brandCounts[brand] = (brandCounts[brand] || 0) + 1;
            }

            // --- AREA ---
            const area = item["Area"] ? String(item["Area"]).trim() : "";
            if (area && area.toLowerCase() !== "unknown") {
              areaCounts[area] = (areaCounts[area] || 0) + 1;
            }

            // --- LOKASI ---
            const loc = item["Lokasi"] ? String(item["Lokasi"]).trim() : "";
            if (loc && loc.toLowerCase() !== "unknown") {
              locCounts[loc] = (locCounts[loc] || 0) + 1;
            }

            // --- DISTRIBUSI AREA & LOKASI ---
            if (area && area.toLowerCase() !== "unknown" && loc && loc.toLowerCase() !== "unknown") {
              if (!distMap[area]) distMap[area] = {};
              distMap[area][loc] = (distMap[area][loc] || 0) + 1;
            }

            // --- KONDISI ---
            const condition = item["Kondisi"] ? String(item["Kondisi"]).trim().toUpperCase() : "";
            if (condition === "ON" || condition === "AKTIF" || condition === "NORMAL") {
              onCount++;
            } else if (["OFF", "OFFLINE", "MATI", "RUSAK"].includes(condition)) {
              offCount++;
              const areaKey = area.toUpperCase().replace(/\s+/g, "");
              if (offlineByArea[areaKey]) offlineByArea[areaKey].push(item);
            }
          });

          // Set State Trend
          const sortedYears = Object.keys(yearCounts).sort();
          const trend = sortedYears.map((year) => ({ year, count: yearCounts[year] }));
          setTrendData(trend);

          // Urutkan & Set State Brand
          const sortedBrands = Object.keys(brandCounts)
            .map(key => ({ label: key, count: brandCounts[key] }))
            .sort((a, b) => b.count - a.count);
          setBrandData(sortedBrands);

          // Urutkan & Set State Area
          const sortedAreas = Object.keys(areaCounts)
            .map(key => ({ label: key, count: areaCounts[key] }))
            .sort((a, b) => b.count - a.count);
          setAreaData(sortedAreas);

          // Urutkan & Set State Lokasi
          const sortedLocs = Object.keys(locCounts)
            .map(key => ({ label: key, count: locCounts[key] }))
            .sort((a, b) => b.count - a.count);
          setLocationData(sortedLocs);

          // Set State Distribusi Area-Lokasi
          setDistData(distMap);

          // Set State Kondisi
          setConditionData({ on: onCount, off: offCount });
          setOfflineData(offlineByArea);
        } else {
          setLoadError(true);
        }
      })
      .catch((err) => {
        console.error("Error fetching CCTV data:", err);
        setLoadError(true);
      });
  }, []);

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
        .cctv-locations { grid-area: 1 / 1 / 2 / 4; }
        .cctv-offline { grid-area: 1 / 4 / 2 / 7; }
        .cctv-brand { grid-area: 2 / 1 / 3 / 3; }
        .cctv-area { grid-area: 2 / 3 / 3 / 5; }
        .cctv-condition { grid-area: 2 / 5 / 3 / 7; }
        .cctv-distribution { grid-area: 3 / 1 / 4 / 7; }
        .cctv-offline-tables { overflow: auto; height: 100%; padding-right: 6px; }
        .cctv-offline-tables table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; color: #475569; }
        .cctv-offline-tables caption { text-align: left; font-weight: 800; color: #1E3A8A; padding: 10px 0; }
        .cctv-offline-tables th, .cctv-offline-tables td { text-align: left; padding: 8px; border-bottom: 1px solid #E2E8F0; overflow-wrap: anywhere; vertical-align: top; }
        .cctv-offline-tables th { background: #F1F5F9; }
        @container (min-width: 1700px) {
          .cctv-locations { grid-area: 1 / 1 / 2 / 3; }
          .cctv-offline { grid-area: 1 / 3 / 2 / 5; }
          .cctv-distribution { grid-area: 1 / 5 / 2 / 7; }
        }
        @container (max-width: 700px) {
          .cctv-panels { display: flex; flex-direction: column; }
          .cctv-locations { order: 0; }
          .cctv-offline { order: 1; }
          .cctv-brand { order: 2; }
          .cctv-area { order: 3; }
          .cctv-condition { order: 4; }
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
              <div style={{ fontWeight: "800", fontSize: "14px", color: "#1E3A8A" }}>Yearly CCTV Installations</div>
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
                {totalCctv > 0 ? totalCctv : "..."}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.8, letterSpacing: "2px", marginTop: "5px" }}>UNITS INSTALLED</div> 
              <div style={{ marginTop: "15px", display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", fontWeight: "600" }}> 
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10B981", animation: "pulse 2s infinite" }}></span>
                  Live Update
              </div>
            </div>
          </div>
        </div>

        <div className="cctv-panel-container">
        <div className="cctv-panels">
          
          {/* Card 3: Animasi dengan delay 0.2s */}
          <div className="animate-card cctv-brand" style={{ animationDelay: "0.2s" }}>
            <ChartBox title="Total CCTV by Brand">
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
            <ChartBox title="Total CCTV per Area">
              <div style={{ width: "100%", height: "100%" }}>
                <BarChartWithGrid data={areaChartData} />
              </div>
            </ChartBox>
          </div>

          {/* Card 5: Animasi dengan delay 0.4s */}
          <div className="animate-card cctv-condition" style={{ animationDelay: "0.4s" }}>
            <ChartBox title="Total CCTV by Condition">
              <div style={{ width: "100%", height: "100%" }}>
                <BarChartWithGrid data={conditionChartData} />
              </div>
            </ChartBox>
          </div>

          {/* Card 6: Animasi dengan delay 0.5s */}
          <div className="animate-card cctv-locations" style={{ animationDelay: "0.2s" }}>
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
            <ChartBox title="CCTV Offline">
              <div className="cctv-offline-tables" tabIndex={0} role="region" aria-label="Daftar CCTV offline per area">
                {loadError ? <p role="alert">Gagal memuat data CCTV offline.</p> : !offlineData ? <p role="status">Memuat data...</p> :
                  Object.entries(offlineData).map(([area, cameras]) => (
                    <table key={area}>
                      <caption>{area} ({cameras.length})</caption>
                      <colgroup><col style={{ width: "45%" }} /><col style={{ width: "25%" }} /><col style={{ width: "30%" }} /></colgroup>
                      <thead><tr><th scope="col">Nama Pada Layar (OSD)</th><th scope="col">Sub Area</th><th scope="col">Lokasi</th></tr></thead>
                      <tbody>
                        {cameras.length === 0 ? <tr><td colSpan={3}>Tidak ada CCTV offline.</td></tr> : cameras.map((camera, index) => (
                          <tr key={index}>
                            <td>{String(camera["Nama Pada Layar (OSD)"] ?? "").trim() || "—"}</td>
                            <td>{String(camera["Sub Area"] ?? "").trim() || "—"}</td>
                            <td>{String(camera["Lokasi"] ?? "").trim() || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ))}
              </div>
            </ChartBox>
          </div>

          {/* Distribusi di baris kedua hanya jika ruang mencukupi. */}
          <div className="animate-card cctv-distribution" style={{ animationDelay: "0.6s" }}>
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
