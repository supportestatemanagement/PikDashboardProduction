import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import SulapProgramCredit from './SulapProgramCredit';
import { ENSO_SOURCE_URL } from '../../services/disaster/noaaEnsoService';
import { NOWCASTING_LAYER_URL } from '../../services/disaster/bmkgNowcasting';
import { RDCA_URL } from '../../services/disaster/bmkgRdca';
import './sourceInfo.css';

const sources = [
  ['Prakiraan Cuaca Lokal', 'BMKG', 'https://data.bmkg.go.id/prakiraan-cuaca/', '30 menit'],
  ['Gempa BMKG', 'BMKG', 'https://data.bmkg.go.id/gempabumi/', '5 menit'],
  ['Peringatan Dini Cuaca', 'BMKG', NOWCASTING_LAYER_URL, '5 menit'],
  ['RDCA', 'BMKG', RDCA_URL, '5 menit'],
  ['Kondisi Maritim', 'BMKG Maritim', 'https://maritim.bmkg.go.id/', '30 menit'],
  ['ENSO / El Niño–La Niña', 'NOAA/CPC', ENSO_SOURCE_URL, '6 jam'],
  ['Distribusi Air Bersih', 'Program SULAP by CSR PIK', null, '30 menit'],
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
      <dl>{sources.map(([title, name, url, interval]) => <div key={title}>
        <dt>{title}</dt>
        <dd>{title === 'Distribusi Air Bersih' && <SulapProgramCredit showText={false} />}Sumber data: {url ? <a href={url} target="_blank" rel="noreferrer">{name} ↗</a> : name}<br />Pembaruan otomatis setiap {interval}.</dd>
      </div>)}</dl>
    </dialog>, document.body)}
  </>;
}
