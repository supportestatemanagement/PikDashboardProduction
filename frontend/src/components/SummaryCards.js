"use client";

const stageConfig = {
  1: { label: "STAGE 1", color: "#10B981", bg: "linear-gradient(135deg,#065F46,#059669)", status: "Kondisi Normal" },
  2: { label: "STAGE 2", color: "#3B82F6", bg: "linear-gradient(135deg,#1E40AF,#3B82F6)", status: "Ramai Lancar" },
  3: { label: "STAGE 3", color: "#F59E0B", bg: "linear-gradient(135deg,#92400E,#D97706)", status: "Kepadatan Sedang" },
  4: { label: "STAGE 4", color: "#EF4444", bg: "linear-gradient(135deg,#7F1D1D,#DC2626)", status: "Hampir Macet" },
  5: { label: "STAGE 5", color: "#EC4899", bg: "linear-gradient(135deg,#831843,#DB2777)", status: "MACET TOTAL" },
};

function IndexCard({ label, value, statusLabel, statusColor, dotColor }) {
  return (
    <div className="card card-index">
      <div className="card-label">{label}</div>
      <div className="index-value" style={{ color: statusColor || "#0F2057" }}>{value}</div>
      <div className="index-status">
        <div className="status-dot" style={{ background: dotColor || statusColor }} />
        <span style={{ color: dotColor || statusColor }}>{statusLabel}</span>
      </div>
    </div>
  );
}

export default function SummaryCards({ data }) {
  const { totalVehicles, stage, indexes } = data;
  const stageCfg = stageConfig[stage] || stageConfig[1];

  return (
    <div className="summary-grid">
      {/* Total Kendaraan */}
      <div className="card card-vehicles">
        <div className="card-label">KENDARAAN DALAM PIK</div>
        <div className="card-value">{totalVehicles.toLocaleString("id-ID")}</div>
        <div className="live-chip">
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981" }} />
          <span>Live Update</span>
        </div>
      </div>

      {/* Stage */}
      <div className="card card-stage" style={{ background: stageCfg.bg }}>
        <div className="card-label" style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase" }}>STAGE</div>
        <div className="stage-value" style={{ color: "#fff", fontFamily: "'Rajdhani',sans-serif", fontSize: 32, fontWeight: 700, lineHeight: 1.1, margin: "4px 0" }}>
          {stageCfg.label}
        </div>
        <div className="stage-status" style={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>{stageCfg.status}</div>
      </div>

      {/* Index Cards */}
      <IndexCard
        label="INDEKS ARUS LALU LINTAS"
        value={indexes.lalulIntas}
        statusLabel="LANCAR"
        statusColor="#10B981"
        dotColor="#10B981"
      />
      <IndexCard
        label="INDEKS ARUS BGM MARINA"
        value={indexes.bgmMarina}
        statusLabel="LANCAR"
        statusColor="#10B981"
        dotColor="#10B981"
      />
      <IndexCard
        label="INDEKS ARUS TOLL BGM"
        value={indexes.tollBgm}
        statusLabel={indexes.tollBgm > 1.2 ? "POTENSI MACET" : "LANCAR"}
        statusColor={indexes.tollBgm > 1.2 ? "#EF4444" : "#10B981"}
        dotColor={indexes.tollBgm > 1.2 ? "#EF4444" : "#10B981"}
      />
      <IndexCard
        label="INDEKS ARUS TOLL PIK 2"
        value={indexes.tollPik2}
        statusLabel="ARUS KELUAR DOMINAN"
        statusColor="#F59E0B"
        dotColor="#F59E0B"
      />
    </div>
  );
}