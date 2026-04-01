import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, logout } from "../api";
import { getThemePref, setThemePref } from "../themePref";
import { useBreakpoint } from "../useBreakpoint.js";
import ChangePasswordDialog from "../auth/ChangePasswordDialog.jsx";

const FEATURE_OPTIONS = [
  { id: "erp.read", label: "ERP: view" },
  { id: "erp.org.write", label: "ERP: manage org (companies/branches/depots/categories)" },
  { id: "erp.assign.write", label: "ERP: assign/unassign vehicles" },
  { id: "users.manage", label: "Users: manage users" },
  { id: "fleet.view", label: "Fleet: allow access" },
  { id: "fleet.dashboard", label: "Fleet: dashboard" },
  { id: "fleet.vehicles", label: "Fleet: vehicles" },
  { id: "fleet.map", label: "Fleet: live map" },
  { id: "fleet.cameras", label: "Fleet: live cameras" },
  { id: "fleet.alarms", label: "Fleet: alarms" },
  { id: "fleet.notifications", label: "Fleet: notifications" },
  { id: "fleet.fuel", label: "Fleet: fuel report" },
  { id: "fleet.reports", label: "Fleet: reports" },
  { id: "fleet.routes", label: "Fleet: route tracker" },
  { id: "fleet.chat", label: "Fleet: FleetBot AI" },
];

const APP_HEADER_H = 102;
const UH = {
  barBg: "#ffffff",
  barBorder: "#e2e8f0",
  text: "#0f172a",
  muted: "#64748b",
  btnBorder: "#cbd5e1",
  accent: "#4318d1",
};

