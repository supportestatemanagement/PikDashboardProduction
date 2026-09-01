import { useState } from "react";
import { CHECKPOINTS } from "../config/trafficConfig";
import { formatInteger } from "../services/trafficService";
import PanelControls from "./PanelControls";

function Metric({ label, value, primary = false }) {
  return <div className={primary ? "traffic-metric primary" : "traffic-metric"}><span>{label}</span><strong>{formatInteger(value)}</strong></div>;
}

function PanelHeader({ title, source, state, onMinimize, onMaximize }) {
  return <div className="panel-heading panel-titlebar"><div><span>{title}</span>{source && <small>{source}</small>}</div><PanelControls minimized={state.minimized} maximized={state.maximized} onMinimize={onMinimize} onMaximize={onMaximize} /></div>;
}

export default function SummaryCards({ traffic, maximizedPanel, onMaximize }) {
  const [panels, setPanels] = useState({ summary: { minimized: false }, checkpoint: { minimized: false } });
  const updatePanel = (name, change) => setPanels((current) => ({ ...current, [name]: { ...current[name], ...change } }));
  const vehicles = traffic?.vehicles || {};
  const checkpoints = traffic?.checkpoints || {};
  const stage = traffic?.stage || { stage: "-", label: "Menunggu data", color: "#64748b" };
  const summary = { ...panels.summary, maximized: maximizedPanel === "summary" };
  const checkpoint = { ...panels.checkpoint, maximized: maximizedPanel === "checkpoint" };

  return <>
    <section className={`glass-panel traffic-summary-panel ${summary.minimized ? "panel-minimized" : ""} ${summary.maximized ? "panel-maximized" : ""}`}>
      <PanelHeader title="TRAFFIC OVERVIEW" state={summary} onMinimize={() => { updatePanel("summary", { minimized: !summary.minimized }); if (!summary.minimized) onMaximize(null); }} onMaximize={() => onMaximize(summary.maximized ? null : "summary")} />
      {!summary.minimized && <div className="traffic-overview-stack">
        <div className="stage-block" style={{ "--stage-color": stage.color }}><span>TRAFFIC STAGE</span><strong>STAGE {stage.stage}</strong><small>{stage.label}</small></div>
        <Metric label="Vehicle In PIK1" value={vehicles.pik1} primary />
        <Metric label="Vehicle In PIK2" value={vehicles.pik2} />
      </div>}
    </section>

    <section className={`glass-panel checkpoint-panel ${checkpoint.minimized ? "panel-minimized" : ""} ${checkpoint.maximized ? "panel-maximized" : ""}`}>
      <PanelHeader title="CHECKPOINT" source="AllCheckpoint" state={checkpoint} onMinimize={() => { updatePanel("checkpoint", { minimized: !checkpoint.minimized }); if (!checkpoint.minimized) onMaximize(null); }} onMaximize={() => onMaximize(checkpoint.maximized ? null : "checkpoint")} />
      {!checkpoint.minimized && <div className="checkpoint-list">{CHECKPOINTS.map((item) => <div className="checkpoint-row" key={item.key}><span><i style={{ background: item.color }} />{item.label}</span><strong>{formatInteger(checkpoints[item.key])}</strong></div>)}</div>}
    </section>
  </>;
}
