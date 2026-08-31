import { CHECKPOINTS } from "../config/trafficConfig";
import { formatInteger } from "../services/trafficService";

function Metric({ label, value, primary = false }) {
  return <div className={primary ? "traffic-metric primary" : "traffic-metric"}><span>{label}</span><strong>{formatInteger(value)}</strong></div>;
}

export default function SummaryCards({ traffic }) {
  const vehicles = traffic?.vehicles || {};
  const checkpoints = traffic?.checkpoints || {};
  const stage = traffic?.stage || { stage: "–", label: "Menunggu data", color: "#64748b" };
  return <>
    <section className="glass-panel traffic-summary-panel">
      <div className="panel-eyebrow">TOTAL KENDARAAN DALAM PIK</div>
      <div className="traffic-total">{formatInteger(traffic?.totalVehicles)}</div>
      <div className="primary-row"><Metric label="Vehicle In PIK1" value={vehicles.pik1} primary />
        <div className="stage-block" style={{ "--stage-color": stage.color }}><span>TRAFFIC STAGE</span><strong>STAGE {stage.stage}</strong><small>{stage.label}</small></div>
      </div>
      <div className="area-metrics"><Metric label="BGM" value={vehicles.bgm} /><Metric label="GI" value={vehicles.gi} /><Metric label="RWI" value={vehicles.rwi} /><Metric label="PIK2" value={vehicles.pik2} /></div>
    </section>
    <section className="glass-panel checkpoint-panel">
      <div className="panel-heading"><span>CHECKPOINT</span><small>AllCheckpoint</small></div>
      <div className="checkpoint-list">{CHECKPOINTS.map((checkpoint) => <div className="checkpoint-row" key={checkpoint.key}><span><i style={{ background: checkpoint.color }} />{checkpoint.label}</span><strong>{formatInteger(checkpoints[checkpoint.key])}</strong></div>)}</div>
    </section>
  </>;
}

