import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "./api.js";
import { useTheme } from "./theme.jsx";
import { Btn, ErrorBanner, Inp, Panel, Spinner } from "./ui/primitives.jsx";

export default function UsersAdmin({ user }) {
  const { t } = useTheme();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [users, setUsers] = useState([]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");

  const isAdmin = user?.role === "admin";

  const sorted = useMemo(() => {
    return [...users].sort((a, b) => String(a.username).localeCompare(String(b.username)));
  }, [users]);

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const list = await apiFetch("/admin/users");
      setUsers(Array.isArray(list) ? list : []);
    } catch (e) {
      setErr(e.message || String(e));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      setErr("Admin only");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async () => {
    setErr("");
    try {
      await apiFetch("/admin/users", {
        method: "POST",
        body: { username: username.trim(), password, role },
      });
      setUsername("");
      setPassword("");
      setRole("user");
      await load();
    } catch (e) {
      setErr(e.message || String(e));
    }
  };

  const del = async (un) => {
    if (!un) return;
    setErr("");
    try {
      await apiFetch(`/admin/users/${encodeURIComponent(un)}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setErr(e.message || String(e));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Report Portal — User Management</div>
          <div style={{ fontSize: 12, color: t.textSoft }}>Create users who can access the report (no admin page access).</div>
        </div>
        <button
          type="button"
          onClick={() => window.location.assign("/")}
          style={{
            background: "transparent",
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            padding: "8px 16px",
            color: t.textSoft,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 13,
          }}
        >
          Back to report
        </button>
      </header>

      {err && <ErrorBanner message={err} />}

      <Panel title="Create / update user" subtitle="If username already exists, it will be updated with the new password/role.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <Inp label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <Inp label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: t.textSoft }}>
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{
                border: `1px solid ${t.border}`,
                borderRadius: 10,
                padding: "10px 12px",
                background: t.panel,
                color: t.text,
                fontFamily: "inherit",
              }}
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <Btn onClick={create} disabled={!username.trim() || password.length < 4}>
            Save user
          </Btn>
          <Btn onClick={load} disabled={loading}>
            Refresh list
          </Btn>
        </div>
      </Panel>

      <Panel title={`Users (${sorted.length})`} subtitle="Only admin sees this page.">
        {loading ? (
          <Spinner label="Loading users…" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sorted.map((u) => (
              <div
                key={u.username}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  border: `1px solid ${t.border}`,
                  borderRadius: 10,
                  background: t.panel,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>{u.username}</div>
                  <div style={{ fontSize: 11, color: t.textSoft }}>role: {u.role || "user"}</div>
                </div>
                <button
                  type="button"
                  onClick={() => del(u.username)}
                  disabled={String(u.username).toLowerCase() === String(user?.username || "").toLowerCase()}
                  style={{
                    border: `1px solid ${t.border}`,
                    background: t.bg,
                    borderRadius: 10,
                    padding: "8px 14px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    color: t.red,
                    fontWeight: 700,
                  }}
                  title="Delete user"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

