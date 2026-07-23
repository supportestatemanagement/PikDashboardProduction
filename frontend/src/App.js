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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [data, setData] = useState(INITIAL);

  // State untuk menyimpan rentang tanggal dari Navbar
  const [dateRange, setDateRange] = useState({
    start: new Date(),
    end: new Date()
  });

  const handleLogout = () => {
    setIsLoggedIn(false);
    setActiveTab("dashboard");
  };

  useEffect(() => {
    if (!isLoggedIn) return;

    // Simulasi traffic data
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
    <div className="app-wrapper">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout}
        dateRange={dateRange}
        onDateChange={setDateRange}
      />

      <div className="page-content">
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
          {/* MENGIRIM DATERANGE KE CALL CENTER DASHBOARD */}
          <CallCenterDashboard dateRange={dateRange} />
        </div>

        <div style={{ display: activeTab === "cctv" ? "block" : "none" }}>
          <CctvDashboard />
        </div>
      </div>
    </div>
  );
}