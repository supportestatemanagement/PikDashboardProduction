import { CHECKPOINTS, TRAFFIC_STAGE_CONFIG } from "../config/trafficConfig";

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

export function mapTrafficDashboard(payload) {
  const source = payload.summary || {};
  const vehicles = {
    bgm: Number(source["Vehicle IN - BGM"]) || 0,
    gi: Number(source["Vehicle IN - GI"]) || 0,
    rwi: Number(source["Vehicle IN- RWI"]) || 0,
    pik2: Number(source["Vehicle IN - PIK2"]) || 0,
  };
  vehicles.pik1 = vehicles.bgm + vehicles.gi + vehicles.rwi;

  const checkpoints = Object.fromEntries(
    CHECKPOINTS.map(({ key, column }) => [key, Number(source[column]) || 0])
  );
  const totalVehicles = Number(source["Total Pengunjung"]) || 0;

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

