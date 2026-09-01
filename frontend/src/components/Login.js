"use client";
import { useState } from "react";

function EyeIcon({ visible }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    {visible ? <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></> : <><path d="m3 3 18 18" /><path d="M10.6 6.2A11.8 11.8 0 0 1 12 6c6.5 0 10 6 10 6a16 16 0 0 1-3 3.8M6.6 6.7C3.6 8.6 2 12 2 12s3.5 6 10 6a9.8 9.8 0 0 0 4-.8M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>}
  </svg>;
}

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event?.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Username dan password wajib diisi.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await response.json();
      if (response.ok && data.status === "success") onLogin();
      else setError("Username atau password salah.");
    } catch (requestError) {
      setError("Tidak dapat terhubung ke server. Silakan coba kembali.");
    } finally {
      setLoading(false);
    }
  };

  return <main className="login-page">
    <div className="login-orbit orbit-one" /><div className="login-orbit orbit-two" />
    <section className="login-shell">
      <aside className="login-brand-panel">
        <img src="/logo512.png" alt="Logo 911 Command Center" />
        <div><span>SMART CITY OPERATIONS</span><h1>Command Center PIK</h1><p>Traffic monitoring and integrated city operation dashboard.</p></div>
      </aside>
      <div className="login-form-panel">
        <div className="login-mobile-brand"><img src="/logo192.png" alt="" /><div><strong>COMMAND CENTER PIK</strong><span>Agung Sedayu Group</span></div></div>
        <div className="login-heading"><span>SECURE ACCESS</span><h2>Selamat datang</h2><p>Masuk menggunakan akun Command Center Anda.</p></div>
        <form onSubmit={handleSubmit}>
          <label htmlFor="login-username">Username</label>
          <div className="login-input-wrap">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            <input id="login-username" name="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Masukkan username" autoFocus />
          </div>
          <label htmlFor="login-password">Password</label>
          <div className="login-input-wrap">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            <input id="login-password" name="password" autoComplete="current-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan password" />
            <button className="password-toggle" type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"} title={showPassword ? "Sembunyikan password" : "Tampilkan password"}><EyeIcon visible={showPassword} /></button>
          </div>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="login-submit" type="submit" disabled={loading}>{loading ? <><i /> Memproses…</> : "Masuk"}</button>
        </form>
        <footer>© 2026 Command Center PIK · v1.0</footer>
      </div>
    </section>
  </main>;
}