export default function UsersPage() {
  const nav = useNavigate();
  const narrow = useBreakpoint(900);
  const headerH = narrow ? 72 : APP_HEADER_H;
  const [theme, setTheme] = useState(() => getThemePref());
  const shell = useMemo(() => {
    const dark = theme === "dark";
    const t = dark
      ? { bg: "#151f32", panel: "#1e293b", panel2: "#243047", border: "#334155", borderHi: "#475569", text: "#f1f5f9", textSoft: "rgba(203,213,225,0.88)", accent: "#4318d1", danger: "#ffb4ad" }
      : { bg: "#f4f7fe", panel: "#ffffff", panel2: "#f9fbff", border: "#e9edf7", borderHi: "#d1d9f0", text: "#1b2559", textSoft: "#718096", accent: "#4318d1", danger: "#b42318" };
    return { dark, t };
  }, [theme]);
  const [users, setUsers] = useState([]);
  const [tree, setTree] = useState([]);
  const [me, setMe] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("viewer");
  const [companyIds, setCompanyIds] = useState([]);
  const [assignAllFeatures, setAssignAllFeatures] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState(["erp.read", "fleet.view", "fleet.dashboard"]);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdTarget, setPwdTarget] = useState(null);

  async function loadAll() {
    setLoading(true);
    setErr("");
    try {
      const [u, t, m] = await Promise.all([apiFetch("/admin/users"), apiFetch("/erp2/org/tree"), apiFetch("/auth/me")]);
      setUsers(Array.isArray(u) ? u : []);
      setTree(Array.isArray(t) ? t : []);
      setMe(m || null);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const companies = useMemo(() => tree.map((c) => ({ id: c.id, name: c.name })), [tree]);
  const myFeatures = useMemo(() => {
    const ef = me?.effectiveFeatures;
    if (!ef) return [];
    if (ef.includes("*")) return FEATURE_OPTIONS.map((f) => f.id);
    return ef;
  }, [me]);
  const allowedFeatureOptions = useMemo(() => {
    const allowed = new Set(myFeatures);
    return FEATURE_OPTIONS.filter((f) => allowed.has(f.id));
  }, [myFeatures]);
  const roleOptions = useMemo(() => {
    const r = me?.role;
    if (r === "superadmin") return ["superadmin", "admin", "viewer"];
    if (r === "admin") return ["viewer"];
    return ["viewer"];
  }, [me]);
  const isSuperadmin = me?.role === "superadmin";

  useEffect(() => {
    // Keep role valid when switching accounts (admin vs superadmin).
    if (!roleOptions.includes(role)) setRole(roleOptions[0] || "viewer");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleOptions.join("|")]);

  async function createUser() {
    setSaving(true);
    setErr("");
    try {
      const features =
        assignAllFeatures
          ? { all: true }
          : { allow: selectedFeatures.filter((f) => myFeatures.includes(f)) };
      await apiFetch("/admin/users", {
        method: "POST",
        body: { username, password, role, companyIds, features },
      });
      setUsername("");
      setPassword("");
      setRole("viewer");
      setCompanyIds([]);
      setAssignAllFeatures(false);
      setSelectedFeatures(["erp.read", "fleet.view", "fleet.dashboard"]);
      await loadAll();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  function toggleCompany(id) {
    setCompanyIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleFeature(id) {
    setSelectedFeatures((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const displayName = me?.username || "User";

  return (
    <div style={{ minHeight: "100dvh", background: shell.t.bg, color: shell.t.text, fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}>
      <header
        style={{
          minHeight: headerH,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: narrow ? 8 : 14,
          flexWrap: "wrap",
          padding: narrow ? "10px 14px" : "0 20px",
          paddingTop: narrow ? "max(10px, env(safe-area-inset-top))" : undefined,
          background: UH.barBg,
          borderBottom: `1px solid ${UH.barBorder}`,
          boxShadow: "0 1px 0 rgba(15,23,42,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", height: narrow ? 40 : headerH, flexShrink: 0, minWidth: 0 }}>
          <img
            src="/hellion-tracking.png"
            alt="Helion Tracking"
            style={{
              height: narrow ? 40 : headerH,
              width: "auto",
              maxWidth: narrow ? "min(75vw, 260px)" : "min(58vw, 640px)",
              objectFit: "contain",
              objectPosition: "left center",
              display: "block",
            }}
          />
        </div>
        <div style={{ flex: 1, minWidth: narrow ? 40 : 80 }} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            borderRadius: 999,
            border: `1px solid ${UH.barBorder}`,
            background: "#f8fafc",
            maxWidth: narrow ? 160 : 220,
            minWidth: 0,
          }}
          title={displayName}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${UH.accent}, #7551ff)`,
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
            <div style={{ fontSize: 12, fontWeight: 700, color: UH.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</div>
            {me?.role ? <div style={{ fontSize: 10, color: UH.muted }}>{me.role}</div> : null}
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
            border: `1px solid ${UH.btnBorder}`,
            background: UH.barBg,
            color: UH.text,
            borderRadius: 10,
            padding: "8px 12px",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 12,
            fontFamily: "inherit",
          }}
        >
          {theme === "dark" ? "🌙" : "☀️"}
        </button>
        <button
          type="button"
          onClick={() => nav("/fleet")}
          style={{
            border: `1px solid ${UH.btnBorder}`,
            background: UH.barBg,
            color: UH.text,
            borderRadius: 10,
            padding: "8px 12px",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 12,
            fontFamily: "inherit",
          }}
        >
          Fleet
        </button>
        <button
          type="button"
          onClick={() => nav("/erp")}
          style={{
            border: `1px solid ${UH.accent}`,
            background: "rgba(67,24,209,0.08)",
            color: UH.accent,
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
          onClick={loadAll}
          style={{
            border: `1px solid ${UH.btnBorder}`,
            background: UH.barBg,
            color: UH.text,
            borderRadius: 10,
            padding: "8px 12px",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 12,
            fontFamily: "inherit",
          }}
        >
          Refresh
        </button>
        <button
          type="button"
          title="Change your password"
          onClick={() => {
            setPwdTarget(null);
            setPwdOpen(true);
          }}
          style={{
            border: `1px solid ${UH.btnBorder}`,
            background: UH.barBg,
            color: UH.text,
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
            border: `1px solid ${UH.btnBorder}`,
            background: UH.barBg,
            color: UH.muted,
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
      </header>

      {err ? <div style={{ padding: "12px 20px", color: shell.t.danger, fontSize: 12 }}>{err}</div> : null}

      <div
        style={{
          padding: narrow ? 12 : 18,
          paddingBottom: "max(18px, env(safe-area-inset-bottom))",
          display: "grid",
          gridTemplateColumns: narrow ? "1fr" : "minmax(260px, 320px) minmax(280px, 420px) 1fr",
          gap: 14,
          alignItems: "start",
        }}
      >
        {/* Companies */}
        <div style={{ background: shell.t.panel, border: `1px solid ${shell.t.border}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: 12, borderBottom: `1px solid ${shell.t.border}`, background: shell.t.panel2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 900 }}>Companies</div>
              <div style={{ marginTop: 4, fontSize: 11, color: shell.t.textSoft }}>Company access for the new user.</div>
            </div>
            <div style={{ fontSize: 11, color: shell.t.textSoft, fontWeight: 800 }}>{companyIds.length}</div>
          </div>
          <div style={{ padding: 12, maxHeight: 560, overflow: "auto" }}>
            {companies.length === 0 ? (
              <div style={{ fontSize: 12, color: shell.t.textSoft }}>No companies found in ERP2.</div>
            ) : (
              companies.map((c) => (
                <label key={c.id} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12, padding: "6px 4px", borderRadius: 10 }}>
                  <input type="checkbox" checked={companyIds.includes(c.id)} onChange={() => toggleCompany(c.id)} />
                  <span style={{ fontWeight: 800 }}>{c.name}</span>
                  <span style={{ marginLeft: "auto", color: shell.t.textSoft, fontSize: 10 }}>{c.id}</span>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Features */}
        <div style={{ background: shell.t.panel, border: `1px solid ${shell.t.border}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: 12, borderBottom: `1px solid ${shell.t.border}`, background: shell.t.panel2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 900 }}>Features</div>
              <div style={{ marginTop: 4, fontSize: 11, color: shell.t.textSoft }}>Feature access for the new user.</div>
            </div>
            <div style={{ fontSize: 11, color: shell.t.textSoft, fontWeight: 800 }}>{assignAllFeatures ? "ALL" : selectedFeatures.length}</div>
          </div>
          <div style={{ padding: 12 }}>
            <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12 }}>
              <input type="checkbox" checked={assignAllFeatures} onChange={() => setAssignAllFeatures((p) => !p)} />
              <span style={{ fontWeight: 900 }}>Assign all features I have</span>
            </label>
            {!assignAllFeatures ? (
              <div style={{ marginTop: 10, display: "grid", gap: 6, maxHeight: 470, overflow: "auto", paddingRight: 6 }}>
                {allowedFeatureOptions.map((f) => (
                  <label key={f.id} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12, padding: "6px 4px", borderRadius: 10 }}>
                    <input type="checkbox" checked={selectedFeatures.includes(f.id)} onChange={() => toggleFeature(f.id)} />
                    <span style={{ fontWeight: 700 }}>{f.label}</span>
                    <span style={{ marginLeft: "auto", color: shell.t.textSoft, fontSize: 10 }}>{f.id}</span>
                  </label>
                ))}
                {allowedFeatureOptions.length === 0 ? <div style={{ fontSize: 12, color: shell.t.textSoft }}>You currently have no assignable features.</div> : null}
              </div>
            ) : (
              <div style={{ marginTop: 10, fontSize: 12, color: shell.t.textSoft }}>This grants every feature you currently have.</div>
            )}
            <div style={{ marginTop: 10, fontSize: 11, color: shell.t.textSoft }}>Admin can only grant a viewer a subset of the admin’s own features.</div>
          </div>
        </div>

        {/* Users */}
        <div style={{ background: shell.t.panel, border: `1px solid ${shell.t.border}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: 12, borderBottom: `1px solid ${shell.t.border}`, background: shell.t.panel2 }}>
            <div style={{ fontWeight: 900 }}>Users</div>
            <div style={{ marginTop: 4, fontSize: 11, color: shell.t.textSoft }}>{loading ? "Loading…" : `${users.length} users`}</div>
          </div>

          <div style={{ padding: 12, borderBottom: `1px solid ${shell.t.border}` }}>
            <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Username</div>
                <input value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: "100%", background: shell.dark ? "#0b1437" : "#ffffff", border: `1px solid ${shell.t.borderHi}`, color: shell.t.text, borderRadius: 10, padding: "10px 12px" }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Password</div>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", background: shell.dark ? "#0b1437" : "#ffffff", border: `1px solid ${shell.t.borderHi}`, color: shell.t.text, borderRadius: 10, padding: "10px 12px" }} />
              </div>
            </div>
            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: narrow ? "1fr" : "220px 1fr", gap: 10, alignItems: "end" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Role</div>
                <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: "100%", background: shell.dark ? "#0b1437" : "#ffffff", border: `1px solid ${shell.t.borderHi}`, color: shell.t.text, borderRadius: 10, padding: "10px 12px" }}>
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <button
                disabled={saving || !username.trim() || password.length < 6}
                onClick={createUser}
                style={{
                  width: "100%",
                  background: shell.t.accent,
                  border: 0,
                  color: "#fff",
                  padding: "10px 12px",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontWeight: 900,
                  opacity: saving ? 0.8 : 1,
                }}
              >
                {saving ? "Creating…" : "Create user"}
              </button>
            </div>
          </div>

          <div style={{ padding: 12, overflow: "auto", maxHeight: narrow ? 360 : 470, WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: narrow ? (isSuperadmin ? 600 : 520) : undefined }}>
              <thead>
                <tr style={{ textAlign: "left", color: shell.t.textSoft }}>
                  <th style={{ padding: "10px 8px", borderBottom: `1px solid ${shell.t.border}` }}>Username</th>
                  <th style={{ padding: "10px 8px", borderBottom: `1px solid ${shell.t.border}` }}>Role</th>
                  <th style={{ padding: "10px 8px", borderBottom: `1px solid ${shell.t.border}` }}>Companies</th>
                  <th style={{ padding: "10px 8px", borderBottom: `1px solid ${shell.t.border}` }}>Active</th>
                  {isSuperadmin ? (
                    <th style={{ padding: "10px 8px", borderBottom: `1px solid ${shell.t.border}`, whiteSpace: "nowrap" }}>Password</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ padding: "10px 8px", borderBottom: `1px solid ${shell.t.border}`, fontWeight: 900 }}>{u.username}</td>
                    <td style={{ padding: "10px 8px", borderBottom: `1px solid ${shell.t.border}` }}>{u.role}</td>
                    <td style={{ padding: "10px 8px", borderBottom: `1px solid ${shell.t.border}` }}>{(u.companyIds || []).length || "—"}</td>
                    <td style={{ padding: "10px 8px", borderBottom: `1px solid ${shell.t.border}` }}>{u.active ? "yes" : "no"}</td>
                    {isSuperadmin ? (
                      <td style={{ padding: "10px 8px", borderBottom: `1px solid ${shell.t.border}` }}>
                        <button
                          type="button"
                          onClick={() => {
                            setPwdTarget({ id: u.id, username: u.username });
                            setPwdOpen(true);
                          }}
                          style={{
                            border: `1px solid ${shell.t.borderHi}`,
                            background: shell.t.panel2,
                            color: shell.t.accent,
                            borderRadius: 8,
                            padding: "6px 10px",
                            cursor: "pointer",
                            fontWeight: 800,
                            fontSize: 11,
                            fontFamily: "inherit",
                          }}
                        >
                          Set
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {users.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={isSuperadmin ? 5 : 4} style={{ padding: 12, color: shell.t.textSoft }}>
                      No users found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
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

