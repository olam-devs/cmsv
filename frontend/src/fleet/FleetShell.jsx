import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, logout } from "../api";
import { getThemePref, setThemePref } from "../themePref";
import { FleetDashboardEmbedded } from "../FleetDashboard.jsx";
import { useBreakpoint } from "../useBreakpoint.js";
import ChangePasswordDialog from "../auth/ChangePasswordDialog.jsx";

const SEMI_TRAILER_ICON = `/api/icons/${encodeURIComponent("Semi trailer.png")}`;

const NAV = [
  { id: "dashboard", icon: "◈", label: "Dashboard" },
  { id: "vehicles", icon: "🚌", iconUrl: SEMI_TRAILER_ICON, label: "Vehicles" },
  { id: "livemap", icon: "📍", label: "Live Map" },
  { id: "cameras", icon: "📷", label: "Live Cameras" },
  { id: "alarms", icon: "⚡", label: "Alarms" },
  { id: "notifs", icon: "🔔", label: "Notifications" },
  { id: "fuel", icon: "⛽", label: "Fuel Report" },
  { id: "fuelrpt", icon: "📅", label: "Daily/Monthly" },
  { id: "locations", icon: "📌", label: "Locations" },
  { id: "routemgr", icon: "🗺️", label: "Route Tracker" },
  { id: "chat", icon: "🤖", label: "FleetBot AI" },
];

const VIEW_FEATURE = {
  dashboard: "fleet.dashboard",
  vehicles: "fleet.vehicles",
  livemap: "fleet.map",
  cameras: "fleet.cameras",
  alarms: "fleet.alarms",
  notifs: "fleet.notifications",
  fuel: "fleet.fuel",
  fuelrpt: "fleet.reports",
  locations: "fleet.routes",
  routemgr: "fleet.routes",
  chat: "fleet.chat",
};

const SIDEBAR_EXPANDED = 260;
const SIDEBAR_COLLAPSED = 68;

/** App header bar: fixed look (not tied to dark/light theme) */
const APP_HEADER_H = 102;
const H = {
  barBg: "#ffffff",
  barBorder: "#e2e8f0",
  text: "#0f172a",
  muted: "#64748b",
  inputBg: "#f8fafc",
  inputBorder: "#cbd5e1",
  btnBorder: "#cbd5e1",
  accent: "#4318d1",
};

function buildShell(theme) {
  const dark = theme === "dark";
  const t = dark
    ? { bg: "#151f32", panel: "#1e293b", border: "#334155", borderHi: "#475569", text: "#f1f5f9", textSoft: "rgba(203,213,225,0.85)", accent: "#4318d1", accentSoft: "rgba(117,81,255,0.2)" }
    : { bg: "#f4f7fe", panel: "#ffffff", border: "#e9edf7", borderHi: "#d1d9f0", text: "#1b2559", textSoft: "#718096", accent: "#4318d1", accentSoft: "rgba(67,24,209,0.08)" };
  return { dark, t };
}

