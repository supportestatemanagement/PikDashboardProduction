export const CUSTOMER_COLUMNS = ['Project Code', 'Created At', 'Unit Code', 'Requester Name', 'Source', 'Service Type', 'Category Name', 'Sub Category Name', 'SLA Days', 'Assign To', 'Response By', 'Response Status', 'Handling Status'];
export function customerDate(value) {
  const text = String(value || '').trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const local = text.match(/^(\d{1,2})[-/ ]([a-zA-Z]+|\d{1,2})[-/ ](\d{4}|\d{2})(?:\s|$)/);
  if (!iso && !local) return '';
  const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, agu: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, des: 12 };
  const year = iso ? +iso[1] : +local[3] + (local[3].length === 2 ? 2000 : 0);
  const month = iso ? +iso[2] : Number(local[2]) || months[local[2].slice(0, 3).toLowerCase()];
  const day = +(iso ? iso[3] : local[1]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
}
const key = value => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
export function normalizeCustomerRows(rows) {
  return rows.map(row => {
    const values = Object.fromEntries(Object.entries(row).map(([name, value]) => [key(name), String(value ?? '').trim()]));
    const normalized = Object.fromEntries(CUSTOMER_COLUMNS.map(name => [name, values[key(name)] || '']));
    return { ...normalized, date: customerDate(normalized['Created At']) };
  }).filter(row => CUSTOMER_COLUMNS.some(name => row[name]));
}
export function countCustomerValues(rows, column) {
  const counts = new Map();
  rows.forEach(row => { const value = row[column] || 'Not specified'; counts.set(value, (counts.get(value) || 0) + 1); });
  return [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
export function dailyCustomerTickets(rows) {
  const counts = countCustomerValues(rows.filter(row => row.date), 'date').sort((a, b) => a.label.localeCompare(b.label));
  if (!counts.length) return [];
  const lookup = new Map(counts.map(item => [item.label, item.count]));
  const day = new Date(`${counts[0].label}T00:00:00Z`), end = counts[counts.length - 1].label;
  const result = [];
  while (day.toISOString().slice(0, 10) <= end) {
    const label = day.toISOString().slice(0, 10);
    result.push({ label, count: lookup.get(label) || 0 });
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return result;
}
export async function fetchCustomerRows(signal) {
  const response = await fetch(`${process.env.REACT_APP_API_URL || ''}/api/customer-service-data`, { signal });
  const payload = await response.json();
  if (!response.ok || payload.status !== 'success' || !Array.isArray(payload.data)) throw new Error('Tidak dapat memuat data Customer Service.');
  return normalizeCustomerRows(payload.data);
}
