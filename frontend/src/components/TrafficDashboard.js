import { useEffect, useState } from "react";
import HeatmapMap from "./HeatmapMap";
import SummaryCards from "./SummaryCards";
import TrafficCharts from "./TrafficCharts";
import MonthlyTrafficChart from "./MonthlyTrafficChart";
import { fetchTrafficDashboard, fetchWaterLocations } from "../services/trafficService";

export default function TrafficDashboard({ dateRange, isActive = true }) {
  const [traffic, setTraffic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [maximizedPanel, setMaximizedPanel] = useState(null);
  const [waterLocations, setWaterLocations] = useState([]);
  const [waterError, setWaterError] = useState("");

  useEffect(() => {
    if (!isActive) return undefined;
    const controller = new AbortController();
    setWaterError("");
    fetchWaterLocations(controller.signal)
      .then((locations) => { if (!controller.signal.aborted) setWaterLocations(locations); })
      .catch((err) => { if (!controller.signal.aborted) setWaterError(err.message); });
    return () => controller.abort();
  }, [isActive]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetchTrafficDashboard(dateRange, controller.signal)
      .then(setTraffic)
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [dateRange]);

  return (
    <main className="traffic-command-center">
      <HeatmapMap traffic={traffic} waterLocations={waterLocations} isActive={isActive} />
      {maximizedPanel && <button className="traffic-modal-backdrop" aria-label="Tutup panel yang diperbesar" onClick={() => setMaximizedPanel(null)} />}
      <div className={`traffic-overlay ${maximizedPanel ? "modal-open" : ""}`} aria-busy={loading}>
        <SummaryCards traffic={traffic} maximizedPanel={maximizedPanel} onMaximize={setMaximizedPanel} />
        <TrafficCharts hourly={traffic?.hourly || []} maximized={maximizedPanel === "hourly"} onMaximize={() => setMaximizedPanel(maximizedPanel === "hourly" ? null : "hourly")} />
        <MonthlyTrafficChart maximized={maximizedPanel === "monthly"} onMaximize={() => setMaximizedPanel(maximizedPanel === "monthly" ? null : "monthly")} />
      </div>
      {loading && <div className="traffic-loading"><span /> Memuat data traffic…</div>}
      {(error || waterError) && <div className="traffic-error" role="alert">
        {error && <div>Data traffic tidak dapat dimuat: {error}</div>}
        {waterError && <div>Lokasi berbagi air tidak dapat dimuat: {waterError}</div>}
      </div>}
    </main>
  );
}
