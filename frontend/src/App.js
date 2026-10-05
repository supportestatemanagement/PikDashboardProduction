"use client";
import { useState, useEffect } from "react";
import "./global.css";
import Login from "./components/Login";
import Navbar from "./components/Navbar";
import TrafficDashboard from "./components/TrafficDashboard";
import VehicleTrackerDashboard from './components/VehicleTrackerDashboard';
import CallCenterDashboard from "./components/CallCenterDashboard";
import CustomerServiceDashboard from "./components/CustomerServiceDashboard";
import CctvDashboard from "./components/CctvDashboard";
import PerparkiranDashboard from "./components/PerparkiranDashboard";
import PumpWeatherDashboard from "./components/PumpWeatherDashboard";
import AvailableParkingDashboard from "./components/AvailableParkingDashboard";
import WaterQualityDashboard from "./components/WaterQualityDashboard";
import PusatPantauBencana from "./components/pantauBencana/PusatPantauBencana";
import useDashboardSession from './services/useDashboardSession';
import VehicleAuthProvider from './components/VehicleAuthProvider';
import CrisisRoom from './components/CrisisRoom';
import { isCrisisBroadcaster } from './services/crisisRoom';

const disasterDevelopTab = "pantau-bencana-develop";
const disasterDevelopHash = `#/${disasterDevelopTab}`;

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
  const broadcasterOnly = isCrisisBroadcaster(session?.user);

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      if (window.location.pathname === '/crisis-room/broadcast') return 'crisis-broadcast';
      if (window.location.pathname === '/crisis-room') return 'crisis-room';
      if (window.location.hash === disasterDevelopHash) return disasterDevelopTab;
      const savedTab = localStorage.getItem("cc_activeTab");
      return savedTab === "disaster" ? disasterDevelopTab : savedTab === "traffic" ? "dashboard" : (savedTab || "dashboard");
    }
    return "dashboard";
  });

  // Keep the existing tab navigation; only the prototype adds a shareable URL.
  const selectTab = (tab) => {
    if (broadcasterOnly) tab = 'crisis-broadcast';
    if (!broadcasterOnly && tab === 'crisis-broadcast') tab = 'crisis-room';
    if (tab === 'crisis-room' || tab === 'crisis-broadcast') {
      window.history.pushState({ dashboardTab: tab }, '', tab === 'crisis-broadcast' ? '/crisis-room/broadcast' : '/crisis-room');
      setActiveTab(tab);
      return;
    }
    if (window.location.pathname.startsWith('/crisis-room')) window.history.pushState({ dashboardTab: tab }, '', '/');
    const base = window.location.pathname + window.location.search;
    if (tab === disasterDevelopTab && window.location.hash !== disasterDevelopHash) {
      window.history.replaceState({ ...window.history.state, dashboardTab: activeTab }, '', window.location.href);
      window.history.pushState({ dashboardTab: tab }, '', base + disasterDevelopHash);
    } else if (tab !== disasterDevelopTab && window.location.hash === disasterDevelopHash) {
      window.history.pushState({ dashboardTab: tab }, '', base);
    }
    setActiveTab(tab);
  };

  useEffect(() => {
    const restoreUrlTab = () => {
      if (window.location.pathname === '/crisis-room/broadcast') setActiveTab('crisis-broadcast');
      else if (window.location.pathname === '/crisis-room') setActiveTab('crisis-room');
      else if (window.location.hash === disasterDevelopHash) setActiveTab(disasterDevelopTab);
      else if (window.history.state?.dashboardTab) setActiveTab(window.history.state.dashboardTab);
      else setActiveTab(current => ['crisis-room', 'crisis-broadcast'].includes(current) ? 'dashboard' : current === disasterDevelopTab
        ? (window.history.state?.dashboardTab === "disaster" ? disasterDevelopTab : window.history.state?.dashboardTab || "dashboard") : current);
    };
    window.addEventListener('hashchange', restoreUrlTab);
    window.addEventListener('popstate', restoreUrlTab);
    return () => {
      window.removeEventListener('hashchange', restoreUrlTab);
      window.removeEventListener('popstate', restoreUrlTab);
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    if (broadcasterOnly) {
      setActiveTab('crisis-broadcast');
      window.history.replaceState({ dashboardTab: 'crisis-broadcast' }, '', '/crisis-room/broadcast');
    } else if (activeTab === 'crisis-broadcast') {
      setActiveTab('crisis-room');
      window.history.replaceState({ dashboardTab: 'crisis-room' }, '', '/crisis-room');
    }
  }, [session, broadcasterOnly, activeTab]);

  const [displayedTab, setDisplayedTab] = useState(activeTab);
  const isPageExiting = displayedTab !== activeTab;
  useEffect(() => {
    if (displayedTab === activeTab) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !isLoggedIn) {
      setDisplayedTab(activeTab);
      return;
    }
    const timer = window.setTimeout(() => setDisplayedTab(activeTab), 180);
    return () => window.clearTimeout(timer);
  }, [activeTab, displayedTab, isLoggedIn]);

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
  const [customerDateRange, setCustomerDateRange] = useState(currentYearRange);
  const activeDateRange = activeTab === "callcenter" ? callCenterDateRange
    : activeTab === "customerservice" ? customerDateRange
    : activeTab === "waterquality" ? waterDateRange
    : activeTab === "perparkiran" ? parkingDateRange : dateRange;
  const setActiveDateRange = activeTab === "callcenter" ? setCallCenterDateRange
    : activeTab === "customerservice" ? setCustomerDateRange
    : activeTab === "waterquality" ? setWaterDateRange
    : activeTab === "perparkiran" ? setParkingDateRange : setDateRange;

  const handleLogout = () => {
    logout();
    if (window.location.pathname.startsWith('/crisis-room')) window.history.replaceState({}, '', '/');
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

  // The broadcaster never mounts other dashboards or the Firebase provider.
  if (broadcasterOnly) return <div className="app-wrapper">
    <Navbar activeTab="crisis-broadcast" broadcasterOnly setActiveTab={selectTab} onLogout={handleLogout} dateRange={dateRange} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isMobile={isMobile} />
    <main className="page-content" style={{ padding: '76px 20px 20px', marginLeft: !isMobile && isSidebarOpen ? 260 : 0 }}><CrisisRoom session={session} onSessionExpired={logout} /></main>
  </div>;

  return (
    <VehicleAuthProvider session={session} onSessionExpired={logout}>
    <div className={`app-wrapper ${["dashboard", "vehicletracker"].includes(displayedTab) ? "traffic-active" : ""}`}>
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={selectTab}
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
          paddingLeft: ["dashboard", "vehicletracker", disasterDevelopTab].includes(displayedTab) ? "0" : (isMobile ? "10px" : "20px"),
          paddingRight: ["dashboard", "vehicletracker", disasterDevelopTab].includes(displayedTab) ? "0" : (isMobile ? "10px" : "20px"),
          paddingBottom: ["dashboard", "vehicletracker", disasterDevelopTab].includes(displayedTab) ? "0" : (isMobile ? "10px" : "20px"),
          transition: "margin-left 0.3s ease",
          boxSizing: "border-box",
          minHeight: "100vh"
        }}
      >
        <div
          className={`dashboard-page-transition ${isPageExiting ? "is-exiting" : "is-entering"}`}
          inert={isPageExiting ? true : undefined}
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
        {displayedTab === "customerservice" && <CustomerServiceDashboard dateRange={customerDateRange} />}
        {displayedTab === disasterDevelopTab && <PusatPantauBencana />}
        {displayedTab === 'crisis-room' && <CrisisRoom session={session} onSessionExpired={logout} />}

        <div style={{ display: displayedTab === "perparkiran" ? "block" : "none" }}>
          <PerparkiranDashboard 
            dateRange={parkingDateRange} 
            isSidebarOpen={isSidebarOpen}
          />
        </div>

        <div style={{ display: displayedTab === "pump" ? "block" : "none" }}>
          <PumpWeatherDashboard dateRange={dateRange} isSidebarOpen={isSidebarOpen} />
        </div>
        </div>
      </div>
    </div>
    </VehicleAuthProvider>
  );
}
