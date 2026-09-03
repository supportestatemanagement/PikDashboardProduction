import { useEffect, useState } from "react";
import HeatmapMap from "./HeatmapMap";
import SummaryCards from "./SummaryCards";
import TrafficCharts from "./TrafficCharts";
import { fetchTrafficDashboard } from "../services/trafficService";

export default function TrafficDashboard({ dateRange, isActive = true }) {
  const [traffic, setTraffic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [maximizedPanel, setMaximizedPanel] = useState(null);

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
      <HeatmapMap traffic={traffic} isActive={isActive} />
      {maximizedPanel && <button className="traffic-modal-backdrop" aria-label="Tutup panel yang diperbesar" onClick={() => setMaximizedPanel(null)} />}
      <div className={`traffic-overlay ${maximizedPanel ? "modal-open" : ""}`} aria-busy={loading}>
        <SummaryCards traffic={traffic} maximizedPanel={maximizedPanel} onMaximize={setMaximizedPanel} />
        <TrafficCharts hourly={traffic?.hourly || []} maximized={maximizedPanel === "hourly"} onMaximize={() => setMaximizedPanel(maximizedPanel === "hourly" ? null : "hourly")} />
      </div>
      {loading && <div className="traffic-loading"><span /> Memuat data traffic…</div>}
      {error && <div className="traffic-error">Data traffic tidak dapat dimuat: {error}</div>}
    </main>
  );
}
