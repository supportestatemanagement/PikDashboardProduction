"use client";
import React, { useMemo, useState, useEffect } from "react";

export default function PerparkiranDashboard({ dateRange, isSidebarOpen = true }) {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  useEffect(() => {
    setIsLoading(true);
    fetch(`${process.env.REACT_APP_API_URL || ""}/api/perparkiran-data`)
      .then((res) => res.json())
      .then((result) => {
        if (result.status === "success") {
          setData(result.data);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Gagal mengambil data Perparkiran:", err);
        setIsLoading(false);
      });
  }, []);

  // --- LOGIKA DATE PARSING & SORTING ---
  const parseSheetDate = (dateStr) => {
    if (!dateStr || dateStr === "N/A") return null;
    const parts = String(dateStr).trim().split(/[- /]/);
    if (parts.length < 2) return null;

    if (parts[0].length === 4) {
      return new Date(parts[0], parseInt(parts[1], 10) - 1, parts[2] || 1);
    }
    
    const mMap = { 
      jan:0, feb:1, mar:2, apr:3, mei:4, may:4, jun:5, jul:6, 
      agu:7, aug:7, sep:8, okt:9, oct:9, nov:10, des:11, dec:11 
    };
    
    const day = parseInt(parts[0], 10);
    let monthStr = parts[1].toLowerCase();
    let month = mMap[monthStr] !== undefined ? mMap[monthStr] : 0;
    const year = parts.length > 2 ? parseInt(parts[2], 10) : 2026; 
    
    return new Date(year, month, day);
  };

  const getSortValue = (dateStr) => {
    if (!dateStr || dateStr === "N/A") return 0;
    const parts = String(dateStr).trim().split(/[- /]/);
    if (parts.length < 2) return 0;
    
    const mMap = { 
      jan:"01", feb:"02", mar:"03", apr:"04", mei:"05", may:"05", jun:"06", jul:"07", 
      agu:"08", aug:"08", sep:"09", okt:"10", oct:"10", nov:"11", des:"12", dec:"12" 
    };
    
    const day = parts[0].padStart(2, '0');
    const month = mMap[parts[1].toLowerCase()] || "00";
    const year = parts.length > 2 ? parts[2] : "2026";
    
    return parseInt(`${year}${month}${day}`, 10);
  };

  // --- FILTERING DATA ---
  const filteredData = useMemo(() => {
    if (!data || data.length === 0 || !dateRange) return data;
    
    return data.filter(row => {
      const rowDateRaw = row.Date;
      const rowDate = parseSheetDate(rowDateRaw);
      
      if (!rowDate) return false;

      const d = new Date(rowDate.getFullYear(), rowDate.getMonth(), rowDate.getDate()).getTime();
      const s = new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), dateRange.start.getDate()).getTime();
      const e = new Date(dateRange.end.getFullYear(), dateRange.end.getMonth(), dateRange.end.getDate()).getTime();

      return d >= s && d <= e;
    });
  }, [data, dateRange]);

  // --- DATA PROCESSING (Aggregations) ---
  const processedData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) {
      return { 
        totalTickets: 0, 
        metrics: { bgm: 0, gi: 0, rwi: 0 },
        dailyData: [],
        topIssues: { bgm: [], gi: [], rwi: [] },
        overallTop5Issues: [] 
      };
    }

    const getAreaCount = (areaName) => {
      return filteredData.filter(row => String(row.Area || "").toUpperCase() === areaName).length;
    };

    const processIssues = (areaName) => {
      const filtered = filteredData.filter(row => String(row.Area || "").toUpperCase() === areaName);
      const counts = {};
      filtered.forEach((item) => {
        const issue = String(item.Detailed || "").trim().toLowerCase();
        if (issue && issue !== "unknown" && issue !== "n/a" && issue !== "") {
          counts[issue] = (counts[issue] || 0) + 1;
        }
      });
      return Object.keys(counts)
        .map((key) => ({ label: key, val: counts[key] }))
        .sort((a, b) => b.val - a.val);
    };

    // --- MENGHITUNG OVERALL TOP 5 ISSUES ---
    const overallIssueCounts = {};
    filteredData.forEach(row => {
      const issue = String(row.Detailed || "").trim().toLowerCase();
      if (issue && issue !== "unknown" && issue !== "n/a" && issue !== "") {
        overallIssueCounts[issue] = (overallIssueCounts[issue] || 0) + 1;
      }
    });
    const overallTop5Issues = Object.entries(overallIssueCounts)
      .map(([label, val]) => ({ label, val }))
      .sort((a, b) => b.val - a.val)
      .slice(0, 5);
    // ----------------------------------------

    const dailyMap = {};
    filteredData.forEach(row => {
      const dateKey = row.Date || "N/A";
      dailyMap[dateKey] = (dailyMap[dateKey] || 0) + 1;
    });

    const sortedDates = Object.keys(dailyMap).sort((a, b) => getSortValue(a) - getSortValue(b));
    const dailyData = sortedDates.map(date => ({
      date: date,
      count: dailyMap[date]
    }));

    return {
      totalTickets: filteredData.length,
      metrics: {
        bgm: getAreaCount("BGM"),
        gi: getAreaCount("GI"),
        rwi: getAreaCount("RWI")
      },
      dailyData,
      topIssues: {
        bgm: processIssues("BGM"),
        gi: processIssues("GI"),
        rwi: processIssues("RWI")
      },
      overallTop5Issues
    };
  }, [filteredData]);

  if (isLoading) {
    return (
      <div style={{ padding: "50px", textAlign: "center", color: "#1E3A8A", fontWeight: "bold" }}>
        <div className="spinner" style={{ marginBottom: "10px", fontSize: "24px" }}>⌛</div>
        Menghubungkan ke Server ...
      </div>
    );
  }

  // Pengaturan Chart SVG untuk Daily Ticket
  const chartWidth = 800;
  const chartHeight = 220; 
  const padding = { top: 30, right: 20, bottom: 30, left: 30 };
  
  const dailyData = processedData.dailyData;
  const rawMaxCount = dailyData.length > 0 ? Math.max(...dailyData.map(d => d.count)) : 10;
  // Dinamis scale y-axis
  const maxY = Math.ceil(rawMaxCount * 1.2) || 10; 

  const points = dailyData.map((d, i) => {
    const x = padding.left + (i * (chartWidth - padding.left - padding.right)) / (dailyData.length - 1 || 1);
    const y = chartHeight - padding.bottom - (d.count * (chartHeight - padding.top - padding.bottom)) / maxY;
    return { x, y, count: d.count, date: d.date };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1]?.x} ${chartHeight - padding.bottom} L ${points[0]?.x} ${chartHeight - padding.bottom} Z`;

  // Scale Y-Axis grid generator
  const gridLevels = [];
  for (let i = 0; i <= 5; i++) {
    gridLevels.push(Math.round((maxY / 5) * i));
  }
  
  // UI sizing dynamics
  const logoSize = isSidebarOpen ? "80px" : "100px";
  const valFontSize = isSidebarOpen ? "25px" : "35px";
  const labelFontSize = "12px";

  const colors = {
    BGM: "#22C55E", // Hijau
    GI: "#3B82F6",  // Biru
    RWI: "#EAB308", // Kuning/Gold
  };

  return (
    <>
      <style>{`
        @keyframes slideFadeIn {
          0% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-card {
          animation: slideFadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: #f1f5f9; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      `}</style>
      
      <div style={{ padding: "2px", color: "#1E3A8A", display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* ROW 1: SUMMARY CARDS (Scoreboard) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
          {[
            { label: "TOTAL TICKETS", val: processedData.totalTickets, bg: "#1E3A8A", color: "white", logo: null },
            { label: "", val: processedData.metrics.bgm, bg: "white", color: "black", logo: "/logobgm.png" },
            { label: "", val: processedData.metrics.gi, bg: "white", color: "black", logo: "/logogi2.png" },
            { label: "", val: processedData.metrics.rwi, bg: "white", color: "black", logo: "/logorwi2.png" },
          ].map((item, i) => (
            <div key={i} className="animate-card" style={{ 
              animationDelay: `${i * 0.1}s`,
              background: item.bg, 
              color: item.color, 
              padding: "14px 16px", 
              borderRadius: "12px", 
              display: "flex",
              alignItems: "center",
              // Mengubah justifyContent menjadi 'center' secara default agar isi (termasuk logo) berada di tengah
              justifyContent: "center", 
              gap: "15px", 
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              minHeight: "90px",
              minWidth: 0,
              border: item.bg === "white" ? "1px solid #E2E8F0" : "none" 
            }}>
              {item.logo && (
                // Typo marginleft diubah menjadi marginLeft dengan format camelCase.
                <div style={{ width: logoSize, height: logoSize, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.3s ease" }}>
                  <img src={item.logo} alt={item.label} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
              )}
              <div style={{ textAlign: item.label === "TOTAL TICKETS" ? "center" : "left", minWidth: 0, overflow: "hidden" }}>
                <div style={{ fontSize: labelFontSize, fontWeight: "800", opacity: 0.7, textTransform: "uppercase", marginBottom: "0.5px" }}>
                  {item.label}
                </div>
                <div style={{ fontSize: valFontSize, fontWeight: "900", color: item.color }}>
                  {item.val}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ROW 2: CHART DAILY VOLUME & TOP 5 ISSUES (GRID) */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", 
          gap: "20px",
          alignItems: "stretch" 
        }}>
          {/* Kolom Kiri: Daily Ticket Volume */}
          <div className="animate-card" style={{ animationDelay: "0.3s", background: "white", padding: "24px", borderRadius: "12px", border: "1px solid #E2E8F0", position: "relative", minWidth: 0 }}>
            {/* Bagian Daily Volume (Sama seperti sebelumnya) */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ fontWeight: "800", fontSize: "16px", color: "#1E3A8A" }}>Daily Ticket Volume</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: "700", color: "#64748B" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#3B82F6" }} /> Volume Tiket
              </div>
            </div>

            <div style={{ width: "100%", position: "relative" }}>
              {dailyData.length === 0 ? (
                 <div style={{ textAlign: "center", color: "#94A3B8", padding: "50px 0" }}>Tidak ada data pada rentang tanggal ini.</div>
              ) : (
                <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
                  {gridLevels.map(v => {
                    const y = chartHeight - padding.bottom - (v * (chartHeight - padding.top - padding.bottom)) / maxY;
                    return (
                      <g key={v}>
                        <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke="#F1F5F9" strokeWidth="1" />
                        <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#94A3B8" fontWeight="600">{v}</text>
                      </g>
                    );
                  })}
                  
                  <path d={areaPath} fill="rgba(59, 130, 246, 0.1)" />
                  <path d={linePath} fill="none" stroke="#3B82F6" strokeWidth="2.5" />

                  {points.map((p, i) => (
                    <g key={i}>
                      {hoveredPoint?.date === p.date && (
                        <line x1={p.x} y1={padding.top} x2={p.x} y2={chartHeight - padding.bottom} stroke="#3B82F6" strokeWidth="1" strokeDasharray="4" />
                      )}
                      <circle cx={p.x} cy={p.y} r="4" fill="#3B82F6" stroke="white" strokeWidth="2" />
                      <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="11" fontWeight="800" fill="#3B82F6">{p.count}</text>
                      
                      <circle 
                        cx={p.x} cy={p.y} r="15" fill="transparent" style={{ cursor: "pointer" }}
                        onMouseEnter={() => setHoveredPoint(p)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />

                      {/* Label Tgl x-Axis */}
                      <text x={p.x} y={chartHeight - padding.bottom + 15} fontSize="10" fill="#64748B" fontWeight="700" transform={`rotate(35, ${p.x}, ${chartHeight - padding.bottom + 15})`}>
                        {p.date} 
                      </text>
                    </g>
                  ))}
                </svg>
              )}

              {hoveredPoint && (
                <div style={{
                  position: "absolute",
                  top: `calc(${(hoveredPoint.y / chartHeight) * 100}% - 80px)`, 
                  left: `calc(${(hoveredPoint.x / chartWidth) * 100}% - 60px)`,
                  background: "white", padding: "10px", borderRadius: "8px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.15)", border: "1px solid #E2E8F0", zIndex: 100, pointerEvents: "none", minWidth: "120px"
                }}>
                  <div style={{ fontSize: "11px", fontWeight: "bold", color: "#1E293B", marginBottom: "4px" }}>
                    Tanggal: {hoveredPoint.date}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3B82F6" }} />
                    <span style={{ color: "#3b3b3b", flex: 1 }}>Tiket Issued</span>
                    <span style={{ fontWeight: "bold", color: "#1E293B" }}>{hoveredPoint.count}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Kolom Kanan: Top 5 Issues Keseluruhan */}
          <div className="animate-card" style={{ 
            animationDelay: "0.4s",
            background: "white", 
            padding: "20px", 
            borderRadius: "12px", 
            border: "1px solid #E2E8F0", 
            minWidth: 0,
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{ fontWeight: "800", fontSize: "16px", color: "#1E3A8A", marginBottom: "15px" }}>
              Top 5 Issues
            </div>
            
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {processedData.overallTop5Issues.length === 0 ? (
                <div style={{ margin: "auto", color: "#94A3B8" }}>Belum ada data isu.</div>
              ) : (
                <TopIssueVerticalChart issues={processedData.overallTop5Issues} isSidebarOpen={isSidebarOpen} />
              )}
            </div>
          </div>
        </div>

        {/* ROW 3: ALL ISSUES PERPARKIRAN BY AREA */}
        <div className="animate-card" style={{ animationDelay: "0.5s", background: "white", borderRadius: "12px", padding: "24px", border: "1px solid #E2E8F0" }}>
          {/* ... (Konten Row 3 tidak berubah) ... */}
          <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1E3A8A", margin: 0 }}>All Issues Perparkiran by Area</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "30px" }}>
            {/* BGM */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <h3 style={{ textAlign: "center", color: colors.BGM, fontSize: "20px", fontWeight: "800", marginBottom: "20px" }}>BGM</h3>
              <div className="custom-scroll" style={{ maxHeight: "400px", overflowY: "auto", paddingRight: "10px" }}>
                {processedData.topIssues.bgm.length === 0 && <div style={{ textAlign: "center", fontSize:"12px", color:"#94a3b8" }}>N/A</div>}
                {processedData.topIssues.bgm.map((item, idx) => (
                  <HorizontalBar key={idx} label={item.label} val={item.val} max={processedData.topIssues.bgm[0]?.val} color={colors.BGM} />
                ))}
              </div>
            </div>

            {/* GI */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <h3 style={{ textAlign: "center", color: colors.GI, fontSize: "20px", fontWeight: "800", marginBottom: "20px" }}>GI</h3>
              <div className="custom-scroll" style={{ maxHeight: "400px", overflowY: "auto", paddingRight: "10px" }}>
                {processedData.topIssues.gi.length === 0 && <div style={{ textAlign: "center", fontSize:"12px", color:"#94a3b8" }}>N/A</div>}
                {processedData.topIssues.gi.map((item, idx) => (
                  <HorizontalBar key={idx} label={item.label} val={item.val} max={processedData.topIssues.gi[0]?.val} color={colors.GI} />
                ))}
              </div>
            </div>

            {/* RWI */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <h3 style={{ textAlign: "center", color: colors.RWI, fontSize: "20px", fontWeight: "800", marginBottom: "20px" }}>RWI</h3>
              <div className="custom-scroll" style={{ maxHeight: "400px", overflowY: "auto", paddingRight: "10px" }}>
                {processedData.topIssues.rwi.length === 0 && <div style={{ textAlign: "center", fontSize:"12px", color:"#94a3b8" }}>N/A</div>}
                {processedData.topIssues.rwi.map((item, idx) => (
                  <HorizontalBar key={idx} label={item.label} val={item.val} max={processedData.topIssues.rwi[0]?.val} color={colors.RWI} />
                ))}
              </div>
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

function HorizontalBar({ label, val, max, color }) {
  const percentage = max > 0 ? (val / max) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: "12px", gap: "12px" }}>
      <div style={{ width: "100px", flexShrink: 0, textAlign: "right", fontSize: "10px", fontWeight: "600", color: "#475569", lineHeight: "1.3", textTransform: "capitalize" }}>
        {label}
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", position: "relative" }}>
        <div style={{ position: "absolute", width: "100%", height: "24px", background: "transparent" }}></div>
        <div style={{ width: `${Math.max(percentage, 5)}%`, height: "26px", background: color, borderRadius: "0 4px 4px 0", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: "8px", color: "white", fontSize: "11px", fontWeight: "bold", transition: "width 0.8s ease-out", boxShadow: "inset 0px -3px 0px rgba(0,0,0,0.15)" }}>
          {val}
        </div>
      </div>
    </div>
  );
}

// Menerima parameter isSidebarOpen
function TopIssueVerticalChart({ issues, isSidebarOpen }) {
  if (!issues || issues.length === 0) return null;

  const chartAreaHeight = 150; 
  
  const maxData = Math.max(...issues.map(i => i.val), 0);
  const chartMax = Math.ceil((maxData * 1.1) / 10) * 10 || 10; 

  const gridLevels = [
    chartMax,
    Math.round(chartMax * 0.75),
    Math.round(chartMax * 0.5),
    Math.round(chartMax * 0.25),
    0
  ];

  return (
    <div style={{ 
      position: "relative", 
      width: "100%",
      marginTop: "40px",
      paddingLeft: "35px"
    }}>
      
      <div style={{ 
        position: "absolute", 
        left: 0, 
        top: 0, 
        height: `${chartAreaHeight}px`, 
        width: "100%", 
        display: "flex", 
        flexDirection: "column", 
        justifyContent: "space-between",
        pointerEvents: "none"
      }}>
        {gridLevels.map((val, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", width: "100%", height: "0px" }}>
            <span style={{ 
              width: "30px", 
              fontSize: "10px",
              color: "#94A3B8", 
              textAlign: "right", 
              paddingRight: "8px",
              fontWeight: "700"
            }}>
              {val}
            </span>
            <div style={{ flex: 1, borderBottom: "1px solid #F1F5F9" }} />
          </div>
        ))}
      </div>

      <div style={{ 
        position: "relative", 
        zIndex: 2, 
        display: "flex", 
        justifyContent: "space-around", 
        alignItems: "flex-end", 
        height: `${chartAreaHeight}px`,
        width: "100%"
      }}>
        {issues.map((issue, idx) => {
          const barHeight = (issue.val / chartMax) * chartAreaHeight;
          
          return (
            <div key={idx} style={{ 
              display: "flex", 
              flexDirection: "column", 
              alignItems: "center", 
              width: "18%",
              height: "100%", 
              justifyContent: "flex-end",
              position: "relative"
            }}>
              <span style={{ fontSize: "11px", fontWeight: "800", color: "#06B6D4", marginBottom: "4px" }}>
                {issue.val}
              </span>

              <div style={{ 
                width: "60%", 
                height: `${Math.max(2, barHeight)}px`, 
                background: "#22D3EE", 
                borderRadius: "4px 4px 0 0",
                boxShadow: "0 2px 4px rgba(6, 182, 212, 0.1)"
              }} />

              <div style={{ 
                position: "absolute",
                top: "105%", 
                width: "100%",
                textAlign: "center",
                // Mengubah ukuran font secara dinamis berdasarkan state sidebar
                fontSize: isSidebarOpen ? "7px" : "10px", 
                fontWeight: "700",
                color: "#475569",
                lineHeight: "1.2",
                wordWrap: "break-word",
                display: "-webkit-box",
                WebkitLineClamp: 2, 
                WebkitBoxOrient: "vertical",
                overflow: "hidden"
              }}>
                {issue.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}