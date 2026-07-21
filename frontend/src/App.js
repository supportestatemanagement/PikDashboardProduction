"use client";
import { useState, useEffect, useMemo } from "react";
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
  const [callCenterData, setCallCenterData] = useState([]); // Inisialisasi array kosong
  const [isLoading, setIsLoading] = useState(true); // State loading untuk memantau koneksi API

  const [dateRange, setDateRange] = useState({
    start: new Date(),
    end: new Date()
  });

  const handleLogout = () => {
    setIsLoggedIn(false);
    setActiveTab("dashboard");
  };

  /**
   * PERBAIKAN 1: Fungsi pembantu untuk membaca tanggal format DD/MM/YYYY dari sheet.
   * Ini memastikan tanggal 01/01/2026 terbaca benar di semua browser.
   */
  const parseSheetDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = String(dateStr).split('/');
    if (parts.length === 3) {
      // Format: Day, Month (0-indexed), Year
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  /**
   * PERBAIKAN 2: Fetch data dengan penanganan status Loading.
   */
  const fetchCCData = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/call-center-data");
      const result = await response.json();
      if (result.status === "success") {
        setCallCenterData(result.data);
      }
    } catch (error) {
      console.error("Gagal mengambil data CC:", error);
    } finally {
      setIsLoading(false); // Selesai proses ambil data[cite: 28]
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;

    fetchCCData();
    const ccInterval = setInterval(fetchCCData, 15000); // Polling setiap 15 detik agar lebih ringan[cite: 23]

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
      clearInterval(ccInterval);
    };
  }, [isLoggedIn]);


  /**
   * PERBAIKAN 3: Logika filter menggunakan parser khusus untuk akurasi tanggal.
   */
  const filteredCCData = useMemo(() => {
    if (!callCenterData || callCenterData.length === 0) return [];
    
    return callCenterData.filter(row => {
      const rowDateRaw = row.Tanggal || row.Date;
      const rowDate = parseSheetDate(rowDateRaw); // Gunakan parser khusus[cite: 29]
      
      if (!rowDate) return false;

      // Reset waktu ke 00:00:00 untuk perbandingan presisi tanggal[cite: 21]
      const d = new Date(rowDate.getFullYear(), rowDate.getMonth(), rowDate.getDate()).getTime();
      const s = new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), dateRange.start.getDate()).getTime();
      const e = new Date(dateRange.end.getFullYear(), dateRange.end.getMonth(), dateRange.end.getDate()).getTime();

      return d >= s && d <= e;
    });
  }, [callCenterData, dateRange]);


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
          {/* PERBAIKAN 4: Kirim filteredCCData dan status isLoading ke dashboard */}
          <CallCenterDashboard data={filteredCCData} isLoading={isLoading} />
        </div>

        <div style={{ display: activeTab === "cctv" ? "block" : "none" }}>
          <CctvDashboard />
        </div>
      </div>
    </div>
  );
}