export function cameraMetrics(records, pik2 = false) {
  const years = {}, brands = {}, areas = {};
  const offline = pik2 ? { 'PIK 2': [], 'PIK 2 Milenial': [] } : { BGM: [], GI: [], RWI: [], PIK2: [] };
  let total = 0, on = 0, off = 0;
  records.forEach(row => {
    const quantity = pik2 ? Math.max(0, Math.trunc(Number(row['Jumlah Kamera']) || 0)) : (row.Tahun || String(row['Nama Pada Layar (OSD)'] || '').trim() ? 1 : 0);
    if (!quantity) return;
    total += quantity;
    const condition = String(row.Kondisi || '').trim().toUpperCase();
    const detail = String(row['Detail Offline'] || '').trim();
    // Each CCTVPIK2 row is a group. Read the number immediately before Kamera.
    const matches = [...detail.matchAll(/\b(\d+)\s*(?:kamera|cctv|unit)\b/gi)];
    let offlineCount = pik2 ? Math.min(quantity, matches.reduce((sum, match) => sum + Number(match[1]), 0)) : 0;
    if (['OFF', 'OFFLINE', 'MATI', 'RUSAK'].includes(condition) && !offlineCount) offlineCount = quantity;
    off += offlineCount;
    if (pik2 || ['ON', 'AKTIF', 'NORMAL'].includes(condition)) on += quantity - offlineCount;
    const rawArea = String(row.Area || '').trim();
    const area = pik2 ? (/milen|millen/i.test(rawArea) ? 'PIK 2 Milenial' : rawArea || 'PIK 2') : rawArea;
    if (row.Tahun) years[row.Tahun] = (years[row.Tahun] || 0) + quantity;
    const brand = String(row.Brand || '').trim();
    if (brand && brand.toLowerCase() !== 'unknown') brands[brand] = (brands[brand] || 0) + quantity;
    if (area) areas[area] = (areas[area] || 0) + quantity;
    const key = pik2 ? area : area.toUpperCase().replace(/\s+/g, '');
    if (offlineCount && offline[key]) offline[key].push(pik2 ? {
      ...row, 'Nama Pada Layar (OSD)': row['Sub Area'], Detail: detail,
      Progress: row['Progress Perbaikan'], offlineCount,
    } : { ...row, offlineCount });
  });
  const chart = values => Object.entries(values).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  return { total, condition: { on, off }, offline,
    trend: Object.keys(years).sort().map(year => ({ year, count: years[year] })),
    brands: chart(brands), areas: chart(areas) };
}
