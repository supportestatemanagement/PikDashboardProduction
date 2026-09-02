import { toApiDate } from "./trafficService";

const API_URL = process.env.REACT_APP_API_URL || "";

export async function fetchPumpAnalytics(dateRange, station, signal) {
  const params = new URLSearchParams({ startDate: toApiDate(dateRange.start), endDate: toApiDate(dateRange.end), station, limit: "5" });
  const response = await fetch(`${API_URL}/api/pump-peak-events?${params}`, { signal });
  const payload = await response.json();
  if (!response.ok || payload.status !== "success") throw new Error(payload.message || "Gagal mengambil data pump station");
  return payload;
}

