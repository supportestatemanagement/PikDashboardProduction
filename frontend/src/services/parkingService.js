const key = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const nameKey = value => String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
export function normalizeParkingRows(rows) {
  const latest = new Map();
  rows.forEach(row => {
    const fields = Object.fromEntries(Object.entries(row).map(([column, value]) => [key(column), value]));
    const name = String(fields.sitename ?? '').trim();
    const normalized = nameKey(name);
    const area = normalized.startsWith('KAWASAN RUKAN PIK') ? 'BGM'
      : normalized.startsWith('GOLF ISLAND') ? 'GI'
      : normalized.startsWith('RIVERWALK ISLAND') ? 'RWI' : null;
    if (!area || !name) return;
    const timestamp = Date.parse(fields.receivedatwib);
    if (!Number.isFinite(timestamp)) return;
    const counts = ['carcapacity', 'bikecapacity', 'carqty', 'bikeqty'].map(column => {
      const value = String(fields[column] ?? '').trim();
      return /^\d+$/.test(value) ? Number(value) : NaN;
    });
    const id = `${area}:${normalized}`;
    if (latest.has(id) && latest.get(id).timestamp > timestamp) return;
    // Keep the latest snapshot even if its counts are invalid, so an old row
    // cannot silently masquerade as the current reading.
    const [carCapacity, bikeCapacity, carQty, bikeQty] = counts;
    latest.set(id, { id, name, area, timestamp, valid: counts.every(Number.isSafeInteger),
      carCapacity, bikeCapacity, carQty, bikeQty,
      capacity: carCapacity + bikeCapacity, occupied: carQty + bikeQty });
  });
  return [...latest.values()].filter(location => location.valid);
}

export async function fetchParkingRows(signal) {
  const base = (process.env.REACT_APP_API_URL || '').trim().replace(/\/+$/, '');
  const response = await fetch(`${base}/api/lot-parking-data`, { signal, cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Tidak dapat memuat SPI_Parking. Silakan coba lagi.');
  const payload = await response.json();
  if (payload.status !== 'success' || !Array.isArray(payload.data)) throw new Error('Respons SPI_Parking tidak valid.');
  return normalizeParkingRows(payload.data);
}

export function formatParkingTime(timestamp) {
  return timestamp ? `${new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)} WIB` : 'Belum ada data';
}
