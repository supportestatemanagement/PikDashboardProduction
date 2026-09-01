export const TRAFFIC_STAGE_CONFIG = [
  { stage: 1, max: 20000, label: "Lancar", color: "#22c55e" },
  { stage: 2, max: 30000, label: "Ramai Lancar", color: "#eab308" },
  { stage: 3, max: 40000, label: "Padat", color: "#f97316" },
  { stage: 4, max: 50000, label: "Sangat Padat", color: "#ef4444" },
  { stage: 5, max: Infinity, label: "Kritis", color: "#dc2626" },
];

// Polygon thresholds are intentionally listed separately.
// Edit each area's max values independently without affecting another polygon.
export const AREA_TRAFFIC_STAGE_CONFIG = {
  BGM: [
    { stage: 1, max: 20000, label: "Lancar", color: "#22c55e" },
    { stage: 2, max: 30000, label: "Ramai Lancar", color: "#eab308" },
    { stage: 3, max: 40000, label: "Padat", color: "#f97316" },
    { stage: 4, max: 50000, label: "Sangat Padat", color: "#ef4444" },
    { stage: 5, max: Infinity, label: "Kritis", color: "#dc2626" },
  ],

  GI: [
    { stage: 1, max: 15000, label: "Lancar", color: "#22c55e" },
    { stage: 2, max: 30000, label: "Ramai Lancar", color: "#eab308" },
    { stage: 3, max: 40000, label: "Padat", color: "#f97316" },
    { stage: 4, max: 50000, label: "Sangat Padat", color: "#ef4444" },
    { stage: 5, max: Infinity, label: "Kritis", color: "#dc2626" },
  ],

  RWI: [
    { stage: 1, max: 10000, label: "Lancar", color: "#22c55e" },
    { stage: 2, max: 30000, label: "Ramai Lancar", color: "#eab308" },
    { stage: 3, max: 40000, label: "Padat", color: "#f97316" },
    { stage: 4, max: 50000, label: "Sangat Padat", color: "#ef4444" },
    { stage: 5, max: Infinity, label: "Kritis", color: "#dc2626" },
  ],
};

export const CHECKPOINTS = [
  { key: "bgm", label: "CP BGM", column: "CP-BGM", color: "#38bdf8" },
  { key: "linggi", label: "CP Linggi", column: "CP-Linggi", color: "#a78bfa" },
  { key: "tataban", label: "CP Tataban", column: "CP-Tataban", color: "#34d399" },
  { key: "baruyungan", label: "CP Baruyungan", column: "CP-Baruyungan", color: "#fbbf24" },
  { key: "kataraja", label: "CP Toll Kataraja", column: "CP-TollKataraja", color: "#fb7185" },
];
