import { useState } from "react";
import { apiFetch, setToken } from "../api";

const features = [
  { icon: "🚌", label: "Fleet Management",   desc: "Track all vehicles in real-time" },
  { icon: "👤", label: "Driver Monitoring",  desc: "Manage drivers and assignments" },
  { icon: "📊", label: "Analytics & Reports", desc: "Fuel, trips, and performance data" },
  { icon: "🔔", label: "Smart Alerts",       desc: "Speed, geofence, and alarm events" },
];

export default function Login() {
  const [username, setUsername]       = useState("Admin");
  const [password, setPassword]       = useState("Helion@2026");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [err, setErr]                 = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      const data = await apiFetch("/auth/login", { method: "POST", body: { username, password } });
      setToken(data.token);
      const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
      window.location.replace(`${base}/fleet`);
    } catch (e2) {
      setErr(e2.message || String(e2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'DM Sans', 'Inter', system-ui, -apple-system, sans-serif",
      backgroundColor: "#052e16",
    }}>

      {/* ── Top logo bar (spans both columns) ── */}
      <div style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px 32px",
        boxSizing: "border-box",
        background: "rgba(5, 46, 22, 0.95)",
        borderBottom: "1px solid rgba(52, 211, 153, 0.18)",
        backdropFilter: "blur(8px)",
      }}>
        <img
          src={`${import.meta.env.BASE_URL}helion-logo-slogan.svg`}
          alt="Helion Tracking"
          style={{
            height: 68,
            maxWidth: 420,
            objectFit: "contain",
            filter: "drop-shadow(0 2px 16px rgba(52, 211, 153, 0.35))",
          }}
        />
      </div>

      {/* ── Two-column body ── */}
      <div style={{ flex: 1, display: "flex" }}>

        {/* LEFT — branding */}
        <div className="login-left" style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "56px clamp(28px, 5vw, 72px)",
          background: "linear-gradient(160deg, #052e16 0%, #14532d 55%, #166534 100%)",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* decorative glow blobs */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(ellipse at 15% 85%, rgba(52,211,153,0.10) 0%, transparent 55%), radial-gradient(ellipse at 85% 15%, rgba(74,222,128,0.07) 0%, transparent 50%)",
          }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <h2 style={{
              margin: "0 0 10px",
              fontSize: "clamp(1.6rem, 2.8vw, 2.4rem)",
              fontWeight: 800,
              color: "#ecfdf5",
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
            }}>
              Fleet System
            </h2>
            <p style={{ margin: "0 0 44px", fontSize: 15, color: "rgba(187,247,208,0.70)", lineHeight: 1.65 }}>
              One platform to manage your entire fleet operation — from live GPS to reports and driver management.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {features.map(f => (
                <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: "rgba(52,211,153,0.14)",
                    border: "1px solid rgba(52,211,153,0.28)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20,
                  }}>
                    {f.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: "#bbf7d0", fontSize: 14, marginBottom: 2 }}>{f.label}</div>
                    <div style={{ color: "rgba(187,247,208,0.58)", fontSize: 13 }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 52,
              paddingTop: 24,
              borderTop: "1px solid rgba(52,211,153,0.15)",
              fontSize: 13,
              color: "rgba(187,247,208,0.45)",
            }}>
              Helion Tracking · Authorized personnel only
            </div>
          </div>
        </div>

        {/* RIGHT — form */}
        <div className="login-right" style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "56px clamp(24px, 5vw, 72px)",
          background: "#ffffff",
          boxSizing: "border-box",
        }}>
          <div style={{ width: "100%", maxWidth: 400 }}>

            {/* Form heading */}
            <div style={{ marginBottom: 32 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: "#22c55e",
                letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10,
              }}>
                Secure sign-in
              </div>
              <h2 style={{
                margin: "0 0 8px",
                fontSize: "clamp(1.4rem, 2.5vw, 1.8rem)",
                fontWeight: 800,
                color: "#14532d",
                letterSpacing: "-0.025em",
              }}>
                Login to Dashboard
              </h2>
              <p style={{ margin: 0, fontSize: 14, color: "#5b9275", lineHeight: 1.55 }}>
                Enter your Helion Tracking credentials to continue.
              </p>
            </div>

            <form onSubmit={onSubmit}>
              {/* Username */}
              <div style={{ marginBottom: 18 }}>
                <label htmlFor="login-user" style={{
                  display: "block", fontSize: 13, fontWeight: 700,
                  color: "#166534", marginBottom: 8,
                }}>
                  Username
                </label>
                <input
                  id="login-user"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="Enter username"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "#f0fdf4",
                    border: "1.5px solid #bbf7d0",
                    color: "#14532d",
                    borderRadius: 12,
                    padding: "13px 15px",
                    fontSize: 15, fontWeight: 600,
                    outline: "none", fontFamily: "inherit",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label htmlFor="login-pass" style={{ fontSize: 13, fontWeight: 700, color: "#166534" }}>
                    Password
                  </label>
                  <label style={{
                    display: "flex", alignItems: "center", gap: 5,
                    cursor: "pointer", fontSize: 12, fontWeight: 600,
                    color: "#5b9275", userSelect: "none",
                  }}>
                    <input
                      type="checkbox"
                      checked={showPassword}
                      onChange={(e) => setShowPassword(e.target.checked)}
                      style={{ accentColor: "#22c55e" }}
                    />
                    Show
                  </label>
                </div>
                <input
                  id="login-pass"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter password"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "#f0fdf4",
                    border: "1.5px solid #bbf7d0",
                    color: "#1d4ed8",
                    borderRadius: 12,
                    padding: "13px 15px",
                    fontSize: 16, fontWeight: 800,
                    outline: "none", fontFamily: "inherit",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                />
              </div>

              <style>{`
                #login-user::placeholder, #login-pass::placeholder {
                  color: rgba(71, 85, 105, 0.45); opacity: 1;
                }
                #login-user:focus, #login-pass:focus {
                  border-color: #22c55e !important;
                  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.14);
                }
                @media (max-width: 700px) {
                  .login-left { display: none !important; }
                  .login-right { padding: 36px 24px !important; }
                }
              `}</style>

              {err && (
                <div style={{
                  margin: "14px 0 0",
                  fontSize: 13, color: "#9f1239",
                  background: "rgba(251,113,133,0.10)",
                  border: "1px solid rgba(190,24,93,0.22)",
                  borderRadius: 10, padding: "10px 13px", lineHeight: 1.5,
                }}>
                  {err}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 24, width: "100%",
                  background: loading
                    ? "#9dc7b0"
                    : "linear-gradient(135deg, #34d399 0%, #4ade80 100%)",
                  border: 0, color: "#ecfdf5",
                  padding: "14px 16px",
                  borderRadius: 12,
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: 800, fontSize: 16,
                  fontFamily: "inherit",
                  boxShadow: loading ? "none" : "0 6px 24px rgba(52, 211, 153, 0.35)",
                  letterSpacing: "0.01em",
                  transition: "opacity 0.15s",
                }}
              >
                {loading ? "Signing in…" : "Sign in →"}
              </button>

              <p style={{
                marginTop: 20, fontSize: 12,
                color: "#9ca3af", textAlign: "center", lineHeight: 1.5,
              }}>
                Protected access · Authorized personnel only
              </p>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
