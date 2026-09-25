export function getEnsoCategory(value, officialCategory) {
  if (typeof officialCategory === 'string' && officialCategory.trim()) return officialCategory.trim();
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value <= -0.5) return 'La Niña';
  if (value >= 0.5) return 'El Niño';
  return 'Neutral';
}
export function ensoImpact(category) {
  const label = String(category || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (label.includes('el nino')) return { text: 'Kecenderungan kondisi lebih kering dapat meningkat di sebagian wilayah Indonesia.', attention: 'Kekeringan, ketersediaan air, kebakaran lahan.' };
  if (label.includes('la nina')) return { text: 'Kecenderungan kondisi lebih basah dapat meningkat di sebagian wilayah Indonesia.', attention: 'Hujan tinggi, genangan/banjir, peningkatan level air.' };
  if (label === 'netral' || label === 'neutral') return { text: 'ENSO tidak memberikan dorongan dominan ke arah kondisi lebih kering atau lebih basah.' };
  return null;
}
