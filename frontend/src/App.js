"use client";
import { useState, useEffect } from "react";
import "./global.css";
import Login from "./components/Login";
import Navbar from "./components/Navbar";
import TrafficDashboard from "./components/TrafficDashboard";
import VehicleTrackerDashboard from './components/VehicleTrackerDashboard';
import CallCenterDashboard from "./components/CallCenterDashboard";
import CctvDashboard from "./components/CctvDashboard";
import PerparkiranDashboard from "./components/PerparkiranDashboard";
import PumpWeatherDashboard from "./components/PumpWeatherDashboard";
import AvailableParkingDashboard from "./components/AvailableParkingDashboard";
import WaterQualityDashboard from "./components/WaterQualityDashboard";
import useDashboardSession from './services/useDashboardSession';
import VehicleAuthProvider from './components/VehicleAuthProvider';

const currentYearRange = () => {
  const today = new Date();
  return {
    start: new Date(today.getFullYear(), 0, 1),
    end: new Date(today.getFullYear(), today.getMonth(), today.getDate())
  };
};

export default function App() {
  const { session, checking, restoreError, retry, login, logout } = useDashboardSession();
  const isLoggedIn = Boolean(session);

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const savedTab = localStorage.getItem("cc_activeTab");
      return savedTab === "traffic" ? "dashboard" : (savedTab || "dashboard");
    }
    return "dashboard";
  });

  const [displayedTab, setDisplayedTab] = useState(activeTab);
  const pumpExiting = displayedTab === "pump" && activeTab !== "pump";
  useEffect(() => {
    if (displayedTab === activeTab) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (displayedTab !== "pump" || reduceMotion) {
      setDisplayedTab(activeTab);
      return;
    }
    const timer = window.setTimeout(() => setDisplayedTab(activeTab), 220);
    return () => window.clearTimeout(timer);
  }, [activeTab, displayedTab]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth <= 768 : false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("cc_activeTab", activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    document.body.classList.toggle("traffic-dashboard-body", ["dashboard", "vehicletracker"].includes(displayedTab) && isLoggedIn);
    return () => document.body.classList.remove("traffic-dashboard-body");
  }, [displayedTab, isLoggedIn]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    return {
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate())
    };
  });

  const [callCenterDateRange, setCallCenterDateRange] = useState(currentYearRange);
  const [parkingDateRange, setParkingDateRange] = useState(currentYearRange);
  const [waterDateRange, setWaterDateRange] = useState(currentYearRange);
  const activeDateRange = activeTab === "callcenter" ? callCenterDateRange
    : activeTab === "waterquality" ? waterDateRange
    : activeTab === "perparkiran" ? parkingDateRange : dateRange;
  const setActiveDateRange = activeTab === "callcenter" ? setCallCenterDateRange
    : activeTab === "waterquality" ? setWaterDateRange
    : activeTab === "perparkiran" ? setParkingDateRange : setDateRange;

  const handleLogout = () => {
    logout();
    setActiveTab("dashboard");
    if (typeof window !== "undefined") {
      localStorage.removeItem("cc_isLoggedIn");
      localStorage.removeItem("cc_activeTab");
    }
  };

  if (checking) return <main className="login-page" role="status">Memeriksa sesi dashboard…</main>;
  if (restoreError) return <main className="login-page"><div role="alert">Tidak dapat memeriksa sesi dashboard. <button onClick={retry}>Coba lagi</button></div></main>;
  if (!isLoggedIn) {
    return <Login onLogin={login} />;
  }

  return (
    <VehicleAuthProvider session={session} onSessionExpired={logout}>
    <div className={`app-wrapper ${["dashboard", "vehicletracker"].includes(displayedTab) ? "traffic-active" : ""}`}>
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout}
        dateRange={activeDateRange}
        onDateChange={setActiveDateRange}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isMobile={isMobile}
      />

      <div 
        className="page-content"
        style={{
          marginLeft: isMobile ? "0px" : (isSidebarOpen ? "260px" : "0px"),
          paddingTop: "60px",
          paddingLeft: ["dashboard", "vehicletracker", "disaster"].includes(displayedTab) ? "0" : (isMobile ? "10px" : "20px"),
          paddingRight: ["dashboard", "vehicletracker", "disaster"].includes(displayedTab) ? "0" : (isMobile ? "10px" : "20px"),
          paddingBottom: ["dashboard", "vehicletracker", "disaster"].includes(displayedTab) ? "0" : (isMobile ? "10px" : "20px"),
          transition: "margin-left 0.3s ease",
          boxSizing: "border-box",
          minHeight: "100vh"
        }}
      >
        <div style={{ display: displayedTab === "dashboard" ? "block" : "none" }}>
          <TrafficDashboard dateRange={dateRange} isActive={activeTab === "dashboard"} />
        </div>
        {displayedTab === 'vehicletracker' && <VehicleTrackerDashboard isActive={activeTab === 'vehicletracker'} />}
        
        <div style={{ display: displayedTab === "callcenter" ? "block" : "none" }}>
          <CallCenterDashboard
            dateRange={callCenterDateRange} 
            isSidebarOpen={isSidebarOpen}
          />
        </div>

        <div className={isSidebarOpen ? "cctv-sidebar-open" : undefined} style={{ display: displayedTab === "cctv" ? "block" : "none" }}>
          <CctvDashboard />
        </div>

        {displayedTab === "availableparking" && <AvailableParkingDashboard />}
        {displayedTab === "waterquality" && <WaterQualityDashboard dateRange={waterDateRange} />}
        {displayedTab === "disaster" && <iframe
          title="Pantau Bencana Dashboard"
          src="https://ninoplus.vercel.app/dashboard"
          referrerPolicy="no-referrer"
          style={{ display: "block", width: "100%", height: "calc(100dvh - 60px)", border: 0, background: "#07111f" }}
        />}

        <div style={{ display: displayedTab === "perparkiran" ? "block" : "none" }}>
          <PerparkiranDashboard 
            dateRange={parkingDateRange} 
            isSidebarOpen={isSidebarOpen}
          />
        </div>

        <div className={displayedTab === "pump" ? `pump-page-transition ${pumpExiting ? "is-exiting" : "is-entering"}` : undefined} inert={pumpExiting ? true : undefined} style={{ display: displayedTab === "pump" ? "block" : "none" }}>
          <PumpWeatherDashboard dateRange={dateRange} isSidebarOpen={isSidebarOpen} />
        </div>

      </div>
    </div>
    </VehicleAuthProvider>
  );
}
