"use client";
import React, { useState, useEffect } from "react";

export default function PerparkiranDashboard() {
  const [bgmData, setBgmData] = useState([]);
  const [giData, setGiData] = useState([]);
  const [rwiData, setRwiData] = useState([]);
  const [totalTiket, setTotalTiket] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sesuaikan URL dengan port backend Flask Anda
    fetch(`${process.env.REACT_APP_API_URL || ""}/api/perparkiran-data`)
      .then((res) => res.json())
      .then((res) => {
        if (res.status === "success") {
          const data = res.data;
          setTotalTiket(data.length);

          // Fungsi utilitas untuk memproses area tertentu
          const processArea = (areaName) => {
            const filtered = data.filter((item) => {
              const area = String(item.Area || "").trim().toUpperCase();
              return area === areaName;
            });

            const counts = {};
            filtered.forEach((item) => {
              const issue = String(item.Detailed || "").trim().toLowerCase();
              if (issue && issue !== "unknown") {
                counts[issue] = (counts[issue] || 0) + 1;
              }
            });

            return Object.keys(counts)
              .map((key) => ({ label: key, val: counts[key] }))
              .sort((a, b) => b.val - a.val); // Sort descending
          };

          setBgmData(processArea("BGM"));
          setGiData(processArea("GI"));
          setRwiData(processArea("RWI"));
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching Perparkiran data:", err);
        setLoading(false);
      });
  }, []);

  // Menentukan nilai maksimum untuk skala progress bar
  const maxBgm = bgmData.length > 0 ? bgmData[0].val : 10;
  const maxGi = giData.length > 0 ? giData[0].val : 10;
  const maxRwi = rwiData.length > 0 ? rwiData[0].val : 10;

  // Warna sesuai gambar referensi
  const colors = {
    BGM: "#22C55E", // Hijau
    GI: "#3B82F6",  // Biru
    RWI: "#EAB308", // Kuning/Gold
  };

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
        /* Custom Scrollbar untuk area list isian yang panjang */
        .custom-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scroll::-webkit-scrollbar-track {
          background: #f1f5f9; 
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1; 
          border-radius: 4px;
        }
      `}</style>

      <div
        style={{
          padding: "2px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          background: "#F1F5F9",
          minHeight: "100vh",
          color: "#1E3A8A",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {/* ROW 1: KARTU SUMMARY */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
          
          {/* Card Total Tiket */}
          <div
            className="animate-card"
            style={{
              animationDelay: "0s",
              background: "#1E3A8A",
              color: "white",
              padding: "20px 24px",
              borderRadius: "12px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ fontWeight: "800", fontSize: "14px", color: "white", marginBottom: "10px" }}>
              Total Tiket Perparkiran
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
              <div style={{ fontSize: "68px", fontWeight: "800", fontFamily: "'Rajdhani', sans-serif", lineHeight: "1" }}>
                {loading ? "..." : totalTiket}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.8, letterSpacing: "2px", marginTop: "5px" }}>
                TIKET TERCATAT
              </div>
            </div>
          </div>
          
          {/* Anda bisa menambahkan card summary tambahan di sini jika diperlukan, seperti rata-rata harian dsb */}
        </div>

        {/* ROW 2: TOP ISSUES PERPARKIRAN (Sesuai Referensi Gambar) */}
        <div className="animate-card" style={{ animationDelay: "0.2s", background: "white", borderRadius: "12px", padding: "24px", border: "1px solid #E2E8F0" }}>
          
          <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#475569", margin: 0 }}>Top Issues Perparkiran</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "30px" }}>
            
            {/* Kolom BGM */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <h3 style={{ textAlign: "center", color: colors.BGM, fontSize: "20px", fontWeight: "800", marginBottom: "20px" }}>BGM</h3>
              <div className="custom-scroll" style={{ maxHeight: "400px", overflowY: "auto", paddingRight: "10px" }}>
                {loading ? <div style={{ fontSize: "12px", textAlign: "center" }}>Memuat...</div> : null}
                {bgmData.map((item, idx) => (
                  <HorizontalBar key={idx} label={item.label} val={item.val} max={maxBgm} color={colors.BGM} />
                ))}
              </div>
            </div>

            {/* Kolom GI */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <h3 style={{ textAlign: "center", color: colors.GI, fontSize: "20px", fontWeight: "800", marginBottom: "20px" }}>GI</h3>
              <div className="custom-scroll" style={{ maxHeight: "400px", overflowY: "auto", paddingRight: "10px" }}>
                {loading ? <div style={{ fontSize: "12px", textAlign: "center" }}>Memuat...</div> : null}
                {giData.map((item, idx) => (
                  <HorizontalBar key={idx} label={item.label} val={item.val} max={maxGi} color={colors.GI} />
                ))}
              </div>
            </div>

            {/* Kolom RWI */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <h3 style={{ textAlign: "center", color: colors.RWI, fontSize: "20px", fontWeight: "800", marginBottom: "20px" }}>RWI</h3>
              <div className="custom-scroll" style={{ maxHeight: "400px", overflowY: "auto", paddingRight: "10px" }}>
                {loading ? <div style={{ fontSize: "12px", textAlign: "center" }}>Memuat...</div> : null}
                {rwiData.map((item, idx) => (
                  <HorizontalBar key={idx} label={item.label} val={item.val} max={maxRwi} color={colors.RWI} />
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}

// ==========================================
// UI HELPER COMPONENTS
// ==========================================

// Komponen Bar Chart Horizontal Custom untuk Top Issues
function HorizontalBar({ label, val, max, color }) {
  // Hindari pembagian dengan 0
  const percentage = max > 0 ? (val / max) * 100 : 0;
  
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: "12px", gap: "12px" }}>
      {/* Area Text / Label (Di sebelah kiri) */}
      <div 
        style={{ 
          width: "100px", 
          flexShrink: 0,
          textAlign: "right", 
          fontSize: "10px", 
          fontWeight: "600", 
          color: "#475569", 
          lineHeight: "1.3",
          textTransform: "capitalize"
        }}
      >
        {label}
      </div>
      
      {/* Area Bar (Membentang ke kanan) */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", position: "relative" }}>
        {/* Background bayangan bar (opsional, jika ingin ada efek track) */}
        <div style={{ position: "absolute", width: "100%", height: "24px", background: "transparent" }}></div>
        
        {/* Bar Utama (Warna 3D effect tipis) */}
        <div 
          style={{ 
            width: `${Math.max(percentage, 5)}%`, // Minimal 5% agar angka tetap terlihat
            height: "26px", 
            background: color, 
            borderRadius: "0 4px 4px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingRight: "8px",
            color: "white",
            fontSize: "11px",
            fontWeight: "bold",
            transition: "width 0.8s ease-out",
            boxShadow: "inset 0px -3px 0px rgba(0,0,0,0.15)" // Efek sedikit 3D seperti di foto
          }}
        >
          {val}
        </div>
      </div>
    </div>
  );
}