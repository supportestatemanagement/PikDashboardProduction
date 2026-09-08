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

// Leaflet positions use [latitude, longitude]. Both BGM entrances share CP-BGM.
export const CHECKPOINT_ENTRANCES = [
  { id: "bgm-marina", key: "bgm", label: "BGM Marina", position: [-6.112819, 106.7506143], side: "right" },
  { id: "bgm-toll", key: "bgm", label: "BGM Toll", position: [-6.1138235, 106.736195], side: "left" },
  { id: "linggi", key: "linggi", label: "Linggi", position: [-6.0954297, 106.742163], side: "left" },
  { id: "tataban", key: "tataban", label: "Tataban", position: [-6.0903949, 106.7429506], side: "right" },
  { id: "baruyungan", key: "baruyungan", label: "Baruyungan", position: [-6.0852819, 106.7260539], side: "left" },
  { id: "kataraja", key: "kataraja", label: "Toll Kataraja", position: [-6.0682757, 106.6953191], side: "left" },
];
