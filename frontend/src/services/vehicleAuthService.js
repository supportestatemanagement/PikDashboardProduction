export const VEHICLE_API_KEY = process.env.REACT_APP_VEHICLE_FIREBASE_API_KEY || '';
export const VEHICLE_READER_UID = '9HpVuSHj8XYUaSvvSx7tfo5YsD32';

async function requestSession(url, body, refresh, signal) {
  if (!VEHICLE_API_KEY) throw new Error('Web API Key Firebase belum dikonfigurasi.');
  const response = await fetch(`${url}?key=${encodeURIComponent(VEHICLE_API_KEY)}`, {
    method: 'POST', signal,
    headers: { 'Content-Type': refresh ? 'application/x-www-form-urlencoded' : 'application/json' },
    body: refresh ? new URLSearchParams(body).toString() : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(refresh ? 'Sesi GPS berakhir. Silakan masuk kembali.' : 'Login GPS gagal. Periksa akun dan konfigurasi Firebase.');
  const uid = refresh ? data.user_id : data.localId;
  const idToken = refresh ? data.id_token : data.idToken;
  const refreshToken = refresh ? data.refresh_token : data.refreshToken;
  const expiresIn = Number(refresh ? data.expires_in : data.expiresIn);
  if (uid !== VEHICLE_READER_UID) throw new Error('Akun ini tidak memiliki akses dashboard GPS.');
  if (!idToken || !refreshToken || !Number.isFinite(expiresIn) || expiresIn <= 0) throw new Error('Respons login GPS tidak valid.');
  return { idToken, refreshToken, expiresAt: Date.now() + expiresIn * 1000 };
}

export const loginVehicleReader = (email, password, signal) => requestSession(
  'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword',
  { email: email.trim(), password, returnSecureToken: true }, false, signal);

export const refreshVehicleSession = (refreshToken, signal) => requestSession(
  'https://securetoken.googleapis.com/v1/token',
  { grant_type: 'refresh_token', refresh_token: refreshToken }, true, signal);
