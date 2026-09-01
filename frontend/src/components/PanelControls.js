export default function PanelControls({ minimized, maximized, onMinimize, onMaximize }) {
  return <div className="panel-controls">
    <button type="button" onClick={onMinimize} title={minimized ? "Tampilkan panel" : "Minimize panel"} aria-label={minimized ? "Tampilkan panel" : "Minimize panel"}>
      <span className={minimized ? "arrow-icon down" : "arrow-icon up"} />
    </button>
    {!minimized && <button type="button" onClick={onMaximize} title={maximized ? "Perkecil panel" : "Perbesar panel"} aria-label={maximized ? "Perkecil panel" : "Perbesar panel"}>
      <span className={maximized ? "maximize-icon restored" : "maximize-icon"} />
    </button>}
  </div>;
}
