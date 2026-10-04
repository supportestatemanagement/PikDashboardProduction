import './DashboardLoading.css';

export function LoadingValue() {
  return <span className="dashboard-loading-value" aria-label="Loading" />;
}

export function LoadingChart({ height = 220 }) {
  return <div className="dashboard-loading-chart" style={{ minHeight: height }} role="status" aria-label="Loading chart">
    <div className="dashboard-loading-grid" aria-hidden="true" />
    <div className="dashboard-loading-bars" aria-hidden="true">{[55, 80, 40, 65, 90].map((value, index) => <span key={index} style={{ height: `${value}%` }} />)}</div>
  </div>;
}
