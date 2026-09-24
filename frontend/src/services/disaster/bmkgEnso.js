export const ENSO_REFRESH_INTERVAL = 12 * 60 * 60 * 1000;
export const ENSO_SOURCE_URL = 'https://www.bmkg.go.id/iklim/dinamika-atmosfer';
export const ENSO_AVAILABLE = false;
export function getEnsoCategory(value, officialCategory) {
  if (typeof officialCategory === 'string' && officialCategory.trim()) return officialCategory.trim();
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value <= -0.5) return 'La Niña';
  if (value >= 0.5) return 'El Niño';
  return 'Netral';
}
export function ensoImpact(category) {
  const label = String(category || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (label.includes('el nino')) return { text: 'Kecenderungan kondisi lebih kering di sebagian wilayah Indonesia.', attention: 'Kekeringan, ketersediaan air, hotspot/kebakaran lahan.' };
  if (label.includes('la nina')) return { text: 'Kecenderungan kondisi lebih basah di sebagian wilayah Indonesia.', attention: 'Hujan tinggi, genangan/banjir, peningkatan level air.' };
  if (label === 'netral') return { text: 'Tidak terdapat dorongan ENSO yang kuat ke arah kondisi lebih kering atau lebih basah.' };
  return null;
}
// No verified machine-readable BMKG ENSO feed. Never scrape publication prose
// or substitute static values. A verified adapter must preserve period/update.
export async function fetchEnso() { throw new Error('Data ENSO resmi sementara tidak tersedia.'); }
