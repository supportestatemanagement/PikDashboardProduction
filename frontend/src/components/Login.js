"use client";
import { useState } from "react";

const styles = {
  wrapper: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0d1b6e 0%, #1a2fa8 40%, #2541c4 70%, #1e35b5 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  bgCircle1: {
    position: "absolute",
    width: "600px",
    height: "600px",
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.06)",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  },
  bgCircle2: {
    position: "absolute",
    width: "900px",
    height: "900px",
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.04)",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  },
  card: {
    background: "#f0f2fa",
    borderRadius: "20px",
    padding: "48px 52px",
    width: "100%",
    maxWidth: "440px",
    boxShadow: "0 25px 60px rgba(0,0,0,0.35), 0 8px 20px rgba(0,0,0,0.2)",
    position: "relative",
    zIndex: 1,
  },
  logoCircle: {
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20px",
    boxShadow: "0 4px 16px rgba(37,65,196,0.4)",
  },
  logoSvg: {
    width: "30px",
    height: "30px",
  },
  title: {
    textAlign: "center",
    fontSize: "22px",
    fontWeight: "800",
    color: "#0d1b6e",
    letterSpacing: "2px",
    marginBottom: "4px",
  },
  subtitle: {
    textAlign: "center",
    fontSize: "13px",
    color: "#7a8bb5",
    marginBottom: "36px",
    letterSpacing: "0.3px",
  },
  label: {
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1.2px",
    color: "#5a6a9a",
    marginBottom: "8px",
    display: "block",
  },
  inputWrapper: {
    display: "flex",
    alignItems: "center",
    background: "#fff",
    border: "1.5px solid #dde2f0",
    borderRadius: "10px",
    padding: "0 14px",
    marginBottom: "20px",
    transition: "border-color 0.2s",
  },
  inputWrapperFocus: {
    borderColor: "#2541c4",
  },
  inputIcon: {
    color: "#a0aecf",
    marginRight: "10px",
    flexShrink: 0,
  },
  input: {
    flex: 1,
    border: "none",
    outline: "none",
    padding: "13px 0",
    fontSize: "14px",
    color: "#1a2460",
    background: "transparent",
  },
  errorMsg: {
    color: "#e03e3e",
    fontSize: "12px",
    marginBottom: "16px",
    textAlign: "center",
    background: "#fff0f0",
    borderRadius: "8px",
    padding: "8px 12px",
  },
  button: {
    width: "100%",
    padding: "14px",
    background: "linear-gradient(135deg, #1a2fa8, #2d4fd4)",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: "700",
    letterSpacing: "1.5px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    boxShadow: "0 4px 16px rgba(37,65,196,0.4)",
    transition: "opacity 0.2s, transform 0.1s",
    marginBottom: "28px",
  },
  footer: {
    textAlign: "center",
    fontSize: "11px",
    color: "#a0aecf",
    letterSpacing: "0.3px",
  },
};

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");

    if (!username || !password) {
      setError("Username dan password wajib diisi.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username,
          password
        })
      });

      const data = await res.json();

      if (data.status === "success") {
        onLogin();
      } else {
        setError("Username atau password salah.");
      }

    } catch (err) {
      setError("Server error.");
    }

    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div style={styles.wrapper}>
      {/* Decorative background circles */}
      <div style={styles.bgCircle1} />
      <div style={styles.bgCircle2} />

      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoCircle}>
          <img 
            src="/911cclogo.png" 
            alt="911 Logo" 
            style={{ 
              width: "60px", 
              height: "60px", 
              objectFit: "contain" 
            }} 
          />
        </div>

        <div style={styles.title}>911 COMMAND CENTER</div>
        <div style={styles.subtitle}>Dashboard - Agung Sedayu Group</div>

        {/* Username */}
        <label style={styles.label}>USERNAME</label>
        <div
          style={{
            ...styles.inputWrapper,
            ...(focusedField === "username" ? styles.inputWrapperFocus : {}),
          }}
        >
          <span style={styles.inputIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </span>
          <input
            style={styles.input}
            type="text"
            placeholder="Masukkan username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onFocus={() => setFocusedField("username")}
            onBlur={() => setFocusedField(null)}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* Password */}
        <label style={styles.label}>PASSWORD</label>
        <div
          style={{
            ...styles.inputWrapper,
            ...(focusedField === "password" ? styles.inputWrapperFocus : {}),
          }}
        >
          <span style={styles.inputIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
          <input
            style={styles.input}
            type="password"
            placeholder="Masukkan password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocusedField("password")}
            onBlur={() => setFocusedField(null)}
            onKeyDown={handleKeyDown}
          />
        </div>

        {error && <div style={styles.errorMsg}>{error}</div>}

        {/* Submit */}
        <button
          style={{
            ...styles.button,
            opacity: loading ? 0.75 : 1,
          }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"
                style={{ animation: "spin 1s linear infinite" }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              MEMPROSES...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              MASUK
            </>
          )}
        </button>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>

        <div style={styles.footer}>© 2026 Command Center PIK - v1.0</div>
      </div>
    </div>
  );
}