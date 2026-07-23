"use client";
import { useState, useEffect } from "react";
import "./global.css";
import Login from "./components/Login";
import Navbar from "./components/Navbar";
import AlertBanner from "./components/AlertBanner";
import SummaryCards from "./components/SummaryCards";
import TrafficCharts from "./components/TrafficCharts";
import HeatmapMap from "./components/HeatmapMap";
import CctvGrid from "./components/CctvGrid";
import CallCenterDashboard from "./components/CallCenterDashboard";
import CctvDashboard from "./components/CctvDashboard";

const INITIAL = {
  totalVehicles: 1319,
  totalIn: 10510,
  totalOut: 9191,
  stage: 1,
  indexes: {
    lalulIntas: 1.14,
    bgmMarina: 0.97,
    tollBgm: 1.33,
    tollPik2: 0.53,
  },
  areaVehicles: {
    bgm: 850,
    gi: 220,
    rwi: 470,
  }
};

function computeStage(vehicles) {
  if (vehicles < 800) return 1;
  if (vehicles < 1200) return 2;
  if (vehicles < 1600) return 3;
  if (vehicles < 2000) return 4;
  return 5;
}

export default function App() {
  // BACA DARI LOCAL STORAGE AGAR TIDAK LOGOUT SAAT REFRESH
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("cc_isLoggedIn") === "true";
    }
    return false;
  });

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("cc_activeTab") || "dashboard";
    }
    return "dashboard";
  });

  const [data, setData] = useState(INITIAL);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth <= 768 : false);

  // SIMPAN STATE KE LOCAL STORAGE SAAT ADA PERUBAHAN
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("cc_isLoggedIn", isLoggedIn);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("cc_activeTab", activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end: new Date(today.getFullYear(), today.getMonth() + 1, 0)
    };
  });

  const handleLogout = () => {
    setIsLoggedIn(false);
    setActiveTab("dashboard");
    if (typeof window !== "undefined") {
      localStorage.removeItem("cc_isLoggedIn");
      localStorage.removeItem("cc_activeTab");
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;

    const id = setInterval(() => {
      setData(prev => {
        const delta = Math.floor((Math.random() - 0.45) * 8);
        const newTotal = Math.max(100, prev.totalVehicles + delta);
        const newStage = computeStage(newTotal);

        return {
          ...prev,
          totalVehicles: newTotal,
          totalIn: prev.totalIn + Math.floor(Math.random() * 4),
          totalOut: prev.totalOut + Math.floor(Math.random() * 3),
          stage: newStage,
          areaVehicles: { 
            bgm: Math.max(50, prev.areaVehicles.bgm + Math.floor((Math.random() - 0.4) * 12)), 
            gi: Math.max(20, prev.areaVehicles.gi + Math.floor((Math.random() - 0.45) * 6)), 
            rwi: Math.max(30, prev.areaVehicles.rwi + Math.floor((Math.random() - 0.42) * 8)) 
          }
        };
      });
    }, 3000);

    return () => {
      clearInterval(id);
    };
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="app-wrapper" style={{ minHeight: "100vh", background: "#F1F5F9" }}>
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout}
        dateRange={dateRange}
        onDateChange={setDateRange}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isMobile={isMobile}
      />

      <div 
        className="page-content"
        style={{
          marginLeft: isMobile ? "0px" : (isSidebarOpen ? "260px" : "0px"),
          paddingTop: "70px",
          paddingLeft: "20px",
          paddingRight: "20px",
          paddingBottom: "20px",
          transition: "margin-left 0.3s ease",
          boxSizing: "border-box",
          minHeight: "100vh"
        }}
      >
        <div style={{ display: activeTab === "dashboard" ? "block" : "none" }}>
          <AlertBanner stage={data.stage} />
          <SummaryCards data={data} />
          <TrafficCharts data={data} />
          <HeatmapMap areaVehicles={data.areaVehicles} />
        </div>
        
        <div style={{ display: activeTab === "traffic" ? "block" : "none" }}>
          <CctvGrid />
        </div>

        <div style={{ display: activeTab === "callcenter" ? "block" : "none" }}>
          <CallCenterDashboard dateRange={dateRange} />
        </div>

        <div style={{ display: activeTab === "cctv" ? "block" : "none" }}>
          <CctvDashboard />
        </div>
      </div>
    </div>
  );
}