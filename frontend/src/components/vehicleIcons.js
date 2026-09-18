export function getVehicleType(vehicle) {
  const id = String(vehicle.vehicle_id || vehicle.id || '').trim().toUpperCase();
  if (/^TANGKI_AIR(?:_?\d+)?$/.test(id)) return 'water-tanker';
  if (/^DAMKAR(?:_|$)/.test(id)) return 'fire-truck';
  return 'car';
}

export function getVehicleColor(vehicle) {
  const id = String(vehicle.vehicle_id || vehicle.id || '').trim().toUpperCase();
  if (/^MACAN(?:_|$)/.test(id)) return '#facc15';
  if (/^JAGUAR(?:_|$)/.test(id)) return '#f97316';
  if (/^TRITON(?:_|$)/.test(id)) return '#1e3a8a';
  if (getVehicleType(vehicle) === 'water-tanker') return '#38bdf8';
  if (getVehicleType(vehicle) === 'fire-truck') return '#ef4444';
  return '#a855f7';
}

// Top-down silhouettes point north; rotate only the SVG, leaving labels upright.
export function vehicleIconSvg(type, heading, color) {
  const angle = Number.isFinite(heading) ? heading : 0;
  const wheels = '<g fill="#111827"><rect x="3" y="8" width="5" height="10" rx="2"/><rect x="24" y="8" width="5" height="10" rx="2"/><rect x="3" y="32" width="5" height="11" rx="2"/><rect x="24" y="32" width="5" height="11" rx="2"/></g>';
  let body;
  if (type === 'water-tanker') {
    body = `<rect x="7" y="2" width="18" height="14" rx="3" fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <path d="M10 7h12v5H10Z" fill="#1e293b"/>
      <rect x="6" y="17" width="20" height="29" rx="9" fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <path d="M7 24h18M7 38h18" stroke="#bae6fd" stroke-width="2"/>
      <path d="M16 25c-2 3-4 5-4 7a4 4 0 0 0 8 0c0-2-2-4-4-7Z" fill="#fff"/>`;
  } else if (type === 'fire-truck') {
    body = `<rect x="6" y="2" width="20" height="44" rx="3" fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <path d="M9 7h14v6H9Z" fill="#1e293b"/>
      <path d="M9 17h7" stroke="#38bdf8" stroke-width="3"/><path d="M16 17h7" stroke="#fff" stroke-width="3"/>
      <rect x="10" y="22" width="12" height="20" rx="1" fill="#334155"/>
      <path d="M12 22v20M20 22v20M12 25h8M12 30h8M12 35h8M12 40h8" stroke="#f8fafc" stroke-width="1.5"/>`;
  } else {
    body = `<rect x="7" y="2" width="18" height="44" rx="7" fill="${color}" stroke="#fff" stroke-width="2"/>
      <path d="M10 12h12l-1 9H11Z M11 32h10l1 6H10Z" fill="#1e293b"/>
      <path d="M10 5h4m4 0h4" stroke="#fff" stroke-width="3"/>`;
  }
  return `<svg width="32" height="48" viewBox="0 0 32 48" style="transform:rotate(${angle}deg)" aria-hidden="true">${wheels}${body}</svg>`;
}
