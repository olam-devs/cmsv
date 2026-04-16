import { useState } from "react";
import { apiFetch, setToken } from "../api";

const features = [
  { label: "Fleet Management",    desc: "Track all vehicles in real-time" },
  { label: "Driver Monitoring",   desc: "Manage drivers and assignments" },
  { label: "Analytics & Reports", desc: "Fuel, trips, and performance data" },
  { label: "Smart Alerts",        desc: "Speed, geofence, and alarm events" },
];

export default function Login() {
  const [username, setUsername]         = useState("Admin");
  const [password, setPassword]         = useState("Helion@2026");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [err, setErr]                   = useState("");

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
      backgroundImage: `url(${import.meta.env.BASE_URL}login.png)`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundColor: "#052e16",
    }}>

      {/* Logo — centered at top */}
      <div style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "28px 32px",
        boxSizing: "border-box",
      }}>
        <img
          src={`${import.meta.env.BASE_URL}helion-logo-slogan.svg`}
          alt="Helion Tracking"
          style={{
            height: 72,
            maxWidth: 420,
            objectFit: "contain",
            filter: "drop-shadow(0 2px 16px rgba(0,0,0,0.5))",
          }}
        />
      </div>

      {/* Body — two columns, no backgrounds */}
      <div style={{ flex: 1, display: "flex", alignItems: "center" }}>

        {/* LEFT — branding text */}
        <div className="login-left" style={{
          flex: 1,
          padding: "40px clamp(28px, 5vw, 72px)",
        }}>
          <h2 style={{
            margin: "0 0 10px",
            fontSize: "clamp(1.6rem, 2.8vw, 2.4rem)",
            fontWeight: 800,
            color: "#ecfdf5",
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
            textShadow: "0 2px 12px rgba(0,0,0,0.6)",
          }}>
            Fleet System
          </h2>
          <p style={{
            margin: "0 0 40px",
            fontSize: 15,
            color: "rgba(255,255,255,0.75)",
            lineHeight: 1.65,
            textShadow: "0 1px 6px rgba(0,0,0,0.5)",
          }}>
            One platform to manage your entire fleet — live GPS, reports, and driver management.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {features.map(f => (
              <div key={f.label} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "#4ade80",
                  marginTop: 6, flexShrink: 0,
                  boxShadow: "0 0 6px rgba(74,222,128,0.8)",
                }} />
                <div>
                  <div style={{
                    fontWeight: 700, color: "#ecfdf5", fontSize: 14,
                    textShadow: "0 1px 6px rgba(0,0,0,0.55)",
                  }}>{f.label}</div>
                  <div style={{
                    color: "rgba(255,255,255,0.62)", fontSize: 13, marginTop: 2,
                    textShadow: "0 1px 4px rgba(0,0,0,0.45)",
                  }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — form */}
        <div className="login-right" style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "40px clamp(24px, 5vw, 72px)",
          boxSizing: "border-box",
        }}>
          <div style={{
            width: "100%",
            maxWidth: 400,
            background: "rgba(5, 30, 15, 0.55)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            borderRadius: 20,
            border: "1px solid rgba(74, 222, 128, 0.18)",
            padding: "36px 32px",
            boxSizing: "border-box",
          }}>

            <div style={{ marginBottom: 28 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: "#4ade80",
                letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10,
              }}>
                Secure sign-in
              </div>
              <h2 style={{
                margin: "0 0 8px",
                fontSize: "clamp(1.3rem, 2.5vw, 1.7rem)",
                fontWeight: 800,
                color: "#ecfdf5",
                letterSpacing: "-0.025em",
              }}>
                Login to Dashboard
              </h2>
              <p style={{ margin: 0, fontSize: 14, color: "rgba(187,247,208,0.70)", lineHeight: 1.55 }}>
                Enter your Helion Tracking credentials.
              </p>
            </div>

            <form onSubmit={onSubmit}>
              {/* Username */}
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="login-user" style={{
                  display: "block", fontSize: 13, fontWeight: 700,
                  color: "#bbf7d0", marginBottom: 8,
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
                    background: "rgba(255,255,255,0.10)",
                    border: "1.5px solid rgba(74,222,128,0.25)",
                    color: "#ecfdf5",
                    borderRadius: 12,
                    padding: "13px 15px",
                    fontSize: 15, fontWeight: 600,
                    outline: "none", fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label htmlFor="login-pass" style={{ fontSize: 13, fontWeight: 700, color: "#bbf7d0" }}>
                    Password
                  </label>
                  <label style={{
                    display: "flex", alignItems: "center", gap: 5,
                    cursor: "pointer", fontSize: 12, fontWeight: 600,
                    color: "rgba(187,247,208,0.65)", userSelect: "none",
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
                    background: "rgba(255,255,255,0.10)",
                    border: "1.5px solid rgba(74,222,128,0.25)",
                    color: "#93c5fd",
                    borderRadius: 12,
                    padding: "13px 15px",
                    fontSize: 16, fontWeight: 800,
                    outline: "none", fontFamily: "inherit",
                  }}
                />
              </div>

              <style>{`
                #login-user::placeholder, #login-pass::placeholder {
                  color: rgba(255,255,255,0.35); opacity: 1;
                }
                #login-user:focus, #login-pass:focus {
                  border-color: #4ade80 !important;
                  box-shadow: 0 0 0 3px rgba(74,222,128,0.18);
                }
                @media (max-width: 700px) {
                  .login-left { display: none !important; }
                  .login-right { padding: 28px 20px !important; }
                }
              `}</style>

              {err && (
                <div style={{
                  margin: "14px 0 0",
                  fontSize: 13, color: "#fca5a5",
                  background: "rgba(220,38,38,0.18)",
                  border: "1px solid rgba(220,38,38,0.35)",
                  borderRadius: 10, padding: "10px 13px", lineHeight: 1.5,
                }}>
                  {err}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 22, width: "100%",
                  background: loading
                    ? "rgba(74,222,128,0.35)"
                    : "linear-gradient(135deg, #34d399 0%, #4ade80 100%)",
                  border: 0, color: "#052e16",
                  padding: "14px 16px",
                  borderRadius: 12,
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: 800, fontSize: 16,
                  fontFamily: "inherit",
                  boxShadow: loading ? "none" : "0 6px 24px rgba(52,211,153,0.40)",
                  letterSpacing: "0.01em",
                }}
              >
                {loading ? "Signing in…" : "Sign in →"}
              </button>

              <p style={{
                marginTop: 18, fontSize: 12,
                color: "rgba(187,247,208,0.45)", textAlign: "center", lineHeight: 1.5,
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
