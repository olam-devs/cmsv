import { useState } from "react";
import { apiFetch, setToken } from "../api";
import { useNavigate } from "react-router-dom";

const ACCENT = "#34d399";
const ACCENT_MID = "#4ade80";
const ACCENT_SOFT = "rgba(52, 211, 153, 0.28)";
const INK = "#15803d";
const INK_MUTED = "#4d7c5f";
const LABEL = "#22c55e";
const FIELD_TEXT = "#166534";
const CAPTION = "#5b9275";
const BTN_TEXT = "#ecfdf5";
/** Typed password — bold, high-contrast (not black/white; distinct from username field) */
const PASSWORD_TEXT = "#1d4ed8";
const NEUTRAL_FIELD_BG = "rgba(255, 255, 255, 0.32)";
const NEUTRAL_FIELD_BORDER = "rgba(15, 23, 42, 0.14)";
const PLACEHOLDER_NEUTRAL = "rgba(71, 85, 105, 0.75)";

export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      const data = await apiFetch("/auth/login", { method: "POST", body: { username, password } });
      setToken(data.token);
      nav("/erp", { replace: true });
    } catch (e2) {
      setErr(e2.message || String(e2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "max(20px, env(safe-area-inset-top)) max(clamp(20px, 5vw, 48px), env(safe-area-inset-right)) max(28px, env(safe-area-inset-bottom)) max(clamp(20px, 5vw, 48px), env(safe-area-inset-left))",
        fontFamily: "'DM Sans', 'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        color: INK,
        backgroundColor: "#111",
        backgroundImage: `url(${import.meta.env.BASE_URL}login.png)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          gap: 28,
        }}
      >
        {/* Brand — centered */}
        <header
          style={{
            textAlign: "center",
            width: "100%",
            paddingTop: "clamp(8px, 3vh, 28px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <img
            src={`${import.meta.env.BASE_URL}hellion-tracking.png`}
            alt="Helion Tracking"
            style={{
              width: "100%",
              maxWidth: 320,
              height: "auto",
              maxHeight: 104,
              objectFit: "contain",
              objectPosition: "center",
              display: "block",
              filter: "drop-shadow(0 2px 14px rgba(0, 0, 0, 0.25))",
            }}
          />
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(1.4rem, 4.2vw, 1.75rem)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "#16a34a",
                textShadow: "0 1px 2px rgba(255, 255, 255, 0.9), 0 0 18px rgba(255, 255, 255, 0.45)",
              }}
            >
              Welcome back
            </h1>
            <p
              style={{
                margin: "12px 0 0",
                fontSize: 15,
                lineHeight: 1.55,
                color: INK_MUTED,
                maxWidth: 380,
                textShadow: "0 0 12px rgba(255, 255, 255, 0.65)",
              }}
            >
              Sign in to manage fleet, ERP, and users on a single professional workspace.
            </p>
          </div>
        </header>

        {/* Form — no panel; fields float on photo */}
        <form
          onSubmit={onSubmit}
          style={{
            width: "100%",
            maxWidth: 420,
            margin: "0 auto",
            boxSizing: "border-box",
            background: "transparent",
            border: "none",
            borderRadius: 0,
            padding: "0 2px 8px",
            boxShadow: "none",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#22c55e", letterSpacing: 0.55, textTransform: "uppercase" }}>
            Secure sign-in
          </div>
          <div style={{ marginTop: 6, fontSize: 19, fontWeight: 800, color: "#15803d", letterSpacing: -0.02 }}>Account access</div>
          <div style={{ marginTop: 5, fontSize: 14, color: CAPTION, lineHeight: 1.5 }}>Use your Helion Tracking / FleetVu credentials.</div>

          <div style={{ marginTop: 20 }}>
            <label htmlFor="login-user" style={{ fontSize: 13, fontWeight: 700, color: LABEL, display: "block", marginBottom: 8 }}>
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
                width: "100%",
                boxSizing: "border-box",
                background: NEUTRAL_FIELD_BG,
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                border: `1px solid ${NEUTRAL_FIELD_BORDER}`,
                color: FIELD_TEXT,
                borderRadius: 12,
                padding: "14px 14px",
                fontSize: 16,
                fontWeight: 600,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
              <label htmlFor="login-pass" style={{ fontSize: 13, fontWeight: 700, color: LABEL }}>
                Password
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, color: INK_MUTED, userSelect: "none" }}>
                <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
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
                width: "100%",
                boxSizing: "border-box",
                background: NEUTRAL_FIELD_BG,
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                border: `1px solid ${NEUTRAL_FIELD_BORDER}`,
                color: PASSWORD_TEXT,
                borderRadius: 12,
                padding: "14px 14px",
                fontSize: 17,
                fontWeight: 800,
                letterSpacing: "0.02em",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>

          <style>{`
            #login-user::placeholder, #login-pass::placeholder { color: ${PLACEHOLDER_NEUTRAL}; opacity: 1; }
            #login-user:focus, #login-pass:focus {
              border-color: rgba(29, 78, 216, 0.55);
              box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.18);
            }
          `}</style>

          {err ? (
            <div
              style={{
                marginTop: 16,
                fontSize: 13,
                color: "#9f1239",
                background: "rgba(251, 113, 133, 0.2)",
                border: "1px solid rgba(190, 24, 93, 0.35)",
                borderRadius: 12,
                padding: "10px 12px",
                lineHeight: 1.45,
              }}
            >
              {err}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 22,
              width: "100%",
              background: loading ? "#9dc7b0" : `linear-gradient(135deg, ${ACCENT}, ${ACCENT_MID})`,
              border: 0,
              color: BTN_TEXT,
              padding: "15px 16px",
              borderRadius: 14,
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 800,
              fontSize: 16,
              fontFamily: "inherit",
              boxShadow: loading ? "none" : `0 8px 28px ${ACCENT_SOFT}`,
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <p style={{ marginTop: 18, fontSize: 12, color: CAPTION, textAlign: "center", lineHeight: 1.5 }}>
            Protected access · Authorized personnel only
          </p>
        </form>
      </div>
    </div>
  );
}
