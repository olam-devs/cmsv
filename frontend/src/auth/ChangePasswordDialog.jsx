import { useEffect, useState } from "react";
import { apiFetch } from "../api";

/**
 * Self-service: any logged-in user (current + new password).
 * Admin reset: superadmin only — pass targetUser { id, username }; no current password.
 */
export default function ChangePasswordDialog({ open, onClose, targetUser = null }) {
  const adminMode = Boolean(targetUser?.id);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrentPassword("");
    setNewPassword("");
    setNewPassword2("");
    setErr("");
    setLoading(false);
    setShowSecrets(false);
  }, [open, targetUser?.id]);

  if (!open) return null;

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (newPassword.length < 6) {
      setErr("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== newPassword2) {
      setErr("New passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      if (adminMode) {
        await apiFetch("/auth/superadmin/set-password", {
          method: "POST",
          body: { userId: targetUser.id, newPassword },
        });
      } else {
        await apiFetch("/auth/change-password", {
          method: "POST",
          body: { currentPassword, newPassword },
        });
      }
      onClose(true);
    } catch (e2) {
      setErr(e2.message || String(e2));
    } finally {
      setLoading(false);
    }
  }

  const overlay = {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.45)",
    zIndex: 5000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    boxSizing: "border-box",
  };

  const card = {
    width: "100%",
    maxWidth: 400,
    background: "#fff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 25px 50px rgba(15,23,42,0.2)",
    fontFamily: "Inter, system-ui, sans-serif",
    color: "#0f172a",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwd-dialog-title"
      style={overlay}
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose(false);
      }}
    >
      <form style={card} onSubmit={submit}>
        <div id="pwd-dialog-title" style={{ fontSize: 18, fontWeight: 800 }}>
          {adminMode ? `Set password — ${targetUser.username}` : "Change your password"}
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: "#64748b", lineHeight: 1.45 }}>
          {adminMode
            ? "Superadmin: set a new password for this user. They will use it on next sign-in."
            : "Enter your current password, then choose a new one (min. 6 characters)."}
        </div>

        <label style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#475569" }}>
          <input type="checkbox" checked={showSecrets} onChange={(e) => setShowSecrets(e.target.checked)} />
          Show passwords
        </label>

        {!adminMode ? (
          <div style={{ marginTop: 18 }}>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>Current password</label>
            <input
              type={showSecrets ? "text" : "password"}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 12px",
                fontSize: 16,
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                fontFamily: "inherit",
              }}
            />
          </div>
        ) : null}

        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>New password</label>
          <input
            type={showSecrets ? "text" : "password"}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px 12px",
              fontSize: 16,
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              fontFamily: "inherit",
            }}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>Confirm new password</label>
          <input
            type={showSecrets ? "text" : "password"}
            autoComplete="new-password"
            value={newPassword2}
            onChange={(e) => setNewPassword2(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px 12px",
              fontSize: 16,
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              fontFamily: "inherit",
            }}
          />
        </div>

        {err ? <div style={{ marginTop: 12, fontSize: 13, color: "#b91c1c" }}>{err}</div> : null}

        <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => onClose(false)}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              background: "#f8fafc",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "none",
              background: loading ? "#94a3b8" : "#4318d1",
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {loading ? "Saving…" : adminMode ? "Set password" : "Update password"}
          </button>
        </div>
      </form>
    </div>
  );
}
