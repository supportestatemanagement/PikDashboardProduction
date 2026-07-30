"use client";
import { useState, useEffect, useRef } from "react";

// Komponen Reusable untuk Share Screen
function ShareScreenCard({ title, apiEndpoint, intervalMs }) {
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);

  const handleShareScreen = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setStream(mediaStream);
    } catch (err) {
      console.error(`Error share screen ${title}:`, err);
    }
  };

  const handleStopShare = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const captureAndSend = async (video) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);
      
      // JPEG dengan kompresi 70% agar ringan dikirim dan lolos CORS
      const base64 = canvas.toDataURL("image/jpeg", 0.7); 

      console.log(`[CAPTURE] Mengirim data ${title} ke server...`);
      
      const res = await fetch(`${process.env.REACT_APP_API_URL}${apiEndpoint}`, {
        method: "POST",
        mode: "cors",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ image: base64 }),
      });

      if (!res.ok) {
        throw new Error(`Server merespons dengan status: ${res.status}`);
      }

      const data = await res.json();
      console.log(`[SUCCESS] ${title}:`, data);
    } catch (err) {
      console.error(`[FETCH ERROR] ${title}:`, err);
    }
  };

  useEffect(() => {
    if (!stream) return;
    
    // Looping interval
    const interval = setInterval(() => {
      if (videoRef.current) {
        captureAndSend(videoRef.current);
      }
    }, intervalMs);
    
    return () => clearInterval(interval);
  }, [stream, intervalMs]);

  const buttonStyle = {
    padding: "8px 16px",
    fontSize: "12px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    color: "white",
    fontWeight: "bold",
    transition: "opacity 0.2s"
  };

  return (
    <div style={{ background: "white", borderRadius: "12px", border: "1px solid #E2E8F0", overflow: "hidden", display: "flex", flexDirection: "column", height: "100%", minHeight: "450px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "#1E3A8A", color: "white" }}>
        <span style={{ fontWeight: "800", letterSpacing: "0.5px" }}>{title}</span>
        {!stream ? (
          <button onClick={handleShareScreen} style={{ ...buttonStyle, backgroundColor: "#10B981" }}>Mulai Share Screen</button>
        ) : (
          <button onClick={handleStopShare} style={{ ...buttonStyle, backgroundColor: "#EF4444" }}>Stop Share</button>
        )}
      </div>
      
      <div style={{ flex: 1, background: "#0F172A", position: "relative" }}>
        {stream ? (
          <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "contain", position: "absolute", top: 0, left: 0 }} />
        ) : (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "#475569", fontWeight: "bold", textAlign: "center" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: "10px", opacity: 0.5, margin: "0 auto" }}>
              <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
              <polyline points="17 2 12 7 7 2"></polyline>
            </svg>
            <div>BELUM ADA TANGKAPAN LAYAR</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CctvGrid() {
  const INTERVAL_TIME = 10000; // 10 detik untuk testing. (Ubah ke 1800000 jika sudah selesai testing)

  return (
    <div style={{ padding: "10px" }}>
      <div style={{ marginBottom: "20px", color: "#1E3A8A", fontWeight: "800", fontSize: "18px" }}>
        CONTROL PANEL OCR AUTOMATION
      </div>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", gap: "24px" }}>
        {/* Card HCP */}
        <ShareScreenCard 
          title="HCP MONITORING (Hikvision)" 
          apiEndpoint="/api/upload-hcp-grid" 
          intervalMs={INTERVAL_TIME} 
        />
        
        {/* Card Dahua */}
        <ShareScreenCard 
          title="DAHUA MONITORING (DSS)" 
          apiEndpoint="/api/upload-dahua-grid" 
          intervalMs={INTERVAL_TIME} 
        />
      </div>
    </div>
  );
}