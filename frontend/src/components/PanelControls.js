export default function PanelControls({ minimized, maximized, onMinimize, onMaximize }) {
  return <div className="panel-controls">
    <button type="button" onClick={onMinimize} title={minimized ? "Tampilkan panel" : "Minimize panel"} aria-label={minimized ? "Tampilkan panel" : "Minimize panel"}>
      <span className={minimized ? "collapse-icon collapsed" : "collapse-icon"} />
    </button>
    <button type="button" onClick={onMaximize} title={maximized ? "Kembalikan ukuran" : "Perbesar panel"} aria-label={maximized ? "Kembalikan ukuran" : "Perbesar panel"}>
      <span className={maximized ? "maximize-icon restored" : "maximize-icon"} />
    </button>
  </div>;
}
