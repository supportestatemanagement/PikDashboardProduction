import { useEffect, useRef, useState } from 'react';
import { loginVehicleReader, VEHICLE_API_KEY } from '../services/vehicleAuthService';

export default function VehicleLogin({ onLogin, error: sessionError }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    try {
      const session = await loginVehicleReader(values.get('email'), values.get('password'), controller.signal);
      if (!controller.signal.aborted) { form.reset(); onLogin(session); }
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message);
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }
  return <div className="vehicle-tracking-status vehicle-login" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
    <strong>Masuk untuk melihat GPS kendaraan</strong>
    {!VEHICLE_API_KEY ? <p>Konfigurasi koneksi GPS belum lengkap. Hubungi pengelola dashboard.</p> :
      <form onSubmit={submit}>
        <label>Email akun GPS<input name="email" type="email" autoComplete="username" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
        <button disabled={loading}>{loading ? 'Menghubungkan…' : 'Hubungkan GPS'}</button>
      </form>}
    {(error || sessionError) && <p role="alert">{error || sessionError}</p>}
  </div>;
}
