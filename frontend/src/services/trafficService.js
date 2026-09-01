import { AREA_TRAFFIC_STAGE_CONFIG, CHECKPOINTS, TRAFFIC_STAGE_CONFIG } from "../config/trafficConfig";

const API_URL = process.env.REACT_APP_API_URL || "";

export const formatInteger = (value) => Math.round(Number(value) || 0).toLocaleString("id-ID");

export const toApiDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function getTrafficStage(total) {
  return TRAFFIC_STAGE_CONFIG.find((item) => total <= item.max) || TRAFFIC_STAGE_CONFIG.at(-1);
}

export function getAreaTrafficStage(area, total) {
  const config = AREA_TRAFFIC_STAGE_CONFIG[String(area).toUpperCase()] || TRAFFIC_STAGE_CONFIG;
  return config.find((item) => total <= item.max) || config.at(-1);
}

export function mapTrafficDashboard(payload) {
  const source = payload.summary || {};
  const normalizeKey = (key) => String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedSource = Object.fromEntries(
    Object.entries(source).map(([key, value]) => [normalizeKey(key), value])
  );
  const read = (...keys) => {
    const matchedKey = keys.map(normalizeKey).find((key) => key in normalizedSource);
    return Number(normalizedSource[matchedKey]) || 0;
  };
  const vehicles = {
    bgm: read("VehicleIN-BGM", "Vehicle IN - BGM"),
    gi: read("VehicleIN-GI", "Vehicle IN - GI"),
    rwi: read("VehicleIN-RWI", "Vehicle IN - RWI"),
    pik2: read("VehicleIN-PIK2", "Vehicle IN - PIK2"),
  };
  vehicles.pik1 = vehicles.bgm + vehicles.gi + vehicles.rwi;

  const checkpoints = Object.fromEntries(
    CHECKPOINTS.map(({ key, column }) => [key, read(column)])
  );
  const totalVehicles = read("TotalPengunjung", "Total Pengunjung");

  return {
    totalVehicles,
    vehicles,
    checkpoints,
    stage: getTrafficStage(totalVehicles),
    hourly: payload.hourly || [],
    meta: payload.meta || {},
  };
}

export async function fetchTrafficDashboard(dateRange, signal) {
  const params = new URLSearchParams({
    startDate: toApiDate(dateRange.start),
    endDate: toApiDate(dateRange.end),
  });
  const response = await fetch(`${API_URL}/api/traffic-dashboard?${params}`, { signal });
  const payload = await response.json();
  if (!response.ok || payload.status !== "success") {
    throw new Error(payload.message || "Gagal mengambil data traffic");
  }
  return mapTrafficDashboard(payload);
}
