export default function VolcanoPanel({ volcanoes }) {
  return (
    <section className="ppb-panel">
      <div className="ppb-panel-head">
        <div className="ppb-panel-title"><span className="ppb-ind ppb-ind-warn" />Aktivitas Gunung Api</div>
      </div>
      <p className="ppb-source-note">Data sementara - belum terhubung PVMBG/MAGMA</p>
      <div className="ppb-volc-list">
        {volcanoes.map((v, i) => (
          <div className="ppb-volc-item" key={i}>
            <div>
              <div className="ppb-volc-name">{v.name}</div>
              <div className="ppb-volc-loc">{v.place}</div>
            </div>
            <span className={`ppb-badge ${v.status === "AWAS" ? "ppb-badge-awas" : "ppb-badge-siaga"}`}>
              {v.status}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

