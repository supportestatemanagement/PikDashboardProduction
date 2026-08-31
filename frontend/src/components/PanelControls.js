export default function PanelControls({ minimized, maximized, onMinimize, onMaximize }) {
  return <div className="panel-controls">
    <button type="button" onClick={onMinimize} title={minimized ? "Tampilkan panel" : "Minimize panel"} aria-label={minimized ? "Tampilkan panel" : "Minimize panel"}>
      {minimized ? <svg viewBox="0 0 16 16"><path d="M3 8h10M8 3v10" /></svg> : <svg viewBox="0 0 16 16"><path d="M3 8h10" /></svg>}
    </button>
    <button type="button" onClick={onMaximize} title={maximized ? "Kembalikan ukuran" : "Perbesar panel"} aria-label={maximized ? "Kembalikan ukuran" : "Perbesar panel"}>
      {maximized ? <svg viewBox="0 0 16 16"><rect x="5" y="3" width="8" height="8" /><path d="M3 5v8h8" /></svg> : <svg viewBox="0 0 16 16"><rect x="3" y="3" width="10" height="10" /></svg>}
    </button>
  </div>;
}
