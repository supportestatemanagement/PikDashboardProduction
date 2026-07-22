"use client";
import { useState, useEffect, useRef } from "react";

const GATES = [
  { id: 1, name: "Marina In", zone: "Zona A" },
  { id: 2, name: "Marina Out", zone: "Zona A" },
  { id: 3, name: "Linggi In 1", zone: "Zona A" },
  { id: 4, name: "Linggi In 2", zone: "Zona A" },
  { id: 5, name: "Linggi Out", zone: "Zona A" },
  { id: 6, name: "Tataban In", zone: "Zona B" },
  { id: 7, name: "Tataban Out", zone: "Zona B" },
  { id: 8, name: "Baruyungan In", zone: "Zona B" },
  { id: 9, name: "Baruyungan Out", zone: "Zona C" },
  { id: 10, name: "Toll Kataraja In", zone: "Zona C" },
  { id: 11, name: "Toll Kataraja Out", zone: "Zona C" },
];

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function CctvCard({ gate, stats, time }) {
  const [stream, setStream] = useState(null);

  const videoRef = useRef(null);
  const lastMinuteRef = useRef(null);

  const handleShareScreen = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      setStream(mediaStream);
    } catch (err) {
      console.error("Error share screen:", err);
    }
  };

  // Fungsi baru untuk menghentikan screen sharing
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
      const base64 = canvas.toDataURL("image/png");

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gate: gate.name,
          image: base64,
        }),
      });

      const data = await res.json();
      console.log("SUCCESS:", data);
    } catch (err) {
      console.error("FETCH ERROR:", err);
    }
  };

  useEffect(() => {
    if (!stream) return;
    const interval = setInterval(() => {
      const now = new Date();
      if (now.getSeconds() % 10 === 0 && lastMinuteRef.current !== now.getSeconds()) {
        lastMinuteRef.current = now.getSeconds();
        if (videoRef.current) {
          captureAndSend(videoRef.current);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [stream]);

  // Gaya tombol kecil dan berwarna
  const buttonStyle = {
    padding: "3px 8px",
    fontSize: "10px",
    borderRadius: "4px",
    border: "none",
    cursor: "pointer",
    color: "white",
    fontWeight: "bold",
    transition: "opacity 0.2s"
  };

  return (
    <div className="cctv-card">
      <div className="cctv-header">
        <span>{gate.name}</span>
        {/* Tombol kondisional: Share atau Stop Share */}
        {!stream ? (
          <button 
            onClick={handleShareScreen} 
            style={{ ...buttonStyle, backgroundColor: "#3B82F6" }}
          >
            Share
          </button>
        ) : (
          <button 
            onClick={handleStopShare} 
            style={{ ...buttonStyle, backgroundColor: "#EF4444" }}
          >
            Stop Share
          </button>
        )}
      </div>

      <div className="cctv-screen">
        {stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div className="cctv-share-text">NO SIGNAL</div>
        )}

        <span className="cctv-timestamp">{time}</span>

        {/* Teks statistik IN/OUT telah dihapus sesuai instruksi[cite: 36] */}
      </div>
    </div>
  );
}

export default function CctvGrid() {
  const [stats, setStats] = useState(() =>
    GATES.reduce((acc, g) => {
      acc[g.id] = { in: rand(40, 400), out: rand(30, 350) };
      return acc;
    }, {})
  );

  const [time, setTime] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div className="cctv-grid">
        {GATES.map((gate) => (
          <CctvCard
            key={gate.id}
            gate={gate}
            stats={stats[gate.id] || { in: 0, out: 0 }}
            time={time}
          />
        ))}
      </div>
    </div>
  );
}