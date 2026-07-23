"use client";
import React, { useMemo, useState, useEffect } from "react"; 

const navButtonStyle = {
  padding: "6px 12px",
  fontSize: "11px",
  fontWeight: "700",
  borderRadius: "6px",
  border: "1px solid #E2E8F0",
  background: "white",
  color: "#64748B",
  cursor: "pointer",
};

export default function CallCenterDashboard({ dateRange, isSidebarOpen = true }) {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    setIsLoading(true);
    fetch(`${process.env.REACT_APP_API_URL}/api/call-center-data`)
      .then((res) => res.json())
      .then((result) => {
        if (result.status === "success") {
          setData(result.data);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Gagal mengambil data CC:", err);
        setIsLoading(false);
      });
  }, []);

  const getSortValue = (dateStr) => {
    if (!dateStr || dateStr === "N/A") return 0;
    const parts = String(dateStr).trim().split(/[- /]/);
    if (parts.length < 3) return 0;

    if (parts[0].length === 4) {
      return parseInt(parts[0] + parts[1].padStart(2, '0') + parts[2].padStart(2, '0'), 10);
    }
    
    const mMap = { 
      jan:"01", feb:"02", mar:"03", apr:"04", mei:"05", may:"05", jun:"06", jul:"07", 
      agu:"08", aug:"08", sep:"09", okt:"10", oct:"10", nov:"11", des:"12", dec:"12" 
    };
    
    const day = parts[0].padStart(2, '0');
    const month = mMap[parts[1].toLowerCase()] || "00";
    const year = parts[2];
    
    return parseInt(`${year}${month}${day}`, 10);
  };

  const parseSheetDate = (dateStr) => {
    if (!dateStr || dateStr === "N/A") return null;
    const parts = String(dateStr).trim().split(/[- /]/);
    if (parts.length < 3) return null;

    if (parts[0].length === 4) {
      return new Date(parts[0], parseInt(parts[1], 10) - 1, parts[2]);
    }
    
    const mMap = { 
      jan:0, feb:1, mar:2, apr:3, mei:4, may:4, jun:5, jul:6, 
      agu:7, aug:7, sep:8, okt:9, oct:9, nov:10, des:11, dec:11 
    };
    
    const day = parseInt(parts[0], 10);
    const year = parseInt(parts[2], 10);
    
    let monthStr = parts[1].toLowerCase();
    let month = mMap[monthStr] !== undefined ? mMap[monthStr] : (parseInt(parts[1], 10) - 1);
    
    return new Date(year, month, day);
  };

  const filteredData = useMemo(() => {
    if (!data || data.length === 0 || !dateRange) return data;
    
    return data.filter(row => {
      const rowDateRaw = row.Tanggal || row.TANGGAL || row.Date || row.DATE;
      const rowDate = parseSheetDate(rowDateRaw);
      
      if (!rowDate) return false;

      const d = new Date(rowDate.getFullYear(), rowDate.getMonth(), rowDate.getDate()).getTime();
      const s = new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), dateRange.start.getDate()).getTime();
      const e = new Date(dateRange.end.getFullYear(), dateRange.end.getMonth(), dateRange.end.getDate()).getTime();

      return d >= s && d <= e;
    });
  }, [data, dateRange]);

  const processedData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) {
      return { 
        totalTickets: 0, 
        dailyData: [], 
        topIssues: [],
        deptWorkload: [],
        metrics: { bgm: "0%", gi: "0%", rwi: "0%", pik2: "0%", pik2mil: "0%", other: "0%" } 
      };
    }

    const getAreaTicketCount = (areaName) => {
      return filteredData.filter(row => 
        row.Area && String(row.Area).toUpperCase().includes(areaName.toUpperCase())
      ).length;
    };

    const knownAreas = ["BGM", "GI", "RWI", "PIK 2", "PIK 2 MIL"];
    const otherCount = filteredData.filter(row => {
      if (!row.Area) return true;
      const areaStr = String(row.Area).toUpperCase();
      return !knownAreas.some(known => areaStr.includes(known));
    }).length;

    const detailedCounts = {};
    filteredData.forEach(row => {
      const detail = row.Detailed ? String(row.Detailed).toLowerCase() : "n/a";
      detailedCounts[detail] = (detailedCounts[detail] || 0) + 1;
    });

    const topIssues = Object.entries(detailedCounts)
      .map(([label, val]) => ({ label, val }))
      .sort((a, b) => b.val - a.val) 
      .slice(0, 5);

    const deptCounts = {};
    filteredData.forEach(row => {
      const deptName = row.Dept ? String(row.Dept).toUpperCase() : "N/A";
      deptCounts[deptName] = (deptCounts[deptName] || 0) + 1;
    });

    const deptWorkload = Object.entries(deptCounts)
      .map(([label, val]) => ({ label, val }))
      .sort((a, b) => b.val - a.val);

    const deptData = Object.entries(deptCounts)
      .map(([label, val]) => ({ label, val }))
      .sort((a, b) => b.val - a.val);

    const totalTickets = filteredData.length; 

    const dailyMap = {};
    filteredData.forEach(row => {
      const dateKey = row.Tanggal || row.Date || "N/A";
      dailyMap[dateKey] = (dailyMap[dateKey] || 0) + 1;
    });

    const sortedDates = Object.keys(dailyMap).sort((a, b) => getSortValue(a) - getSortValue(b));
    const dailyData = sortedDates.map(date => ({
      date: date,
      count: dailyMap[date]
    }));

    return {
      totalTickets,
      topIssues,
      deptWorkload,
      deptData,
      metrics: {
        bgm: getAreaTicketCount("BGM"),
        gi: getAreaTicketCount("GI"),
        rwi: getAreaTicketCount("RWI"),
        pik2: getAreaTicketCount("PIK 2"),
        pik2mil: getAreaTicketCount("PIK 2 Ext."),
        other: otherCount
      },
      dailyData
    };
  }, [filteredData]);

  const sortedData = useMemo(() => {
    if (!filteredData) return [];
    
    return [...filteredData].sort((a, b) => {
      const dateA = String(a.Tanggal || a.TANGGAL || a.Date || a.DATE || "");
      const dateB = String(b.Tanggal || b.TANGGAL || b.Date || b.DATE || "");
      
      const sortValA = getSortValue(dateA);
      const sortValB = getSortValue(dateB);

      if (sortValA !== sortValB) return sortValA - sortValB; 

      const timeA = String(a.Waktu || a.WAKTU || a.Time || a.TIME || "");
      const timeB = String(b.Waktu || b.WAKTU || b.Time || b.TIME || "");
      return timeA.localeCompare(timeB);
    });
  }, [filteredData]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTableData = sortedData.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (isLoading) {
    return (
      <div style={{ padding: "50px", textAlign: "center", color: "#1E3A8A", fontWeight: "bold" }}>
        <div className="spinner" style={{ marginBottom: "10px", fontSize: "24px" }}>⌛</div>
        Menghubungkan ke Server ...
      </div>
    );
  }

  if (!filteredData || filteredData.length === 0) {
    return (
      <div style={{ padding: "50px", textAlign: "center", color: "#64748B" }}>
        <p style={{ fontSize: "18px", fontWeight: "bold" }}>⚠️ Tidak ada data ditemukan.</p>
        <p>Gagal mengambil rekaman tiket atau data rentang tanggal kosong.</p>
      </div>
    );
  }

  const chartWidth = 800;
  const chartHeight = 220; 
  const padding = { top: 30, right: 20, bottom: 30, left: 30 };
  const maxY = 25; 
  const dailyData = processedData.dailyData;

  const points = dailyData.map((d, i) => {
    const x = padding.left + (i * (chartWidth - padding.left - padding.right)) / (dailyData.length - 1 || 1);
    const y = chartHeight - padding.bottom - (d.count * (chartHeight - padding.top - padding.bottom)) / maxY;
    return { x, y, count: d.count, date: d.date };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1]?.x} ${chartHeight - padding.bottom} L ${points[0]?.x} ${chartHeight - padding.bottom} Z`;

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === "N/A") return dateStr;
    const parts = dateStr.split("-"); 
    
    if (parts.length < 3) return dateStr;

    if (parts[0].length === 4) {
      const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
      const day = parseInt(parts[2], 10); 
      const month = months[parseInt(parts[1], 10) - 1]; 
      return `${day} ${month}`;
    } 
    else {
      const day = parseInt(parts[0], 10); 
      const month = parts[1]; 
      return `${day} ${month}`;
    }
  };

  // LOGIKA DINAMIS: Terbuka = Ukuran lebih kecil (45px), Tertutup = Normal (65px)
  const logoSize = isSidebarOpen ? "45px" : "65px";
  const valFontSize = isSidebarOpen ? "20px" : "24px";
  const labelFontSize = isSidebarOpen ? "10px" : "10px";

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
      `}</style>
      
      <div className="callcenter-container" style={{ padding: "2px", color: "#1E3A8A" }}>
        
        {/* ROW 1: SUMMARY CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", marginBottom: "20px" }}>
          {[
            { label: "TOTAL TICKETS", val: processedData.totalTickets, bg: "#1E3A8A", color: "white", logo: null },
            { label: "", val: processedData.metrics.bgm, bg: "white", color: "black", logo: "/logobgm.png" },
            { label: "", val: processedData.metrics.gi, bg: "white", color: "black", logo: "/logogi2.png" },
            { label: "", val: processedData.metrics.rwi, bg: "white", color: "black", logo: "/logorwi2.png" },
            { label: "", val: processedData.metrics.pik2, bg: "white", color: "black", logo: "/logopik2.png" },
            { label: "", val: processedData.metrics.pik2mil, bg: "white", color: "black", logo: "/logopik2mil2.png" },
            { label: "", val: processedData.metrics.other, bg: "white", color: "black", logo: "/logoother2.png" },
          ].map((item, i) => (
            <div key={i} className="animate-card" style={{ 
              animationDelay: `${i * 0.1}s`,
              background: item.bg, 
              color: item.color, 
              padding: "12px 14px", 
              borderRadius: "12px", 
              display: "flex",
              alignItems: "center",
              justifyContent: item.label === "TOTAL TICKETS" ? "center" : "flex-start", 
              gap: "10px", 
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              minHeight: "90px",
              minWidth: 0,
              border: item.bg === "white" ? "1px solid #E2E8F0" : "none" 
            }}>
              {item.logo && (
                <div style={{
                  width: logoSize,             
                  height: logoSize,            
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all 0.3s ease" 
                }}>
                  <img 
                    src={item.logo} 
                    alt={item.label} 
                    style={{ 
                      width: "100%",
                      height: "100%", 
                      objectFit: "contain" 
                    }} 
                  />
                </div>
              )}

              <div style={{ textAlign: item.label === "TOTAL TICKETS" ? "center" : "left", minWidth: 0, overflow: "hidden" }}>
                <div style={{ 
                  fontSize: labelFontSize, 
                  fontWeight: "800", 
                  lineHeight: "1.2",
                  textTransform: "uppercase",
                  opacity: 0.7, 
                  marginBottom: "0.5px",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                  transition: "all 0.3s ease"
                }}>
                  {item.label}
                </div>
                <div style={{ 
                  fontSize: valFontSize, 
                  fontWeight: "900",
                  letterSpacing: "-0.5px",
                  marginBottom: "3px",
                  color: item.color,
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                  transition: "all 0.3s ease" 
                }}>
                  {item.val}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ROW 2: CHART & TOP ISSUES */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", 
          gap: "20px", 
          marginBottom: "20px",
          alignItems: "stretch" 
        }}>
          
          <div className="chart-card animate-card" style={{ animationDelay: "0.4s", background: "white", padding: "24px", borderRadius: "12px", border: "2px solid #E2E8F0", position: "relative", minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ fontWeight: "800", fontSize: "16px", color: "#1E3A8A" }}>Daily Ticket Volume</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: "700", color: "#64748B" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#3B82F6" }} /> Total Ticket
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
                {[0, 5, 10, 15, 20, 25].map(v => {
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
                      transform={`rotate(35, ${p.x}, ${chartHeight - padding.bottom + 15})`}
                    >
                      {formatDate(p.date)} 
                    </text>
                  </g>
                ))}
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
                    {hoveredPoint.date}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3B82F6" }} />
                    <span style={{ color: "#3b3b3b", flex: 1 }}>Total Ticket</span>
                    <span style={{ fontWeight: "bold", color: "#1E293B" }}>{hoveredPoint.count}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="chart-card animate-card" style={{ 
            animationDelay: "0.5s",
            background: "white", 
            padding: "20px", 
            borderRadius: "12px", 
            border: "2px solid #E2E8F0", 
            minWidth: 0,
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{ fontWeight: "800", fontSize: "16px", color: "#1E3A8A", marginBottom: "15px" }}>
              Top Reported Issues
            </div>
            
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <TopIssueVerticalChart issues={processedData.topIssues} />
            </div>
          </div>
        </div>

        {/* ROW 3: LOG TABLE & DEPARTMENT WORKLOAD */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", 
          gap: "20px",
          alignItems: "stretch",
          marginBottom: "20px"
        }}>
          
          <div className="chart-card animate-card" style={{ 
            animationDelay: "0.6s",
            background: "white", 
            padding: "20px", 
            borderRadius: "12px", 
            border: "2px solid #E2E8F0",
            display: "flex",
            flexDirection: "column",
            minWidth: 0
          }}>
            <div style={{ fontWeight: "800", fontSize: "16px", color: "#1E3A8A", marginBottom: "15px" }}>
              Call Center Activity Log
            </div>
            
            <div style={{ flex: 1, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", textAlign: "left" }}>
                    <th style={{ padding: "10px", borderBottom: "2px solid #E2E8F0", color: "#64748B" }}>NO</th>
                    <th style={{ padding: "10px", borderBottom: "2px solid #E2E8F0", color: "#64748B" }}>DATE</th>
                    <th style={{ padding: "10px", borderBottom: "2px solid #E2E8F0", color: "#64748B" }}>OFFICER</th>
                    <th style={{ padding: "10px", borderBottom: "2px solid #E2E8F0", color: "#64748B" }}>TIME</th>
                    <th style={{ padding: "10px", borderBottom: "2px solid #E2E8F0", color: "#64748B" }}>REQUEST</th>
                    <th style={{ padding: "10px", borderBottom: "2px solid #E2E8F0", color: "#64748B" }}>DETAIL</th>
                    <th style={{ padding: "10px", borderBottom: "2px solid #E2E8F0", color: "#64748B" }}>AREA</th>
                    <th style={{ padding: "10px", borderBottom: "2px solid #E2E8F0", color: "#64748B" }}>DEPT</th>
                  </tr>
                </thead>
                <tbody>
                  {currentTableData.map((row, idx) => {
                    const rawTime = row.Time || row.Time_Sending || "-";
                    let formattedTime = rawTime;
                    if (rawTime !== "-" && String(rawTime).includes(":")) {
                      const parts = String(rawTime).split(":");
                      formattedTime = `${parts[0]}:${parts[1]}`;
                    }

                    return (
                      <tr key={idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "10px", fontWeight: "bold" }}>
                          {indexOfFirstItem + idx + 1}
                        </td>
                        <td style={{ padding: "10px" }}>{row.Tanggal || row.Date || "-"}</td>
                        <td style={{ padding: "10px" }}>{row.Officer || "-"}</td>
                        <td style={{ padding: "10px", fontWeight: "600" }}>{row.Time || "-"}</td>
                        <td style={{ padding: "10px" }}>{row.Name || "-"}</td>
                        <td style={{ padding: "10px", color: "#475569" }}>{row.Detailed || "-"}</td>
                        <td style={{ padding: "10px" }}>{row.Area || "-"}</td>
                        <td style={{ padding: "10px" }}>{row.Dept || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              marginTop: "20px",
              paddingTop: "15px",
              borderTop: "1px solid #F1F5F9"
            }}>
              <div style={{ fontSize: "11px", color: "#64748B", fontWeight: "600" }}>
                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, sortedData.length)} of {sortedData.length} entries
              </div>
              <div style={{ display: "flex", gap: "5px" }}>
                <button 
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{...navButtonStyle, opacity: currentPage === 1 ? 0.5 : 1}}
                >
                  Previous
                </button>
                
                {[...Array(totalPages)].map((_, i) => {
                  const pageNum = i + 1;
                  if (pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)) {
                    return (
                      <button 
                        key={pageNum}
                        onClick={() => paginate(pageNum)}
                        style={{
                          ...navButtonStyle,
                          background: currentPage === pageNum ? "#3B82F6" : "white",
                          color: currentPage === pageNum ? "white" : "#64748B",
                          borderColor: currentPage === pageNum ? "#3B82F6" : "#E2E8F0"
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                  if (pageNum === currentPage - 2 || pageNum === currentPage + 2) return <span key={pageNum}>...</span>;
                  return null;
                })}

                <button 
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={{...navButtonStyle, opacity: currentPage === totalPages ? 0.5 : 1}}
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          <div className="chart-card animate-card" style={{ 
            animationDelay: "0.7s",
            background: "white", 
            padding: "20px", 
            borderRadius: "12px", 
            border: "2px solid #E2E8F0",
            display: "flex",
            flexDirection: "column",
            minWidth: 0
          }}>
            <div style={{ fontWeight: "800", fontSize: "16px", color: "#1E3A8A", marginBottom: "15px" }}>
              Follow-up by Department
            </div>
            <div style={{ flex: 1 }}>
              <DepartmentWorkloadChart data={processedData.deptWorkload} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// --- KOMPONEN PEMBANTU ---
function VerticalBar({ val, label, color, max }) {
  const height = max > 0 ? (val / max) * 120 : 0;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", minWidth: "45px" }}>
      <div style={{ fontSize: "10px", fontWeight: "800", color: "#1E293B" }}>{val}</div>
      <div style={{ width: "70%", height: `${Math.max(5, height)}px`, background: color, borderRadius: "4px 4px 0 0" }} />
      <div style={{ fontSize: "9px", marginTop: "6px", fontWeight: "700", color: "#64748B", textAlign: "center" }}>{label}</div>
    </div>
  );
}

function StackedBar({ done, total, label }) {
  const totalHeight = 120;
  const doneHeight = total > 0 ? (done / total) * totalHeight : 0;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: "100%", height: `${totalHeight - doneHeight}px`, background: "#FACC15" }} />
      <div style={{ width: "100%", height: `${doneHeight}px`, background: "#16A34A", borderRadius: "4px 4px 0 0" }} />
      <div style={{ fontSize: "10px", marginTop: "6px", fontWeight: "700" }}>{label}</div>
    </div>
  );
}

function TopIssueVerticalChart({ issues }) {
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
                fontSize: "10px",
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

function DepartmentWorkloadChart({ data }) {
  if (!data || data.length === 0) return <div style={{ textAlign: "center", fontSize: "12px", color: "#64748B" }}>Tidak ada data departemen</div>;

  const maxVal = Math.max(...data.map(d => d.val), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      {data.map((item, idx) => {
        const percentage = (item.val / maxVal) * 100;
        return (
          <div key={idx} style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "11px", fontWeight: "700" }}>
              <span style={{ color: "#1E293B", textTransform: "uppercase" }}>{item.label}</span>
              <span style={{ color: "#3B82F6" }}>{item.val} Tickets</span>
            </div>
            <div style={{ width: "100%", height: "8px", background: "#F1F5F9", borderRadius: "10px", overflow: "hidden" }}>
              <div style={{ 
                width: `${percentage}%`, 
                height: "100%", 
                background: "linear-gradient(90deg, #3B82F6, #60A5FA)", 
                borderRadius: "10px",
                transition: "width 0.5s ease-out"
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}