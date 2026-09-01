"use client";
import { useState, useEffect } from "react";
import "./global.css";
import Login from "./components/Login";
import Navbar from "./components/Navbar";
import TrafficDashboard from "./components/TrafficDashboard";
import CallCenterDashboard from "./components/CallCenterDashboard";
import CctvDashboard from "./components/CctvDashboard";
import PerparkiranDashboard from "./components/PerparkiranDashboard";

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
      const savedTab = localStorage.getItem("cc_activeTab");
      return savedTab === "traffic" ? "dashboard" : (savedTab || "dashboard");
    }
    return "dashboard";
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
    document.body.classList.toggle("traffic-dashboard-body", activeTab === "dashboard" && isLoggedIn);
    return () => document.body.classList.remove("traffic-dashboard-body");
  }, [activeTab, isLoggedIn]);

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

  const handleLogout = () => {
    setIsLoggedIn(false);
    setActiveTab("dashboard");
    if (typeof window !== "undefined") {
      localStorage.removeItem("cc_isLoggedIn");
      localStorage.removeItem("cc_activeTab");
    }
  };

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className={`app-wrapper ${activeTab === "dashboard" ? "traffic-active" : ""}`}>
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
          paddingTop: "60px",
          paddingLeft: activeTab === "dashboard" ? "0" : (isMobile ? "10px" : "20px"),
          paddingRight: activeTab === "dashboard" ? "0" : (isMobile ? "10px" : "20px"),
          paddingBottom: activeTab === "dashboard" ? "0" : (isMobile ? "10px" : "20px"),
          transition: "margin-left 0.3s ease",
          boxSizing: "border-box",
          minHeight: "100vh"
        }}
      >
        <div style={{ display: activeTab === "dashboard" ? "block" : "none" }}>
          <TrafficDashboard dateRange={dateRange} />
        </div>
        
        <div style={{ display: activeTab === "callcenter" ? "block" : "none" }}>
          <CallCenterDashboard
            dateRange={dateRange} 
            isSidebarOpen={isSidebarOpen}
          />
        </div>

        <div style={{ display: activeTab === "cctv" ? "block" : "none" }}>
          <CctvDashboard />
        </div>

        <div style={{ display: activeTab === "perparkiran" ? "block" : "none" }}>
          <PerparkiranDashboard 
            dateRange={dateRange} 
            isSidebarOpen={isSidebarOpen}
          />
        </div>

      </div>
    </div>
  );
}
