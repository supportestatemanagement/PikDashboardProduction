"use client";
import { useState } from "react";

export default function AlertBanner({ stage }) {
  const [visible, setVisible] = useState(true);
  if (!visible || stage < 3) return null;

  const msg =
    stage >= 5 ? "🚨 DARURAT: Kemacetan parah terdeteksi! Aktifkan protokol evakuasi segera."
    : stage === 4 ? "⚠️ WASPADA: Kepadatan tinggi di area BGM & Toll. Koordinasikan petugas lapangan."
    : "⚠️ PERHATIAN: Volume kendaraan mendekati batas Stage 3. Pantau kondisi aktif.";

  return (
    <div className="alert-banner">
      <span className="alert-icon">🔔</span>
      <span className="alert-text">{msg}</span>
      <span className="alert-close" onClick={() => setVisible(false)}>✕</span>
    </div>
  );
}