export default function FleetShell() {
  const nav = useNavigate();
  const [theme, setTheme] = useState(() => getThemePref());
  const shell = useMemo(() => buildShell(theme), [theme]);
  const { t, dark } = shell;
  const [view, setView] = useState("dashboard");
  const [tree, setTree] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [companyVehicles, setCompanyVehicles] = useState([]);
  const [err, setErr] = useState("");
  const [me, setMe] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const narrow = useBreakpoint(900);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdTarget, setPwdTarget] = useState(null);
  const headerH = narrow ? 76 : APP_HEADER_H;
  const sidebarW = sidebarOpen ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED;

  useEffect(() => {
    if (!narrow) setMobileMenuOpen(false);
  }, [narrow]);

  useEffect(() => {
    if (narrow) setMobileMenuOpen(false);
  }, [view, narrow]);

  useEffect(() => {
    (async () => {
      try {
        const [tr, m] = await Promise.all([apiFetch("/erp2/org/tree"), apiFetch("/auth/me")]);
        setTree(Array.isArray(tr) ? tr : []);
        setMe(m || null);
      } catch (e) {
        setErr(e.message || String(e));
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setErr("");
        if (!companyId) {
          setCompanyVehicles([]);
          return;
        }
        const v = await apiFetch(`/erp2/vehicles?companyId=${encodeURIComponent(companyId)}`);
        setCompanyVehicles(Array.isArray(v) ? v : []);
      } catch (e) {
        setErr(e.message || String(e));
      }
    })();
  }, [companyId]);

  const filterDevIdnos = useMemo(() => {
    if (!companyId) return null;
    return companyVehicles.filter((v) => v.provider === "cmsv6" && v.devIdno).map((v) => v.devIdno);
  }, [companyId, companyVehicles]);

  const effectiveFeatures = useMemo(() => {
    const ef = me?.effectiveFeatures;
    if (!ef) return [];
    if (ef.includes("*")) return ["*"];
    return ef;
  }, [me]);

  const has = (f) => effectiveFeatures.includes("*") || effectiveFeatures.includes(f);
  const canFleet = has("fleet.view");

  const navItems = useMemo(() => {
    return NAV.filter((item) => {
      const f = VIEW_FEATURE[item.id];
      if (!f) return true;
      return has(f);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveFeatures.join("|")]);

  useEffect(() => {
    const needed = VIEW_FEATURE[view];
    if (needed && !has(needed)) setView(navItems[0]?.id || "dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, navItems.map((n) => n.id).join("|"), effectiveFeatures.join("|")]);

  const displayName = me?.username || "Signed in";

  const showNavLabel = narrow ? true : sidebarOpen;

  const sidebarInner = (
    <>
      <nav style={{ flex: 1, overflowY: "auto", padding: "10px 8px", WebkitOverflowScrolling: "touch" }}>
        {navItems.map((item) => {
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setView(item.id);
                if (narrow) setMobileMenuOpen(false);
              }}
              title={!showNavLabel ? item.label : undefined}
              style={{
                display: "flex",
                gap: showNavLabel ? 10 : 0,
                alignItems: "center",
                justifyContent: showNavLabel ? "flex-start" : "center",
                width: "100%",
                padding: showNavLabel ? "10px 12px" : "10px 0",
                marginBottom: 4,
                borderRadius: 12,
                border: active ? `1px solid ${t.accent}` : "1px solid transparent",
                background: active ? (dark ? "rgba(117,81,255,0.16)" : "rgba(67,24,209,0.10)") : "transparent",
                color: t.text,
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
              }}
            >
              {item.iconUrl ? (
                <span style={{ width: 24, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <img src={item.iconUrl} alt="" style={{ width: 22, height: 22, objectFit: "contain" }} />
                </span>
              ) : (
                <span style={{ width: 24, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
              )}
              {showNavLabel && <span style={{ fontWeight: active ? 800 : 600, fontSize: 13 }}>{item.label}</span>}
            </button>
          );
        })}
      </nav>
      {!narrow ? (
        <button
          type="button"
          onClick={() => {
            setSidebarOpen((s) => !s);
            setTimeout(() => window.dispatchEvent(new Event("resize")), 200);
          }}
          style={{
            border: "none",
            borderTop: `1px solid ${t.border}`,
            background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
            color: t.textSoft,
            padding: "12px 0",
            cursor: "pointer",
            fontSize: 16,
            fontWeight: 700,
          }}
          title={sidebarOpen ? "Collapse menu" : "Expand menu"}
        >
          {sidebarOpen ? "◀" : "▶"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          style={{
            border: "none",
            borderTop: `1px solid ${t.border}`,
            background: t.accentSoft,
            color: t.accent,
            padding: "14px 12px",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 800,
            fontFamily: "inherit",
          }}
        >
          Close menu
        </button>
      )}
    </>
  );

  return (
    <div
      style={{
        height: "100dvh",
        maxHeight: "100dvh",
        display: "grid",
        gridTemplateRows: `${headerH}px 1fr`,
        gridTemplateColumns: narrow ? "1fr" : `${sidebarW}px 1fr`,
        background: t.bg,
        color: t.text,
        overflow: "hidden",
      }}
    >
      {narrow && mobileMenuOpen ? (
        <div
          role="presentation"
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            zIndex: 1000,
          }}
        />
      ) : null}

      {/* App header — full width (fixed light bar; ignores app theme) */}
      <header
        style={{
          gridColumn: "1 / -1",
          minHeight: headerH,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: narrow ? "column" : "row",
          alignItems: narrow ? "stretch" : "center",
          gap: narrow ? 10 : 16,
          flexWrap: "nowrap",
          padding: narrow ? "10px 14px" : "0 20px",
          paddingTop: narrow ? "max(10px, env(safe-area-inset-top))" : undefined,
          background: H.barBg,
          borderBottom: `1px solid ${H.barBorder}`,
          boxShadow: "0 1px 0 rgba(15,23,42,0.06)",
          position: "relative",
          zIndex: narrow && mobileMenuOpen ? 1002 : 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, width: narrow ? "100%" : "auto", minHeight: narrow ? 44 : headerH }}>
          {narrow ? (
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMobileMenuOpen(true)}
              style={{
                border: `1px solid ${H.btnBorder}`,
                background: H.inputBg,
                color: H.text,
                borderRadius: 10,
                padding: "10px 12px",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: 16,
                fontFamily: "inherit",
                flexShrink: 0,
              }}
            >
              ☰
            </button>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", height: narrow ? 40 : headerH, flexShrink: 0, minWidth: 0 }}>
            <img
              src="/hellion-tracking.png"
              alt="Helion Tracking"
              style={{
                height: narrow ? 40 : headerH,
                width: "auto",
                maxWidth: narrow ? "min(70vw, 260px)" : "min(58vw, 640px)",
                objectFit: "contain",
                objectPosition: "left center",
                display: "block",
              }}
            />
          </div>
          {!narrow ? (
            <div style={{ flex: 1, minWidth: 200, maxWidth: 420 }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: H.muted, textTransform: "uppercase", letterSpacing: 1.2, display: "block", marginBottom: 4 }}>
                Company scope
              </label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                style={{
                  width: "100%",
                  background: H.inputBg,
                  border: `1px solid ${H.inputBorder}`,
                  color: H.text,
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                <option value="">All companies</option>
                {tree.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {err ? <div style={{ marginTop: 6, fontSize: 11, color: "#dc2626" }}>{err}</div> : null}
            </div>
          ) : (
            <div style={{ flex: 1 }} />
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: narrow ? 0 : "auto", flexShrink: 0, flexWrap: "wrap", justifyContent: narrow ? "flex-end" : undefined }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 999,
              background: H.inputBg,
              border: `1px solid ${H.barBorder}`,
              maxWidth: 220,
            }}
            title={displayName}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${H.accent}, #7551ff)`,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              {(displayName[0] || "?").toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: H.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</div>
              {me?.role ? <div style={{ fontSize: 10, color: H.muted, fontWeight: 600 }}>{me.role}</div> : null}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const next = theme === "dark" ? "light" : "dark";
              setTheme(next);
              setThemePref(next);
            }}
            style={{
              border: `1px solid ${H.btnBorder}`,
              background: H.barBg,
              color: H.text,
              borderRadius: 10,
              padding: "8px 12px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
              fontFamily: "inherit",
            }}
          >
            {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
          </button>
          <button
            type="button"
            onClick={() => nav("/erp")}
            style={{
              border: `1px solid ${H.accent}`,
              background: "rgba(67,24,209,0.08)",
              color: H.accent,
              borderRadius: 10,
              padding: "8px 14px",
              cursor: "pointer",
              fontWeight: 800,
              fontSize: 12,
              fontFamily: "inherit",
            }}
          >
            ERP
          </button>
          <button
            type="button"
            title="Change your password"
            onClick={() => {
              setPwdTarget(null);
              setPwdOpen(true);
            }}
            style={{
              border: `1px solid ${H.btnBorder}`,
              background: H.barBg,
              color: H.text,
              borderRadius: 10,
              padding: "8px 12px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
              fontFamily: "inherit",
            }}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => {
              logout();
              nav("/login", { replace: true });
            }}
            style={{
              border: `1px solid ${H.btnBorder}`,
              background: H.barBg,
              color: H.muted,
              borderRadius: 10,
              padding: "8px 14px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
              fontFamily: "inherit",
            }}
          >
            Logout
          </button>
        </div>
        </div>
        {narrow ? (
          <div style={{ width: "100%" }}>
            <label style={{ fontSize: 10, fontWeight: 800, color: H.muted, textTransform: "uppercase", letterSpacing: 1.2, display: "block", marginBottom: 4 }}>
              Company scope
            </label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: H.inputBg,
                border: `1px solid ${H.inputBorder}`,
                color: H.text,
                borderRadius: 10,
                padding: "10px 12px",
                fontWeight: 600,
                fontSize: 16,
              }}
            >
              <option value="">All companies</option>
              {tree.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {err ? <div style={{ marginTop: 6, fontSize: 11, color: "#dc2626" }}>{err}</div> : null}
          </div>
        ) : null}
      </header>

      {!narrow ? (
        <aside
          style={{
            gridRow: "2",
            gridColumn: "1",
            borderRight: `1px solid ${t.border}`,
            background: t.panel,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {sidebarInner}
        </aside>
      ) : null}

      {narrow && mobileMenuOpen ? (
        <aside
          style={{
            position: "fixed",
            left: 0,
            top: headerH,
            bottom: 0,
            width: "min(300px, 88vw)",
            zIndex: 1001,
            borderRight: `1px solid ${t.border}`,
            background: t.panel,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden",
            boxShadow: "8px 0 40px rgba(15,23,42,0.15)",
          }}
        >
          {sidebarInner}
        </aside>
      ) : null}

      {/* Main */}
      <main
        style={{
          gridRow: "2",
          gridColumn: narrow ? "1" : "2",
          minHeight: 0,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          background: t.bg,
        }}
      >
        {!canFleet ? (
          <div style={{ padding: 18 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>No Fleet access</div>
            <div style={{ marginTop: 6, color: t.textSoft, fontSize: 12 }}>Ask your admin to grant Fleet features.</div>
          </div>
        ) : (
          <FleetDashboardEmbedded
            theme={theme}
            onThemeChange={(next) => {
              setTheme(next);
              setThemePref(next);
            }}
            view={view}
            onViewChange={setView}
            filterDevIdnos={filterDevIdnos || undefined}
          />
        )}
      </main>
      <ChangePasswordDialog
        open={pwdOpen}
        targetUser={pwdTarget}
        onClose={(ok) => {
          setPwdOpen(false);
          setPwdTarget(null);
        }}
      />
    </div>
  );
}
