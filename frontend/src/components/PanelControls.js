export default function PanelControls({ minimized, maximized, onMinimize, onMaximize }) {
  return <div className="panel-controls">
    {maximized ? <button className="panel-close-button" type="button" onClick={onMaximize} title="Tutup panel" aria-label="Tutup panel">
      <span className="close-icon" />
    </button> : <>
      {!minimized && <button type="button" onClick={onMaximize} title="Perbesar panel" aria-label="Perbesar panel"><span className="maximize-icon" /></button>}
      <button type="button" onClick={onMinimize} title={minimized ? "Buka panel" : "Tutup panel"} aria-label={minimized ? "Buka panel" : "Tutup panel"}>
        <span className={minimized ? "arrow-icon down" : "arrow-icon up"} />
      </button>
    </>}
  </div>;
}
