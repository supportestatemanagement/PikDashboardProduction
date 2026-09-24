const DESCRIPTIONS = {
  FORECAST: 'Prakiraan kondisi pada waktu mendatang.',
  OBSERVATION: 'Data hasil pengamatan atau deteksi.',
  'NEAR REAL-TIME': 'Data kejadian atau analisis yang diperbarui segera setelah diproses.',
  'NEAR REAL-TIME ANALYSIS': 'Data kejadian atau analisis yang diperbarui segera setelah diproses.',
  NOWCAST: 'Prakiraan atau peringatan cuaca jangka sangat pendek.',
  'CLIMATE INDICATOR': 'Indikator kondisi iklim skala mingguan hingga musiman.',
};
export default function DataTypeBadge({ type, description }) {
  const text = [DESCRIPTIONS[type], description].filter(Boolean).join(' ');
  return <span className="ppb-data-type" tabIndex={0} title={text} aria-label={`${type}: ${text}`}>{type}<span className="ppb-type-tooltip" role="tooltip">{text}</span></span>;
}
