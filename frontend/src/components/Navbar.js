"use client";
import { useState, useEffect } from "react";

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  onLogout, 
  dateRange, 
  onDateChange,
  isSidebarOpen,
  setIsSidebarOpen,
  isMobile 
}) {
  const formatDate = (date) => {
    return date.toLocaleDateString("id-ID", {
      day: "numeric", month: "short", year: "numeric",
    });
  };
  
  const [time, setTime] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [tempStart, setTempStart] = useState(dateRange?.start || new Date());
  const [tempEnd, setTempEnd] = useState(dateRange?.end || new Date());
  const [preset, setPreset] = useState("Hari ini");
  const isTrafficDashboard = activeTab === "dashboard";
  const todayKey = new Date().toDateString();
  const isLiveRange = dateRange?.start?.toDateString() === todayKey && dateRange?.end?.toDateString() === todayKey;

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
      onDateChange(isTrafficDashboard
        ? { start: tempStart, end: tempStart }
        : { start: tempStart, end: tempEnd });
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
      case "Hari ini":
      default: break; 
    }
    setTempStart(s);
    setTempEnd(e);
  };

  return (
    <>
      {/* 1. TOP HEADER (FIXED NAVBAR DI ATAS) */}
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "60px",
        background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isMobile ? "0 7px" : "0 20px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        zIndex: 1100
      }}>
        {/* HAMBURGER BUTTON & LOGO */}
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "5px" : "12px", minWidth: 0 }}>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{
              background: "none",
              border: "none",
              color: "white",
              cursor: "pointer",
              padding: isMobile ? "3px" : "6px",
              display: "flex",
              alignItems: "center",
              borderRadius: "4px"
            }}
          >
            <svg width={isMobile ? "20" : "24"} height={isMobile ? "20" : "24"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "5px" : "10px", minWidth: 0 }}>
            <img 
              src="/911cclogo.png" 
              alt="911 Logo" 
              style={{ width: isMobile ? "29px" : "34px", height: isMobile ? "29px" : "34px", objectFit: "contain", flexShrink: 0 }} 
            />
            <div>
              <div style={{ color: "white", fontSize: isMobile ? "10px" : "15px", fontWeight: "700", lineHeight: "1.1", whiteSpace: "nowrap" }}>
                {isMobile ? "911 COMMAND CENTER" : "911 COMMAND CENTER"}
              </div>
              {!isMobile && (
                <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "10px" }}>
                  Agung Sedayu Group
                </div>
              )}
            </div>
          </div>
        </div>

        {/* HEADER RIGHT (LIVE TIME, DATE FILTER, LOGOUT) */}
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "4px" : "12px", flexShrink: 0 }}>

          {/* RENTANG TANGGAL DATERANGE UNTUK CALL CENTER */}
          {(activeTab === "dashboard" || activeTab === "callcenter" || activeTab === "perparkiran") && dateRange && (
            <div style={{ position: "relative" }}>
              <div 
                onClick={() => {
                  if (!isOpen) {
                    setTempStart(dateRange.start);
                    setTempEnd(dateRange.end);
                  }
                  setIsOpen(!isOpen);
                }} 
                style={{ 
                  padding: isMobile ? "4px 6px" : "5px 9px", 
                  background: "rgba(255,255,255,0.2)", 
                  borderRadius: "6px", 
                  cursor: "pointer", 
                  fontWeight: 600, 
                  color: "white",
                  fontSize: isMobile ? "8px" : "10px",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <span>📅 {isTrafficDashboard
                  ? formatDate(dateRange.start)
                  : `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`}</span>
                <span style={{ fontSize: "8px" }}>▼</span>
              </div>

              {isOpen && (
                <div className="date-picker-dropdown" style={{ 
                  position: "absolute", 
                  top: "45px", 
                  right: "0", 
                  background: "white", 
                  padding: "12px", 
                  zIndex: 1200, 
                  borderRadius: "9px", 
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)", 
                  width: isMobile || isTrafficDashboard ? "250px" : "440px",
                  border: "1px solid #E2E8F0",
                  color: "#1E293B"
                }}>
                  <div style={{ marginBottom: "10px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", display: "block", marginBottom: "5px" }}>Pilih Preset:</label>
                    <select 
                      value={preset} 
                      onChange={(e) => handlePresetChange(e.target.value)} 
                      style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #E2E8F0", outline: "none", fontSize: "10px" }}
                    >
                      <option value="Hari ini">Hari ini</option>
                      <option value="Kemarin">Kemarin</option>
                      {!isTrafficDashboard && <option value="Bulan ini">Bulan ini</option>}
                      {!isTrafficDashboard && <option value="7 hari terakhir">7 hari terakhir</option>}
                    </select>
                  </div>

                  <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: "15px" }}>
                    <CalendarPart title={isTrafficDashboard ? "Pilih Tanggal" : "Mulai"} selectedDate={tempStart} setSelectedDate={setTempStart} />
                    {!isTrafficDashboard && <CalendarPart title="Akhir" selectedDate={tempEnd} setSelectedDate={setTempEnd} />}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "7px", marginTop: "12px" }}>
                    <button onClick={() => setIsOpen(false)} style={{ padding: "6px 11px", borderRadius: "5px", border: "none", background: "#94A3B8", color: "white", fontWeight: 700, fontSize: "10px", cursor: "pointer" }}>Batal</button>
                    <button onClick={handleApply} style={{ padding: "6px 11px", borderRadius: "5px", border: "none", background: "#3B82F6", color: "white", fontWeight: 700, fontSize: "10px", cursor: "pointer" }}>Terapkan</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "dashboard" && (
            <div className={isLiveRange ? "header-mode live" : "header-mode historical"}>
              <i />{isLiveRange ? "LIVE" : "HISTORICAL"}
            </div>
          )}

          {!isMobile && (
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "6px", 
              background: "rgba(255,255,255,0.15)", 
              padding: isMobile ? "5px 7px" : "6px 12px", 
              borderRadius: "6px", 
              color: "white", 
              fontSize: "12px" 
            }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{time}</span>
              <span style={{ opacity: 0.6, fontSize: "10px" }}>WIB</span>
            </div>
          )}

          <button 
            onClick={onLogout}
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "none",
              color: "white",
              padding: "6px 12px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            {!isMobile && "Logout"}
          </button>
        </div>
      </div>

      {/* 2. SIDEBAR MENU (BISA DIBUKA / DITUTUP) */}
      <div style={{
        position: "fixed",
        top: "60px",
        left: 0,
        bottom: 0,
        width: isSidebarOpen ? "260px" : "0px",
        background: "linear-gradient(180deg, #1e3c72 0%, #2a5298 100%)",
        overflow: "hidden",
        transition: "width 0.3s ease",
        boxShadow: isSidebarOpen ? "4px 0 10px rgba(0,0,0,0.1)" : "none",
        zIndex: 1000
      }}>
        <div style={{ width: "260px", padding: "20px 15px" }}>
          <div style={{ 
            fontSize: "11px", 
            fontWeight: "700", 
            color: "rgba(255,255,255,0.5)", 
            textTransform: "uppercase", 
            marginBottom: "15px",
            letterSpacing: "1px"
          }}>
            DASHBOARD MENU
          </div>

          <nav style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { id: "dashboard", label: "Traffic", icon: "📊" },
              { id: "traffic", label: "Data Traffic", icon: "🚦" },
              { id: "callcenter", label: "Call Center", icon: "📞" },
              { id: "cctv", label: "CCTV", icon: "📹" },
              { id: "perparkiran", label: "Parking", icon: "🅿️" },
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (isMobile) setIsSidebarOpen(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: isActive ? "rgba(255,255,255,0.2)" : "transparent",
                    border: "none",
                    borderRadius: "8px",
                    color: isActive ? "white" : "rgba(255,255,255,0.75)",
                    fontSize: "13px",
                    fontWeight: isActive ? "700" : "500",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    textAlign: "left",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                      e.currentTarget.style.color = "white";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "rgba(255,255,255,0.75)";
                    }
                  }}
                >
                  <span style={{ fontSize: "16px" }}>{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </nav>
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
      <div style={{ textAlign: "center", fontSize: "11px", color: "#64748B", fontWeight: 600, marginBottom: "10px" }}>{title}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <div onClick={() => setView(view === "days" ? "years" : "days")} style={{ fontSize: "11px", fontWeight: 700, color: "#1E3A8A", cursor: "pointer" }}>
          {view === "days" ? `${currentMonthName} ${currentYear}` : "2016 – 2039"}
        </div>
        <div style={{ display: "flex", gap: "10px", fontSize: "14px", cursor: "pointer", color: "#64748B", fontWeight: "bold" }}>
          <span onClick={(e) => { e.stopPropagation(); changeMonth(-1); }}>‹</span>
          <span onClick={(e) => { e.stopPropagation(); changeMonth(1); }}>›</span>
        </div>
      </div>

      {view === "days" ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", textAlign: "center", marginBottom: "6px" }}>
            {["M", "S", "S", "R", "K", "J", "S"].map((d, i) => <span key={i} style={{ fontSize: "10px", color: "#94A3B8", fontWeight: 700 }}>{d}</span>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
            {blanks.map(i => <div key={`b-${i}`} />)}
            {days.map(d => {
              const isSelected = selectedDate.getDate() === d && selectedDate.getMonth() === navDate.getMonth() && selectedDate.getFullYear() === navDate.getFullYear();
              return (
                <div key={d} onClick={() => setSelectedDate(new Date(navDate.getFullYear(), navDate.getMonth(), d))}
                  style={{ fontSize: "11px", padding: "4px 0", cursor: "pointer", borderRadius: "50%", textAlign: "center", background: isSelected ? "#3B82F6" : "transparent", color: isSelected ? "white" : "#1E293B", fontWeight: isSelected ? 700 : 400 }}>{d}</div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
          {years.map(y => (
            <div key={y} onClick={() => selectYear(y)}
              style={{ fontSize: "10px", padding: "4px 0", cursor: "pointer", textAlign: "center", borderRadius: "8px", background: currentYear === y ? "#3B82F6" : "transparent", color: currentYear === y ? "white" : "#1E293B", fontWeight: currentYear === y ? 700 : 400 }}>{y}</div>
          ))}
        </div>
      )}
    </div>
  );
}
