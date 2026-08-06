"use client";
import { useState, useEffect, useRef } from "react";

// 1. KEMBALIKAN GATES DARI DEVELOPMENT (5 Kamera)
const GATES = [
  { id: 1, name: "Marina In" },
  { id: 2, name: "Marina Out" },
  { id: 3, name: "Toll Kataraja In" },
  { id: 4, name: "Toll Kataraja Out" },
  { id: 5, name: "BGM In" },
];

// ================= SISTEM ANTREAN PENGIRIMAN =================
// Sistem antrean agar kelima kamera tidak menembak API di detik yang persis sama
const uploadQueue = [];
let isProcessingQueue = false;

const processUploadQueue = async () => {
  if (isProcessingQueue || uploadQueue.length === 0) return;

  isProcessingQueue = true;
  const { gateName, payload } = uploadQueue.shift();

  try {
    console.log(`[CAPTURE] Mengirim data ${gateName} ke server...`);
    
    // Gunakan environment variable jika ada, jika tidak fallback ke localhost
    const baseUrl = process.env.REACT_APP_API_URL || "http://localhost:5000"; 
    
    // Menembak ke endpoint upload-image yang membaca 1 gate per request
    const res = await fetch(`${baseUrl}/api/upload-image`, {
      method: "POST",
      mode: "cors",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Server merespons dengan status: ${res.status}`);
    }

    const data = await res.json();
    console.log(`[SUCCESS] ${gateName}:`, data);
  } catch (err) {
    console.error(`[FETCH ERROR] ${gateName}:`, err);
  } finally {
    isProcessingQueue = false;
    processUploadQueue(); // Panggil lagi untuk memproses antrean berikutnya
  }
};
// =============================================================

function CctvCard({ gate, time }) {
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);
  const lastSecondRef = useRef(null);

  const handleShareScreen = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setStream(mediaStream);
    } catch (err) {
      console.error(`Error share screen ${gate.name}:`, err);
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

  const captureAndQueue = (video) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);
      
      // Menggunakan JPEG kompresi 70% agar lebih ringan di jaringan
      const base64 = canvas.toDataURL("image/jpeg", 0.7); 

      // Masukkan ke antrean, kirim nama gate dan base64-nya
      uploadQueue.push({
        gateName: gate.name,
        payload: { 
          gate: gate.name,
          image: base64 
        }
      });

      processUploadQueue();
    } catch (err) {
      console.error(`[CAPTURE ERROR] ${gate.name}:`, err);
    }
  };

  useEffect(() => {
    if (!stream) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      // Trigger setiap 10 detik secara presisi
      if (now.getSeconds() % 10 === 0 && lastSecondRef.current !== now.getSeconds()) {
        lastSecondRef.current = now.getSeconds();
        if (videoRef.current) {
          captureAndQueue(videoRef.current);
        }
      }
    }, 1000); 
    
    return () => clearInterval(interval);
  }, [stream]);

  const buttonStyle = {
    padding: "6px 12px",
    fontSize: "11px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    color: "white",
    fontWeight: "bold",
    transition: "opacity 0.2s"
  };

  return (
    <div style={{ background: "white", borderRadius: "12px", border: "1px solid #E2E8F0", overflow: "hidden", display: "flex", flexDirection: "column", height: "350px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#1E3A8A", color: "white" }}>
        <span style={{ fontWeight: "800", fontSize: "14px" }}>{gate.name}</span>
        {!stream ? (
          <button onClick={handleShareScreen} style={{ ...buttonStyle, backgroundColor: "#10B981" }}>Share Screen</button>
        ) : (
          <button onClick={handleStopShare} style={{ ...buttonStyle, backgroundColor: "#EF4444" }}>Stop Share</button>
        )}
      </div>
      
      <div style={{ flex: 1, background: "#0F172A", position: "relative" }}>
        {stream ? (
          <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "#475569", fontWeight: "bold", fontSize: "12px", textAlign: "center" }}>
            NO SIGNAL
          </div>
        )}
        <span style={{ position: "absolute", bottom: "10px", right: "10px", background: "rgba(0,0,0,0.6)", color: "white", padding: "4px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold" }}>
          {time}
        </span>
      </div>
    </div>
  );
}

export default function CctvGrid() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ marginBottom: "20px", color: "#1E3A8A", fontWeight: "800", fontSize: "18px" }}>
        CONTROL PANEL OCR AUTOMATION
      </div>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "20px" }}>
        {GATES.map((gate) => (
          <CctvCard key={gate.id} gate={gate} time={time} />
        ))}
      </div>
    </div>
  );
}