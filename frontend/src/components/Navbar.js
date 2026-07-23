"use client";
import { useState, useEffect, useRef } from "react";

export default function Navbar({ activeTab, setActiveTab, onLogout, dateRange, onDateChange }) {
  
  const formatDate = (date) => {
    return date.toLocaleDateString("id-ID", {
      day: "numeric", month: "short", year: "numeric",
    });
  };
  
  const [time, setTime] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [startDate, setStartDate] = useState(formatDate(new Date()));
  const [endDate, setEndDate] = useState(formatDate(new Date()));
  const [tempStart, setTempStart] = useState(dateRange?.start || new Date());
  const [tempEnd, setTempEnd] = useState(dateRange?.end || new Date());
  const [preset, setPreset] = useState("Bulan ini");
  const dropdownRef = useRef(null);

  // MAPPING JUDUL DASHBOARD YANG SUDAH DIPERBAIKI SECARA TERPISAH
  const tabTitles = {
    dashboard: "TRAFFIC DASHBOARD",
    traffic: "DATA TRAFFIC MONITORING",
    callcenter: "CALL CENTER DASHBOARD",
    cctv: "CCTV DASHBOARD"
  };

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const wib = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
      setTime(`${String(wib.getHours()).padStart(2, "0")}:${String(wib.getMinutes()).padStart(2, "0")}:${String(wib.getSeconds()).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleApply = () => {
    if (onDateChange) {
      onDateChange({ start: tempStart, end: tempEnd });
    }
    setIsOpen(false);
  };

  const handlePresetChange = (type) => {
    setPreset(type);
    const today = new Date();
    let s = new Date(today);
    let e = new Date(today);

    switch (type) {
      case "Kemarin":
        s.setDate(today.getDate() - 1); e.setDate(today.getDate() - 1);
        break;
      case "Bulan ini":
        s = new Date(today.getFullYear(), today.getMonth(), 1);
        e = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case "7 hari terakhir":
        s.setDate(today.getDate() - 6);
        break;
      default: break; 
    }
    setTempStart(s);
    setTempEnd(e);
  };

  const handleManualDateChange = (date, isStart) => {
    if (isStart) setTempStart(date);
    else setTempEnd(date);
    setPreset("Tetap");
  };

  return (
    <>
      <div style={{ 
        position: "sticky", 
        top: 0, 
        zIndex: 1100, 
        width: "100%", 
        background: "#EEF2F7" 
      }}>
        <nav className="navbar">
          <div className="navbar-left">
            <div className="navbar-logo">
              <img 
                src="/911cclogo.png" 
                alt="911 Logo" 
                style={{ 
                  width: "36px",
                  height: "36px", 
                  objectFit: "contain" 
                }} 
              />
            </div>
            <div>
              <div className="navbar-title">911 COMMAND CENTER</div>
              <div className="navbar-subtitle">Dashboard - Agung Sedayu Group</div>
            </div>
          </div>

          {/* Navigasi Utama */}
          <div className="navbar-tabs" style={{ gap: "8px" }}>
            <button className={`tab-btn ${activeTab === "dashboard" ? "active" : ""}`} onClick={() => setActiveTab("dashboard")}>Traffic</button>
            <button className={`tab-btn ${activeTab === "traffic" ? "active" : ""}`} onClick={() => setActiveTab("traffic")}>Data Traffic</button>
            <button className={`tab-btn ${activeTab === "callcenter" ? "active" : ""}`} onClick={() => setActiveTab("callcenter")}>Call Center</button>
            <button className={`tab-btn ${activeTab === "cctv" ? "active" : ""}`} onClick={() => setActiveTab("cctv")}>CCTV</button>
          </div>

          <div className="navbar-right">
            <div className="live-badge">
              <div className="live-dot" />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{time}</span>
              <span style={{ opacity: 0.6, fontSize: 10 }}>WIB</span>
            </div>
            <button className="btn-logout" onClick={onLogout}>
              <span>⏻</span> Logout
            </button>
          </div>
        </nav>

        {/* Baris Judul dan Rentang Tanggal */}
        <div className="date-bar" style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          padding: "16px 24px", 
          background: "white", 
          borderBottom: "1px solid #E2E8F0"
        }}>
          {/* JUDUL DINAMIS BERDASARKAN activeTab */}
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#1E3A8A", textTransform: "uppercase" }}>
            {tabTitles[activeTab] || "DASHBOARD"}
          </div>

          <div style={{ position: "relative" }}>
            {activeTab === "callcenter" && dateRange && (
              <div 
                onClick={() => setIsOpen(!isOpen)} 
                style={{ 
                  padding: "8px 18px", 
                  background: "#F8FAFC", 
                  borderRadius: "10px", 
                  border: "1px solid #E2E8F0", 
                  cursor: "pointer", 
                  fontWeight: 700, 
                  color: "#1E3A8A",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px"
                }}
              >
                <span>📅 {formatDate(dateRange.start)} - {formatDate(dateRange.end)}</span>
                <span style={{ fontSize: "10px", opacity: 0.5 }}>▼</span>
              </div>
            )}
            
            {isOpen && (
              <div className="date-picker-dropdown" style={{ 
                position: "absolute", 
                top: "50px", 
                right: "0", 
                background: "white", 
                padding: "24px", 
                zIndex: 1200, 
                borderRadius: "12px", 
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)", 
                width: "550px",
                border: "1px solid #E2E8F0"
              }}>
                <div style={{ marginBottom: "15px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#64748B", display: "block", marginBottom: "5px" }}>Pilih Preset:</label>
                  <select 
                    value={preset} 
                    onChange={(e) => handlePresetChange(e.target.value)} 
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #E2E8F0", outline: "none" }}
                  >
                    <option value="Hari ini">Hari ini</option>
                    <option value="Kemarin">Kemarin</option>
                    <option value="Bulan ini">Bulan ini</option>
                    <option value="7 hari terakhir">7 hari terakhir</option>
                  </select>
                </div>

                <div style={{ display: "flex", gap: "20px" }}>
                  <CalendarPart title="Mulai" selectedDate={tempStart} setSelectedDate={setTempStart} />
                  <CalendarPart title="Akhir" selectedDate={tempEnd} setSelectedDate={setTempEnd} />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
                  <button 
                    onClick={() => setIsOpen(false)}
                    style={{ 
                      padding: "10px 24px",
                      borderRadius: "8px", 
                      border: "none", 
                      background: "#94A3B8",
                      color: "white",
                      fontWeight: 700, 
                      cursor: "pointer",
                      transition: "background 0.2s"
                    }}
                    onMouseEnter={(e) => e.target.style.background = "#64748B"}
                    onMouseLeave={(e) => e.target.style.background = "#94A3B8"}
                  >
                    Batal
                  </button>

                  <button 
                    onClick={handleApply}
                    style={{ 
                      padding: "10px 24px", 
                      borderRadius: "8px", 
                      border: "none", 
                      background: "#3B82F6",
                      color: "white", 
                      fontWeight: 700, 
                      cursor: "pointer",
                      transition: "background 0.2s"
                    }}
                    onMouseEnter={(e) => e.target.style.background = "#2563EB"}
                    onMouseLeave={(e) => e.target.style.background = "#3B82F6"}
                  >
                    Terapkan
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function CalendarPart({ title, selectedDate, setSelectedDate }) {
  const [navDate, setNavDate] = useState(new Date(selectedDate));
  const [view, setView] = useState("days");

  const changeMonth = (offset) => {
    setNavDate(new Date(navDate.getFullYear(), navDate.getMonth() + offset, 1));
  };

  const selectYear = (year) => {
    setNavDate(new Date(year, navDate.getMonth(), 1));
    setView("days");
  };

  const currentMonthName = navDate.toLocaleString("id-ID", { month: "short" }).toUpperCase();
  const currentYear = navDate.getFullYear();
  const daysInMonth = new Date(navDate.getFullYear(), navDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(navDate.getFullYear(), navDate.getMonth(), 1).getDay();
  
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);
  const years = Array.from({ length: 24 }, (_, i) => 2016 + i);

  return (
    <div style={{ flex: 1 }}>
      <div style={{ textAlign: "center", fontSize: "11px", color: "#64748B", fontWeight: 600, marginBottom: "12px" }}>{title}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", padding: "0 5px" }}>
        <div onClick={() => setView(view === "days" ? "years" : "days")} style={{ fontSize: "11px", fontWeight: 700, color: "#1E3A8A", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
          {view === "days" ? `${currentMonthName} ${currentYear}` : "2016 – 2039"}
          <span style={{ fontSize: "8px" }}>{view === "days" ? "▼" : "▲"}</span>
        </div>
        <div style={{ display: "flex", gap: "10px", fontSize: "16px", cursor: "pointer", color: "#64748B", fontWeight: "bold" }}>
          <span onClick={(e) => { e.stopPropagation(); changeMonth(-1); }}>‹</span>
          <span onClick={(e) => { e.stopPropagation(); changeMonth(1); }}>›</span>
        </div>
      </div>

      {view === "days" ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "5px", textAlign: "center", marginBottom: "8px" }}>
            {["M", "S", "S", "R", "K", "J", "S"].map((d, i) => <span key={i} style={{ fontSize: "10px", color: "#94A3B8", fontWeight: 700 }}>{d}</span>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
            {blanks.map(i => <div key={`b-${i}`} />)}
            {days.map(d => {
              const isSelected = selectedDate.getDate() === d && selectedDate.getMonth() === navDate.getMonth() && selectedDate.getFullYear() === navDate.getFullYear();
              return (
                <div key={d} onClick={() => setSelectedDate(new Date(navDate.getFullYear(), navDate.getMonth(), d))}
                  style={{ fontSize: "12px", padding: "6px 0", cursor: "pointer", borderRadius: "50%", textAlign: "center",
                    background: isSelected ? "#3B82F6" : "transparent",
                    color: isSelected ? "white" : "#1E293B", fontWeight: isSelected ? 700 : 400
                  }}>{d}</div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginTop: "10px" }}>
          {years.map(y => (
            <div key={y} onClick={() => selectYear(y)}
              style={{ fontSize: "11px", padding: "4px 0", cursor: "pointer", textAlign: "center", borderRadius: "12px",
                border: currentYear === y ? "2px solid #3B82F6" : "none",
                background: currentYear === y ? "#3B82F6" : "transparent",
                color: currentYear === y ? "white" : "#1E293B", fontWeight: currentYear === y ? 700 : 400
              }}>{y}</div>
          ))}
        </div>
      )}
    </div>
  );
}