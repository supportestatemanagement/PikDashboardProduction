export const iconPaths = {
  heat: 'M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0ZM12 8v9M18 5h3M18 9h2',
  water: 'M12 3S5 11 5 15a7 7 0 0 0 14 0c0-4-7-12-7-12ZM8 16a4 4 0 0 0 4 3',
  wind: 'M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h5a3 3 0 1 1-3 3',
  cloud: 'M7 18h11a4 4 0 0 0 0-8h-1a6 6 0 0 0-11-2 5 5 0 0 0 1 10Z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  wave: 'M2 7q3-4 6 0t6 0 6 0M2 12q3-4 6 0t6 0 6 0M2 17q3-4 6 0t6 0 6 0',
  fire: 'M13 2c2 6-4 7-2 11 2-1 3-3 3-5 5 4 7 8 4 12-4 5-13 2-13-4 0-4 4-6 8-14Z',
  quake: 'M2 12h4l3-8 4 16 3-8h6',
  alert: 'M12 3 2 21h20L12 3ZM12 9v5M12 17v1',
};
export default function DisasterIcon({ type, label, color, size = 22 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>{label && <title>{label}</title>}<path d={iconPaths[type] || iconPaths.alert} /></svg>;
}
