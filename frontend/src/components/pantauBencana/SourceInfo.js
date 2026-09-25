import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ENSO_SOURCE_URL } from '../../services/disaster/noaaEnsoService';
import { NOWCASTING_LAYER_URL } from '../../services/disaster/bmkgNowcasting';
import { RDCA_URL } from '../../services/disaster/bmkgRdca';
import './sourceInfo.css';

const sources = [
  ['Prakiraan Cuaca Lokal', 'BMKG', 'https://data.bmkg.go.id/prakiraan-cuaca/', 'Prakiraan wilayah Kamal Muara dan Salembaran Jati.'],
  ['Gempa BMKG', 'BMKG', 'https://data.bmkg.go.id/gempabumi/', 'Gempa terbaru, magnitudo ≥5, dan gempa dirasakan.'],
  ['Peringatan Dini Cuaca', 'BMKG', NOWCASTING_LAYER_URL, 'Area terjadi dan meluas pada periode berlaku.'],
  ['RDCA', 'BMKG', RDCA_URL, 'Pertumbuhan awan cepat; bukan peringatan bencana.'],
  ['Kondisi Maritim', 'BMKG Maritim', 'https://maritim.bmkg.go.id/', 'Prakiraan Pelabuhan Muara Angke dan Tanjung Pasir, bukan sensor PIK. Pasut mengikuti datum sumber.'],
  ['ENSO / El Niño–La Niña', 'NOAA/CPC', ENSO_SOURCE_URL, 'Anomali mingguan Niño 3.4: ≤−0,5°C La Niña, ≥+0,5°C El Niño. Indikator Pasifik, bukan cuaca langsung PIK atau penetapan ENSO resmi. Tren menunjukkan perubahan indeks mingguan.'],
];
export default function SourceInfo() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);
  const buttonRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const button = buttonRef.current;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = overflow; button?.focus(); };
  }, [open]);
  return <>
    <button ref={buttonRef} className="ppb-info-button" aria-label="Informasi sumber data bencana" title="Informasi sumber data" onClick={() => setOpen(true)}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v1" /></svg></button>
    {open && createPortal(<dialog ref={dialogRef} className="ppb-info-dialog" aria-labelledby="ppb-info-title" onCancel={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <header><h2 id="ppb-info-title">Informasi sumber data</h2><button autoFocus aria-label="Tutup informasi sumber" onClick={() => setOpen(false)}>×</button></header>
      <dl>{sources.map(([title, name, url, description]) => <div key={title}><dt>{title} <a href={url} target="_blank" rel="noreferrer">{name} ↗</a></dt><dd>{description}</dd></div>)}</dl>
      <p><strong>Distribusi Air:</strong> Nama lokasi dan koordinat dari sheet BerbagiAir, diperbarui setiap 30 menit.</p>
      <p>Pembaruan otomatis: gempa/cuaca dini/RDCA 5 menit, cuaca/maritim 30 menit, ENSO 6 jam. Waktu pada kartu mengikuti waktu kejadian atau periode sumber.</p>
    </dialog>, document.body)}
  </>;
}
