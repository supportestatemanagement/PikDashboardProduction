"use client";
import { useState, useEffect } from "react";

function MenuIcon({ type }) {
  if (type === "water") return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3S5 11 5 15a7 7 0 0 0 14 0c0-4-7-12-7-12Z" /><path d="M9 15a3 3 0 0 0 3 3" /></svg>;
  const common = { width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  if (type === "car") return <svg {...common}><path d="m5 11 1.5-4h11l1.5 4" /><path d="M3 13a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5H3Z" /><circle cx="7" cy="16" r="1" /><circle cx="17" cy="16" r="1" /><path d="M5 18v2M19 18v2" /></svg>;
  if (type === "call") return <svg {...common}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c1 .4 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z" /></svg>;
  if (type === "camera") return <svg {...common}><path d="M3 7h13v10H3z" /><path d="m16 10 5-3v10l-5-3z" /><path d="M7 17v3M4 20h6" /><circle cx="7" cy="11" r="1.5" /></svg>;
  if (type === "pump") return <svg {...common}><circle cx="9" cy="13" r="5" /><circle cx="9" cy="13" r="1.5" /><path d="M4 11H2v4h2M9 8V4h7v4h-4M14 10h6v7h-7M17 10v7M6 18v3M12 18v3M3 21h18" /></svg>;
  if (type === "disaster") return <svg {...common}><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v5M12 17h.01" /></svg>;
  return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M9 17V7h4a3 3 0 0 1 0 6H9M9 13h4" /></svg>;
}

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
  const [isCallCenterOpen, setIsCallCenterOpen] = useState(activeTab === "callcenter" || activeTab === "perparkiran");
  useEffect(() => {
    if (activeTab === "callcenter" || activeTab === "perparkiran") setIsCallCenterOpen(true);
  }, [activeTab]);
  const [tempStart, setTempStart] = useState(dateRange?.start || new Date());
  const [tempEnd, setTempEnd] = useState(dateRange?.end || new Date());
  const [preset, setPreset] = useState("Hari ini");
  const isTrafficDashboard = activeTab === "dashboard";
  const isSingleDateDashboard = isTrafficDashboard || activeTab === "pump";
  const dashboardSubtitle = {
    dashboard: "Traffic Dashboard",
    vehicletracker: "Vehicle Tracker",
    callcenter: "Call Center Dashboard / Emergency",
    cctv: "CCTV Dashboard",
    perparkiran: "Call Center Dashboard / Parking",
    pump: "Pump Station Dashboard",
    waterquality: "Water Quality Monitoring",
    availableparking: "Parking Availability Dashboard",
    disaster: "Pantau Bencana Dashboard",
  }[activeTab] || "Dashboard";
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
      onDateChange(isSingleDateDashboard
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
      case "Bulan lalu":
        s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        e = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case "3 bulan terakhir":
        s = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        break;
      case "6 bulan terakhir":
        s = new Date(today.getFullYear(), today.getMonth() - 5, 1);
        break;
      case "Tahun ini":
        s = new Date(today.getFullYear(), 0, 1);
        break;
      case "1 tahun terakhir":
        s.setFullYear(today.getFullYear() - 1);
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
                {isMobile ? "COMMAND CENTER PIK" : "COMMAND CENTER PANTAI INDAH KAPUK"}
              </div>
              {!isMobile && (
                <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "10px" }}>
                  {dashboardSubtitle}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* HEADER RIGHT (LIVE TIME, DATE FILTER, LOGOUT) */}
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "4px" : "12px", flexShrink: 0 }}>

          {/* RENTANG TANGGAL DATERANGE UNTUK CALL CENTER */}
          {(["dashboard", "callcenter", "perparkiran", "pump", "waterquality"].includes(activeTab)) && dateRange && (
            <div style={{ position: "relative" }}>
              <div 
                onClick={() => {
                  if (!isOpen) {
                    setTempStart(dateRange.start);
                    setTempEnd(dateRange.end);
                    const today = new Date();
                    const yearStart = new Date(today.getFullYear(), 0, 1);
                    setPreset(dateRange.end.toDateString() === today.toDateString()
                      ? (dateRange.start.toDateString() === yearStart.toDateString() ? "Tahun ini"
                        : dateRange.start.toDateString() === today.toDateString() ? "Hari ini" : "")
                      : "");
                  }
                  setIsOpen(!isOpen);
                }} 
                style={{ 
                  minHeight: "32px",
                  boxSizing: "border-box",
                  padding: "6px 12px", 
                  background: "rgba(255,255,255,0.2)", 
                  borderRadius: "6px", 
                  cursor: "pointer", 
                  fontWeight: 600, 
                  color: "white",
                  fontSize: isMobile ? "8px" : "12px",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <span>📅 {isSingleDateDashboard
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
                  width: isMobile || isSingleDateDashboard ? "250px" : "440px",
                  border: "1px solid #E2E8F0",
                  color: "#1E293B"
                }}>
                  {!isSingleDateDashboard && <div style={{ marginBottom: "10px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", display: "block", marginBottom: "5px" }}>Pilih Preset:</label>
                    <select 
                      value={preset} 
                      onChange={(e) => handlePresetChange(e.target.value)} 
                      style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #E2E8F0", outline: "none", fontSize: "10px" }}
                    >
                      <option value="" disabled>Rentang khusus</option>
                      {!isSingleDateDashboard && <option value="Tahun ini">Tahun ini</option>}
                      <option value="Hari ini">Hari ini</option>
                      <option value="Kemarin">Kemarin</option>
                      {!isTrafficDashboard && <option value="Bulan ini">Bulan ini</option>}
                      {!isTrafficDashboard && <option value="7 hari terakhir">7 hari terakhir</option>}
                    </select>
                  </div>}

                  <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: "15px" }}>
                    <CalendarPart title={isSingleDateDashboard ? "Pilih Tanggal" : "Mulai"} selectedDate={tempStart} setSelectedDate={setTempStart} />
                    {!isSingleDateDashboard && <CalendarPart title="Akhir" selectedDate={tempEnd} setSelectedDate={setTempEnd} />}
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
              minHeight: "32px",
              boxSizing: "border-box",
              padding: "6px 12px", 
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
              minHeight: "32px",
              boxSizing: "border-box",
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
        overflowX: "hidden",
        overflowY: "auto",
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
              { id: "dashboard", label: "Traffic", icon: "car" },
              { id: "vehicletracker", label: "Vehicle Tracker", icon: "car" },
              { id: "callcenter", label: "Call Center", icon: "call" },
              { id: "cctv", label: "CCTV", icon: "camera" },
              { id: "pump", label: "Pump Station", icon: "pump" },
              { id: "waterquality", label: "Water Quality Monitoring", icon: "water" },
              { id: "availableparking", label: "Parking Availability", icon: "parking" },
              { id: "disaster", label: "Pantau Bencana", icon: "disaster" },
            ].map(tab => {
              const isGroup = tab.id === "callcenter";
              const isActive = activeTab === tab.id || (isGroup && activeTab === "perparkiran");
              return (
                <div key={tab.id}>
                <button
                  aria-expanded={isGroup ? isCallCenterOpen : undefined}
                  aria-controls={isGroup ? "call-center-subtopics" : undefined}
                  aria-current={!isGroup && isActive ? "page" : undefined}
                  onClick={() => {
                    if (isGroup) {
                      setIsCallCenterOpen(open => !open);
                      return;
                    }
                    setActiveTab(tab.id);
                    setIsOpen(false);
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
                  <span style={{ width: "22px", display: "grid", placeItems: "center", flexShrink: 0 }}><MenuIcon type={tab.icon} /></span>
                  {tab.label}
                  {isGroup && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ marginLeft: "auto", transform: isCallCenterOpen ? "rotate(180deg)" : undefined }}><path d="m6 9 6 6 6-6" /></svg>}
                </button>
                {isGroup && (
                  <div id="call-center-subtopics" hidden={!isCallCenterOpen} className="call-center-subtopics">
                    {[
                      { id: "callcenter", label: "Emergency" },
                      { id: "perparkiran", label: "Parking" },
                    ].map(subtopic => (
                      <button key={subtopic.id} className="call-center-subtopic" aria-current={activeTab === subtopic.id ? "page" : undefined} onClick={() => {
                        setActiveTab(subtopic.id);
                        setIsOpen(false);
                        if (isMobile) setIsSidebarOpen(false);
                      }}>{subtopic.label}</button>
                    ))}
                  </div>
                )}
                </div>
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
