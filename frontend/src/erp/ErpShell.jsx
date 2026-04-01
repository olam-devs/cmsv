import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, logout } from "../api";
import { useNavigate } from "react-router-dom";
import { getThemePref, setThemePref } from "../themePref";
import { useBreakpoint } from "../useBreakpoint.js";
import ChangePasswordDialog from "../auth/ChangePasswordDialog.jsx";

/** Top app header: fixed look (not tied to page dark/light theme) */
const APP_HEADER_H = 102;
const H = {
  barBg: "#ffffff",
  barBorder: "#e2e8f0",
  text: "#0f172a",
  muted: "#64748b",
  btnBorder: "#cbd5e1",
  accent: "#4318d1",
};

function clsx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function buildStyles(theme) {
  const dark = theme === "dark";
  const t = dark
    ? {
        bg: "#151f32",
        panel: "#1e293b",
        panelBright: "#243047",
        border: "#334155",
        borderHi: "#475569",
        text: "#f1f5f9",
        textSoft: "rgba(203,213,225,0.92)",
        accent: "#4318d1",
        accentSoft: "rgba(117,81,255,0.15)",
        red: "#ee5d50",
        orange: "#ff9500",
        green: "#05cd99",
        blue: "#39b8ff",
      }
    : {
        bg: "#f4f7fe",
        panel: "#ffffff",
        panelBright: "#f9fbff",
        border: "#e9edf7",
        borderHi: "#d1d9f0",
        text: "#1b2559",
        textSoft: "#718096",
        accent: "#4318d1",
        accentSoft: "rgba(67,24,209,0.08)",
        red: "#ee5d50",
        orange: "#ff9500",
        green: "#01b574",
        blue: "#4299e1",
      };

  const pageBg = dark
    ? `radial-gradient(1200px 600px at 15% 0%, rgba(67,24,209,0.20), transparent 60%), ${t.bg}`
    : `radial-gradient(900px 500px at 15% 0%, rgba(67,24,209,0.10), transparent 55%), ${t.bg}`;

  return {
    t,
    pageBg,
    page: {
      minHeight: "100dvh",
      height: "100dvh",
      maxHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      background: pageBg,
      color: t.text,
      fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    },
    mainGrid: (orgCols) => ({
      flex: 1,
      minHeight: 0,
      display: "grid",
      gridTemplateColumns: orgCols,
      background: "transparent",
    }),
    pane: {
      borderRight: `1px solid ${t.border}`,
      overflow: "auto",
    },
    header: {
      position: "sticky",
      top: 0,
      zIndex: 5,
      background: dark
        ? "rgba(17,28,68,0.92)"
        : "rgba(249,251,255,0.92)",
      backdropFilter: "blur(8px)",
      borderBottom: `1px solid ${t.border}`,
      padding: "14px 14px",
    },
    card: {
      background: t.panel,
      border: `1px solid ${t.border}`,
      borderRadius: 12,
    },
    btn: {
      background: t.accent,
      border: 0,
      color: "#fff",
      padding: "10px 12px",
      borderRadius: 10,
      cursor: "pointer",
      fontWeight: 700,
    },
    btnGhost: {
      background: dark ? "transparent" : "rgba(255,255,255,0.55)",
      border: `1px solid ${t.borderHi}`,
      color: t.text,
      padding: "10px 12px",
      borderRadius: 10,
      cursor: "pointer",
      fontWeight: 700,
    },
    input: {
      width: "100%",
      background: dark ? t.bg : "rgba(255,255,255,0.85)",
      border: `1px solid ${t.borderHi}`,
      color: t.text,
      borderRadius: 10,
      padding: "10px 12px",
      outline: "none",
    },
    row: {
      display: "flex",
      gap: 10,
      alignItems: "center",
    },
    muted: { color: t.textSoft },
    badge: {
      fontSize: 12,
      padding: "3px 8px",
      borderRadius: 999,
      border: `1px solid ${t.borderHi}`,
      background: t.accentSoft,
      color: dark ? "#c9c1ff" : t.accent,
      whiteSpace: "nowrap",
    },
  };
}

function OrgNode({ ui, node, level = 0, activeKey, onSelect }) {
  const pad = 12 + level * 12;
  const key = `cmp:${node.id}`;
  const active = activeKey === key;

  return (
    <div>
      <button
        onClick={() => onSelect({ type: "company", id: node.id, key })}
        style={{
          width: "100%",
          textAlign: "left",
          padding: `10px 12px 10px ${pad}px`,
          background: active ? "rgba(117,81,255,0.14)" : "transparent",
          border: 0,
          color: ui.t.text,
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 650 }}>{node.name}</div>
          <span style={ui.badge}>Company</span>
        </div>
      </button>

      {node.branches?.map((b) => (
        <div key={b.id}>
          <button
            onClick={() => onSelect({ type: "branch", id: b.id, companyId: node.id, key: `br:${b.id}` })}
            style={{
              width: "100%",
              textAlign: "left",
              padding: `10px 12px 10px ${pad + 12}px`,
              background: activeKey === `br:${b.id}` ? "rgba(57,184,255,0.10)" : "transparent",
              border: 0,
              color: ui.t.text,
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 600 }}>{b.name}</div>
              <span style={{ ...ui.badge, background: `${ui.t.blue}18`, borderColor: `${ui.t.blue}55`, color: ui.t.blue }}>Branch</span>
            </div>
          </button>

          {b.depots?.map((d) => (
            <button
              key={d.id}
              onClick={() => onSelect({ type: "depot", id: d.id, branchId: b.id, companyId: node.id, key: `dep:${d.id}` })}
              style={{
                width: "100%",
                textAlign: "left",
                padding: `10px 12px 10px ${pad + 24}px`,
                background: activeKey === `dep:${d.id}` ? "rgba(5,205,153,0.10)" : "transparent",
                border: 0,
                color: ui.t.text,
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>{d.name}</div>
                <span style={{ ...ui.badge, background: `${ui.t.green}18`, borderColor: `${ui.t.green}55`, color: ui.t.green }}>Depot</span>
              </div>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function VehicleRow({ ui, v, selected, onSelect, bulkMode, bulkChecked, onBulkToggle }) {
  const asg = v.assignment;
  const pill = asg?.companyId ? "Assigned" : "Unassigned";
  const pillStyle =
    asg?.companyId
      ? { background: `${ui.t.green}1a`, borderColor: `${ui.t.green}55`, color: ui.t.green }
      : { background: `${ui.t.orange}18`, borderColor: `${ui.t.orange}55`, color: ui.t.orange };

  const live = v.live;
  const onlineLabel = live ? (live.online === 0 ? "Offline" : live.online === 2 ? "Alarm" : "Online") : "—";
  const onlineStyle = live
    ? (live.online === 0
        ? { background: `${ui.t.red}18`, borderColor: `${ui.t.red}55`, color: ui.t.red }
        : live.online === 2
          ? { background: `${ui.t.orange}18`, borderColor: `${ui.t.orange}55`, color: ui.t.orange }
          : { background: `${ui.t.green}18`, borderColor: `${ui.t.green}55`, color: ui.t.green })
    : { background: "rgba(255,255,255,0.06)", borderColor: ui.t.borderHi, color: ui.t.textSoft };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
      {bulkMode ? (
        <div style={{ display: "flex", alignItems: "center", paddingLeft: 4 }}>
          <input
            type="checkbox"
            checked={!!bulkChecked}
            onChange={(e) => {
              e.stopPropagation();
              onBulkToggle?.();
            }}
            aria-label="Select for bulk icon"
          />
        </div>
      ) : null}
      <button
        onClick={() => onSelect(v)}
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: "left",
          padding: 12,
          border: `1px solid ${ui.t.border}`,
          borderRadius: 12,
          background: selected ? ui.t.accentSoft : ui.t.panel,
          cursor: "pointer",
        }}
      >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 700 }}>{v.plate}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ ...ui.badge, ...onlineStyle }}>{onlineLabel}</span>
          <span style={{ ...ui.badge, ...pillStyle }}>{pill}</span>
        </div>
      </div>
      <div style={{ marginTop: 6, fontSize: 12, ...ui.muted }}>
        {v.provider} · {v.providerKey}
      </div>
      {v.driver?.name ? (
        <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: ui.t.blue }}>👤 {v.driver.name}</div>
      ) : null}
      {live ? (
        <div style={{ marginTop: 8, fontSize: 12, display: "flex", gap: 10, flexWrap: "wrap", color: ui.t.textSoft }}>
          <span>Speed: <b>{live.speed ?? "—"}</b></span>
          <span>Fuel: <b>{live.fuel ?? "—"}</b></span>
          <span>ACC: <b>{live.accOn == null ? "—" : live.accOn ? "ON" : "OFF"}</b></span>
        </div>
      ) : null}
    </button>
    </div>
  );
}

export default function ErpShell() {
  const nav = useNavigate();
  const [theme, setTheme] = useState(() => getThemePref());
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const narrow = useBreakpoint(920);
  const headerH = narrow ? 76 : APP_HEADER_H;
  const [me, setMe] = useState(null);
  const [orgPaneOpen, setOrgPaneOpen] = useState(true);
  const [tree, setTree] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [activeNode, setActiveNode] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const okTimerRef = useRef(null);
  const flashOk = (msg) => {
    setOkMsg(msg);
    setErrMsg("");
    if (okTimerRef.current) clearTimeout(okTimerRef.current);
    okTimerRef.current = setTimeout(() => setOkMsg(""), 4200);
  };
  const [categories, setCategories] = useState([]);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdTarget, setPwdTarget] = useState(null);

  // Org create forms
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [newDepotName, setNewDepotName] = useState("");
  const [newBranchCompanyId, setNewBranchCompanyId] = useState("");
  const [newDepotBranchId, setNewDepotBranchId] = useState("");

  // Org edit forms (based on activeNode)
  const [editOrgMode, setEditOrgMode] = useState(false);
  const [editOrgName, setEditOrgName] = useState("");

  // Assignment form
  const [asgCompanyId, setAsgCompanyId] = useState("");
  const [asgBranchId, setAsgBranchId] = useState("");
  const [asgDepotId, setAsgDepotId] = useState("");
  const [asgCategoryId, setAsgCategoryId] = useState("");
  const [saving, setSaving] = useState(false);

  const [drivers, setDrivers] = useState([]);
  const [iconFiles, setIconFiles] = useState([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkIds, setBulkIds] = useState([]);
  const [bulkIconPick, setBulkIconPick] = useState("");
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPhone, setNewDriverPhone] = useState("");
  const [asgDriverId, setAsgDriverId] = useState("");
  const [pickIconKey, setPickIconKey] = useState("");

  async function loadTree() {
    const t = await apiFetch("/erp2/org/tree");
    setTree(Array.isArray(t) ? t : []);
  }

  async function loadVehicles(node) {
    const params = new URLSearchParams();
    if (node?.type === "company") params.set("companyId", node.id);
    if (node?.type === "branch") params.set("branchId", node.id);
    if (node?.type === "depot") params.set("depotId", node.id);
    const list = await apiFetch(`/erp2/vehicles/live${params.toString() ? `?${params}` : ""}`);
    setVehicles(Array.isArray(list) ? list : []);
  }

  async function loadCategories() {
    const list = await apiFetch("/erp2/categories");
    setCategories(Array.isArray(list) ? list : []);
  }

  async function loadDrivers() {
    try {
      const d = await apiFetch("/erp2/drivers");
      setDrivers(Array.isArray(d) ? d : []);
    } catch {
      setDrivers([]);
    }
  }

  async function loadIconManifest() {
    try {
      const f = await apiFetch("/icons/manifest");
      setIconFiles(Array.isArray(f) ? f : []);
    } catch {
      setIconFiles([]);
    }
  }

  async function bootstrapFromCms() {
    setSaving(true);
    setErrMsg("");
    setOkMsg("");
    try {
      const cmsVehicles = await apiFetch("/fleet/vehicles");
      const payload = {
        vehicles: (cmsVehicles || []).map((v) => ({
          providerKey: `aws:${v.devIdno}`,
          devIdno: v.devIdno,
          plate: v.plate || v.nm || v.devIdno,
          meta: {},
        })),
      };
      await apiFetch("/erp2/bootstrap/cmsv6", { method: "POST", body: payload });
      await loadVehicles(activeNode);
      flashOk("Imported vehicles from CMS.");
    } catch (e) {
      setErrMsg(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function bootstrapFromMfg() {
    setSaving(true);
    setErrMsg("");
    setOkMsg("");
    try {
      await apiFetch("/erp2/bootstrap/mfg", { method: "POST" });
      await loadVehicles(activeNode);
      flashOk("Imported vehicles from manufacturer CMS.");
    } catch (e) {
      setErrMsg(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function createCompany() {
    const name = newCompanyName.trim();
    if (!name) return;
    setSaving(true);
    setErrMsg("");
    try {
      await apiFetch("/erp2/org/companies", { method: "POST", body: { name } });
      setNewCompanyName("");
      await loadTree();
      flashOk("Company created.");
    } catch (e) {
      setOkMsg("");
      setErrMsg(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function createBranch() {
    const name = newBranchName.trim();
    if (!name) return;
    const companyId = newBranchCompanyId || (activeNode?.type === "company" ? activeNode.id : activeNode?.companyId);
    if (!companyId) {
      setErrMsg("Select a company first to create a branch.");
      return;
    }
    setSaving(true);
    setErrMsg("");
    try {
      await apiFetch("/erp2/org/branches", { method: "POST", body: { companyId, name } });
      setNewBranchName("");
      await loadTree();
      flashOk("Branch created.");
    } catch (e) {
      setOkMsg("");
      setErrMsg(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function createDepot() {
    const name = newDepotName.trim();
    if (!name) return;
    const branchId = newDepotBranchId || (activeNode?.type === "branch" ? activeNode.id : activeNode?.branchId);
    if (!branchId) {
      setErrMsg("Select a branch first to create a depot.");
      return;
    }
    setSaving(true);
    setErrMsg("");
    try {
      await apiFetch("/erp2/org/depots", { method: "POST", body: { branchId, name } });
      setNewDepotName("");
      await loadTree();
      flashOk("Depot created.");
    } catch (e) {
      setOkMsg("");
      setErrMsg(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  function getActiveOrgLabel() {
    if (!activeNode?.type) return null;
    if (activeNode.type === "company") {
      const c = tree.find((x) => x.id === activeNode.id);
      return c ? `Company: ${c.name}` : `Company: ${activeNode.id}`;
    }
    if (activeNode.type === "branch") {
      for (const c of tree) {
        const b = c.branches?.find((x) => x.id === activeNode.id);
        if (b) return `Branch: ${b.name} (${c.name})`;
      }
      return `Branch: ${activeNode.id}`;
    }
    if (activeNode.type === "depot") {
      for (const c of tree) {
        for (const b of c.branches || []) {
          const d = b.depots?.find((x) => x.id === activeNode.id);
          if (d) return `Depot: ${d.name} (${b.name} / ${c.name})`;
        }
      }
      return `Depot: ${activeNode.id}`;
    }
    return null;
  }

  function openEditOrg() {
    setErrMsg("");
    setEditOrgMode(true);
    // Prefill name
    if (activeNode?.type === "company") {
      const c = tree.find((x) => x.id === activeNode.id);
      setEditOrgName(c?.name || "");
      return;
    }
    if (activeNode?.type === "branch") {
      for (const c of tree) {
        const b = c.branches?.find((x) => x.id === activeNode.id);
        if (b) { setEditOrgName(b.name || ""); return; }
      }
      setEditOrgName("");
      return;
    }
    if (activeNode?.type === "depot") {
      for (const c of tree) {
        for (const b of c.branches || []) {
          const d = b.depots?.find((x) => x.id === activeNode.id);
          if (d) { setEditOrgName(d.name || ""); return; }
        }
      }
      setEditOrgName("");
    }
  }

  async function saveOrgEdit() {
    if (!activeNode?.type) return;
    const name = editOrgName.trim();
    if (!name) return setErrMsg("Name is required.");
    setSaving(true);
    setErrMsg("");
    try {
      if (activeNode.type === "company") {
        await apiFetch(`/erp2/org/companies/${encodeURIComponent(activeNode.id)}`, { method: "PUT", body: { name } });
      } else if (activeNode.type === "branch") {
        await apiFetch(`/erp2/org/branches/${encodeURIComponent(activeNode.id)}`, { method: "PUT", body: { name } });
      } else if (activeNode.type === "depot") {
        await apiFetch(`/erp2/org/depots/${encodeURIComponent(activeNode.id)}`, { method: "PUT", body: { name } });
      }
      setEditOrgMode(false);
      await loadTree();
      flashOk("Saved.");
    } catch (e) {
      setOkMsg("");
      setErrMsg(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteActiveOrg() {
    if (!activeNode?.type) return;
    const label = getActiveOrgLabel() || `${activeNode.type}:${activeNode.id}`;
    if (!confirm(`Delete ${label}?\n\nThis will also remove children (branches/depots) and may unassign affected vehicles.`)) return;
    setSaving(true);
    setErrMsg("");
    try {
      if (activeNode.type === "company") {
        await apiFetch(`/erp2/org/companies/${encodeURIComponent(activeNode.id)}`, { method: "DELETE" });
      } else if (activeNode.type === "branch") {
        await apiFetch(`/erp2/org/branches/${encodeURIComponent(activeNode.id)}`, { method: "DELETE" });
      } else if (activeNode.type === "depot") {
        await apiFetch(`/erp2/org/depots/${encodeURIComponent(activeNode.id)}`, { method: "DELETE" });
      }
      setEditOrgMode(false);
      setActiveNode(null);
      await loadTree();
      await loadVehicles(null);
      flashOk("Deleted.");
    } catch (e) {
      setOkMsg("");
      setErrMsg(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  function initAssignmentFromVehicle(v) {
    const a = v?.assignment || null;
    setAsgCompanyId(a?.companyId || "");
    setAsgBranchId(a?.branchId || "");
    setAsgDepotId(a?.depotId || "");
    setAsgCategoryId(a?.categoryId || "");
    setAsgDriverId(v?.driver?.id || "");
    setPickIconKey(v?.meta?.iconKey || "");
  }

  async function saveAssignment() {
    if (!selectedVehicle) return;
    if (!asgCompanyId) {
      setErrMsg("Company is required for assignment.");
      return;
    }
    setSaving(true);
    setErrMsg("");
    try {
      await apiFetch(`/erp2/vehicles/${encodeURIComponent(selectedVehicle.id)}/assign`, {
        method: "POST",
        body: {
          companyId: asgCompanyId,
          branchId: asgBranchId || null,
          depotId: asgDepotId || null,
          categoryId: asgCategoryId || null,
        },
      });
      await loadVehicles(activeNode);
      flashOk("Assignment saved.");
    } catch (e) {
      setOkMsg("");
      setErrMsg(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function unassignVehicle() {
    if (!selectedVehicle) return;
    if (!confirm(`Unassign ${selectedVehicle.plate} from its company?`)) return;
    setSaving(true);
    setErrMsg("");
    try {
      await apiFetch(`/erp2/vehicles/${encodeURIComponent(selectedVehicle.id)}/assign`, { method: "DELETE" });
      initAssignmentFromVehicle({ assignment: null });
      await loadVehicles(activeNode);
      flashOk("Vehicle unassigned from company.");
    } catch (e) {
      setOkMsg("");
      setErrMsg(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function createDriverCard() {
    const name = newDriverName.trim();
    if (!name) return;
    setSaving(true);
    setErrMsg("");
    try {
      await apiFetch("/erp2/drivers", { method: "POST", body: { name, phone: newDriverPhone.trim() || undefined } });
      setNewDriverName("");
      setNewDriverPhone("");
      await loadDrivers();
      flashOk("Driver added.");
    } catch (e) {
      setOkMsg("");
      setErrMsg(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function saveDriverAssignment() {
    if (!selectedVehicle) return;
    setSaving(true);
    setErrMsg("");
    try {
      if (asgDriverId) {
        await apiFetch(`/erp2/vehicles/${encodeURIComponent(selectedVehicle.id)}/driver`, { method: "POST", body: { driverId: asgDriverId } });
      } else {
        await apiFetch(`/erp2/vehicles/${encodeURIComponent(selectedVehicle.id)}/driver`, { method: "DELETE" });
      }
      await loadVehicles(activeNode);
      flashOk(asgDriverId ? "Driver assignment saved." : "Driver unassigned from vehicle.");
    } catch (e) {
      setOkMsg("");
      setErrMsg(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function saveVehicleIcon() {
    if (!selectedVehicle) return;
    setSaving(true);
    setErrMsg("");
    try {
      await apiFetch(`/erp2/vehicles/${encodeURIComponent(selectedVehicle.id)}/meta`, { method: "POST", body: { iconKey: pickIconKey || null } });
      await loadVehicles(activeNode);
      flashOk("Map icon saved.");
    } catch (e) {
      setOkMsg("");
      setErrMsg(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function clearVehicleIcon() {
    if (!selectedVehicle) return;
    setSaving(true);
    setErrMsg("");
    try {
      await apiFetch(`/erp2/vehicles/${encodeURIComponent(selectedVehicle.id)}/meta`, { method: "POST", body: { iconKey: null } });
      setPickIconKey("");
      await loadVehicles(activeNode);
      flashOk("Default map icon restored.");
    } catch (e) {
      setOkMsg("");
      setErrMsg(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function unassignDriverOnly() {
    if (!selectedVehicle) return;
    setSaving(true);
    setErrMsg("");
    try {
      await apiFetch(`/erp2/vehicles/${encodeURIComponent(selectedVehicle.id)}/driver`, { method: "DELETE" });
      setAsgDriverId("");
      await loadVehicles(activeNode);
      flashOk("Driver unassigned from vehicle.");
    } catch (e) {
      setOkMsg("");
      setErrMsg(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function applyBulkIcons() {
    if (!bulkIds.length || !bulkIconPick) {
      setErrMsg("Select vehicles and choose an icon for bulk apply.");
      return;
    }
    setSaving(true);
    setErrMsg("");
    const n = bulkIds.length;
    try {
      await apiFetch("/erp2/vehicles/bulk-icons", { method: "POST", body: { vehicleIds: bulkIds, iconKey: bulkIconPick } });
      setBulkIds([]);
      setBulkMode(false);
      await loadVehicles(activeNode);
      flashOk(`Map icon applied to ${n} vehicle(s).`);
    } catch (e) {
      setOkMsg("");
      setErrMsg(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErrMsg("");
        try {
          const u = await apiFetch("/auth/me");
          setMe(u || null);
        } catch {
          setMe(null);
        }
        await loadTree();
        await loadCategories();
        await loadDrivers();
        await loadIconManifest();
        await loadVehicles(null);
      } catch (e) {
        setErrMsg(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep create selectors in sync with active selection/tree
  useEffect(() => {
    if (activeNode?.type === "company") setNewBranchCompanyId(activeNode.id);
    if (activeNode?.type === "branch") setNewDepotBranchId(activeNode.id);
    if (activeNode?.type === "depot" && activeNode.branchId) setNewDepotBranchId(activeNode.branchId);
  }, [activeNode?.key]);

  useEffect(() => {
    (async () => {
      try {
        await loadVehicles(activeNode);
      } catch (e) {
        setErrMsg(e.message || String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNode?.key]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return vehicles;
    return vehicles.filter((v) => (v.plate || "").toLowerCase().includes(qq) || (v.devIdno || "").includes(qq));
  }, [vehicles, q]);

  const orgCols = orgPaneOpen ? "minmax(260px, 320px) minmax(0, 1fr) 420px" : "52px minmax(0, 1fr) 420px";
  const displayName = me?.username || "User";

  const mainGridStyle = narrow
    ? {
        flex: 1,
        minHeight: 0,
        display: "grid",
        gridTemplateColumns: "1fr",
        gridTemplateRows: orgPaneOpen ? "minmax(200px, 32vh) minmax(240px, 1fr) minmax(220px, 40vh)" : "52px minmax(240px, 1fr) minmax(220px, 40vh)",
        overflow: "hidden",
        background: "transparent",
      }
    : styles.mainGrid(orgCols);

  const paneNarrow = narrow
    ? {
        borderRight: "none",
        borderBottom: `1px solid ${styles.t.border}`,
        minHeight: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }
    : {};

  const paneNarrowScroll = narrow
    ? { flex: 1, minHeight: 0, overflow: "auto", WebkitOverflowScrolling: "touch" }
    : {};

  return (
    <div style={styles.page}>
      <header
        style={{
          flexShrink: 0,
          minHeight: headerH,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: narrow ? 10 : 14,
          flexWrap: "wrap",
          padding: narrow ? "10px 14px" : "0 20px",
          paddingTop: narrow ? "max(10px, env(safe-area-inset-top))" : undefined,
          borderBottom: `1px solid ${H.barBorder}`,
          background: H.barBg,
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
              maxWidth: narrow ? "min(72vw, 280px)" : "min(58vw, 640px)",
              objectFit: "contain",
              objectPosition: "left center",
              display: "block",
            }}
          />
        </div>
        <div style={{ flex: 1, minWidth: narrow ? 80 : 120 }} />
        <div style={{ display: "flex", alignItems: "center", gap: narrow ? 6 : 10, flexShrink: 0, flexWrap: "wrap", justifyContent: narrow ? "flex-end" : undefined, width: narrow ? "100%" : "auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 999,
              border: `1px solid ${H.barBorder}`,
              background: "#f8fafc",
              maxWidth: 220,
            }}
            title={displayName}
          >
            <div
              style={{
                width: 28,
                height: 28,
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
              <div style={{ fontSize: 12, fontWeight: 700, color: H.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</div>
              {me?.role ? <div style={{ fontSize: 10, color: H.muted }}>{me.role}</div> : null}
            </div>
          </div>
          <button
            type="button"
            style={{
              border: `1px solid ${H.btnBorder}`,
              background: H.barBg,
              color: H.text,
              borderRadius: 10,
              padding: "8px 10px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
              fontFamily: "inherit",
            }}
            onClick={() => {
              const next = theme === "dark" ? "light" : "dark";
              setTheme(next);
              setThemePref(next);
            }}
            title="Toggle theme"
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </button>
          <button
            type="button"
            style={{
              border: `1px solid ${H.btnBorder}`,
              background: H.barBg,
              color: H.text,
              borderRadius: 10,
              padding: "8px 10px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
              fontFamily: "inherit",
            }}
            onClick={() => nav("/fleet")}
          >
            Fleet
          </button>
          <button
            type="button"
            style={{
              border: `1px solid ${H.btnBorder}`,
              background: H.barBg,
              color: H.text,
              borderRadius: 10,
              padding: "8px 10px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
              fontFamily: "inherit",
            }}
            onClick={() => nav("/users")}
          >
            Users
          </button>
          <button
            type="button"
            style={{
              border: `1px solid ${H.btnBorder}`,
              background: H.barBg,
              color: H.text,
              borderRadius: 10,
              padding: "8px 10px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
              fontFamily: "inherit",
            }}
            title="Change your password"
            onClick={() => {
              setPwdTarget(null);
              setPwdOpen(true);
            }}
          >
            Password
          </button>
          <button
            type="button"
            style={{
              border: `1px solid ${H.btnBorder}`,
              background: H.barBg,
              color: H.muted,
              borderRadius: 10,
              padding: "8px 10px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
              fontFamily: "inherit",
            }}
            onClick={() => {
              logout();
              nav("/login", { replace: true });
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <div style={mainGridStyle}>
        {!orgPaneOpen ? (
          <div style={{ ...styles.pane, ...paneNarrow, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 12, minWidth: 0 }}>
            <button type="button" title="Expand organization panel" onClick={() => setOrgPaneOpen(true)} style={{ ...styles.btnGhost, padding: "10px 8px" }}>
              ▶
            </button>
          </div>
        ) : (
          <div style={{ ...styles.pane, ...paneNarrow }}>
            <div style={{ ...styles.header, flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, ...styles.muted }}>Companies · Branches · Depots</div>
                <button type="button" title="Collapse panel" onClick={() => setOrgPaneOpen(false)} style={{ ...styles.btnGhost, padding: "6px 10px" }}>
                  ◀
                </button>
              </div>
          {activeNode?.type ? (
            <div style={{ marginTop: 10, ...styles.card, background: theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(67,24,209,0.06)", padding: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800 }}>{getActiveOrgLabel()}</div>
              {!editOrgMode ? (
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button disabled={saving} style={styles.btnGhost} onClick={openEditOrg}>Edit</button>
                  <button disabled={saving} style={{ ...styles.btnGhost, borderColor: styles.t.red, color: styles.t.red }} onClick={deleteActiveOrg}>Delete</button>
                </div>
              ) : (
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  <input value={editOrgName} onChange={(e) => setEditOrgName(e.target.value)} style={styles.input} placeholder="Name…" />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button disabled={saving} style={styles.btn} onClick={saveOrgEdit}>Save</button>
                    <button disabled={saving} style={styles.btnGhost} onClick={() => setEditOrgMode(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <input
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="New company name…"
                style={styles.input}
              />
              <button disabled={saving} style={styles.btn} onClick={createCompany}>
                Add
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <select
                value={newBranchCompanyId}
                onChange={(e) => setNewBranchCompanyId(e.target.value)}
                style={{ ...styles.input, padding: "10px 10px" }}
                title="Company for the new branch"
              >
                <option value="">Select company…</option>
                {tree.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <input
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="New branch name…"
                style={styles.input}
              />
              <button disabled={saving} style={styles.btnGhost} onClick={createBranch}>
                Add
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <select
                value={newDepotBranchId}
                onChange={(e) => setNewDepotBranchId(e.target.value)}
                style={{ ...styles.input, padding: "10px 10px" }}
                title="Branch for the new depot"
              >
                <option value="">Select branch…</option>
                {tree.flatMap((c) => (c.branches || []).map((b) => ({ id: b.id, label: `${c.name} / ${b.name}` }))).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <input
                value={newDepotName}
                onChange={(e) => setNewDepotName(e.target.value)}
                placeholder="New depot name…"
                style={styles.input}
              />
              <button disabled={saving} style={styles.btnGhost} onClick={createDepot}>
                Add
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: 12, display: "grid", gap: 10, ...paneNarrowScroll }}>
          {tree.length === 0 ? (
            <div style={{ ...styles.card, padding: 12 }}>
              <div style={{ fontWeight: 700 }}>No companies yet</div>
              <div style={{ marginTop: 6, fontSize: 12, ...styles.muted }}>
                Create companies/branches/depots via API (UI editor comes next).
              </div>
            </div>
          ) : (
            tree.map((c) => (
              <div key={c.id} style={{ ...styles.card, overflow: "hidden" }}>
                <OrgNode ui={styles} node={c} activeKey={activeNode?.key} onSelect={setActiveNode} />
              </div>
            ))
          )}
        </div>
      </div>
        )}

      {/* Middle: vehicle list */}
      <div style={{ ...styles.pane, ...paneNarrow }}>
        <div style={{ ...styles.header, flexShrink: 0 }}>
          <div style={styles.row}>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.2 }}>Vehicles</div>
            {activeNode?.type ? (
              <span style={styles.badge}>
                Filter: {activeNode.type} {activeNode.id}
              </span>
            ) : (
              <span style={styles.badge}>All</span>
            )}
          </div>
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: narrow ? "1fr" : "1fr auto auto", gap: 10 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search plate or devIdno…" style={styles.input} />
            <button style={styles.btnGhost} onClick={bootstrapFromCms} title="Import CMSV6 vehicles into ERP2">
              Import from CMS
            </button>
            <button style={styles.btnGhost} onClick={bootstrapFromMfg} title="Import vehicles from manufacturer-hosted CMSV6 into ERP2">
              Import MFG
            </button>
          </div>
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              style={{ ...styles.btnGhost, padding: "8px 12px", borderColor: bulkMode ? styles.t.accent : styles.t.borderHi }}
              onClick={() => {
                setBulkMode((m) => !m);
                setBulkIds([]);
              }}
            >
              {bulkMode ? "Exit bulk" : "Bulk map icons"}
            </button>
            {bulkMode ? (
              <>
                <span style={{ fontSize: 12, ...styles.muted }}>{bulkIds.length} selected</span>
                <select
                  value={bulkIconPick}
                  onChange={(e) => setBulkIconPick(e.target.value)}
                  style={{ ...styles.input, padding: "8px 10px", maxWidth: 200 }}
                >
                  <option value="">Pick icon…</option>
                  {iconFiles.map((fn) => (
                    <option key={fn} value={fn}>
                      {fn}
                    </option>
                  ))}
                </select>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 280 }}>
                  {iconFiles.slice(0, 12).map((fn) => (
                    <button
                      key={fn}
                      type="button"
                      title={fn}
                      onClick={() => setBulkIconPick(fn)}
                      style={{
                        width: 40,
                        height: 40,
                        padding: 2,
                        borderRadius: 8,
                        border: bulkIconPick === fn ? `2px solid ${styles.t.accent}` : `1px solid ${styles.t.border}`,
                        background: styles.t.panelBright,
                        cursor: "pointer",
                      }}
                    >
                      <img src={`/api/icons/${encodeURIComponent(fn)}`} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    </button>
                  ))}
                </div>
                <button type="button" style={styles.btn} disabled={saving || !bulkIds.length || !bulkIconPick} onClick={applyBulkIcons}>
                  Apply to selected
                </button>
              </>
            ) : null}
          </div>
          {okMsg ? (
            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: styles.t.green, background: `${styles.t.green}14`, border: `1px solid ${styles.t.green}44`, borderRadius: 10, padding: "10px 12px" }}>
              ✓ {okMsg}
            </div>
          ) : null}
          {errMsg ? <div style={{ marginTop: 10, fontSize: 12, color: styles.t.red }}>{errMsg}</div> : null}
        </div>

        <div style={{ padding: 12, ...paneNarrowScroll }}>
          {loading ? (
            <div style={{ ...styles.card, padding: 12 }}>Loading…</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {filtered.map((v) => (
                <VehicleRow
                  key={v.id}
                  ui={styles}
                  v={v}
                  selected={selectedVehicle?.id === v.id}
                  bulkMode={bulkMode}
                  bulkChecked={bulkIds.includes(v.id)}
                  onBulkToggle={() => setBulkIds((prev) => (prev.includes(v.id) ? prev.filter((x) => x !== v.id) : [...prev, v.id]))}
                  onSelect={(veh) => {
                    setSelectedVehicle(veh);
                    initAssignmentFromVehicle(veh);
                  }}
                />
              ))}
              {filtered.length === 0 ? (
                <div style={{ ...styles.card, padding: 12 }}>
                  <div style={{ fontWeight: 700 }}>No vehicles</div>
                  <div style={{ marginTop: 6, fontSize: 12, ...styles.muted }}>
                    Click <b>Import from CMS</b> to populate ERP2.
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Right: details */}
      <div style={{ overflow: "auto", ...paneNarrow, ...paneNarrowScroll }}>
        <div style={{ ...styles.header, flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.2 }}>Details</div>
          <div style={{ marginTop: 6, fontSize: 12, ...styles.muted }}>Vehicle · Assignment</div>
        </div>

        <div style={{ padding: 12, display: "grid", gap: 10 }}>
          {!selectedVehicle ? (
            <div style={{ ...styles.card, padding: 12 }}>
              <div style={{ fontWeight: 700 }}>Select a vehicle</div>
              <div style={{ marginTop: 6, fontSize: 12, ...styles.muted }}>
                You’ll see assignment + live data wiring here next.
              </div>
            </div>
          ) : (
            <div style={{ ...styles.card, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900 }}>{selectedVehicle.plate}</div>
                  <div style={{ marginTop: 6, fontSize: 12, ...styles.muted }}>
                    {selectedVehicle.provider} · {selectedVehicle.providerKey}
                  </div>
                </div>
                <span style={styles.badge}>ERP v2</span>
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                <div style={{ ...styles.card, background: "#0b1437", padding: 12 }}>
                  <div style={{ fontWeight: 750 }}>Assignment</div>
                  <div style={{ marginTop: 8, fontSize: 12, ...styles.muted }}>
                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>Company</div>
                        <select
                          value={asgCompanyId}
                          onChange={(e) => {
                            setAsgCompanyId(e.target.value);
                            setAsgBranchId("");
                            setAsgDepotId("");
                          }}
                          style={{ ...styles.input, padding: "10px 10px" }}
                        >
                          <option value="">Select company…</option>
                          {tree.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>Branch</div>
                        <select
                          value={asgBranchId}
                          onChange={(e) => {
                            setAsgBranchId(e.target.value);
                            setAsgDepotId("");
                          }}
                          style={{ ...styles.input, padding: "10px 10px" }}
                          disabled={!asgCompanyId}
                        >
                          <option value="">—</option>
                          {(tree.find((c) => c.id === asgCompanyId)?.branches || []).map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>Depot</div>
                        <select
                          value={asgDepotId}
                          onChange={(e) => setAsgDepotId(e.target.value)}
                          style={{ ...styles.input, padding: "10px 10px" }}
                          disabled={!asgBranchId}
                        >
                          <option value="">—</option>
                          {(() => {
                            const c = tree.find((x) => x.id === asgCompanyId);
                            const b = c?.branches?.find((x) => x.id === asgBranchId);
                            return (b?.depots || []).map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ));
                          })()}
                        </select>
                      </div>

                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>Category</div>
                        <select
                          value={asgCategoryId}
                          onChange={(e) => setAsgCategoryId(e.target.value)}
                          style={{ ...styles.input, padding: "10px 10px" }}
                        >
                          <option value="">—</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <div style={{ fontSize: 11, ...styles.muted }}>
                          Categories can be created via API for now (`POST /api/erp2/categories`).
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    ...styles.card,
                    background: theme === "dark" ? "#0b1437" : styles.t.panelBright,
                    padding: 12,
                  }}
                >
                  <div style={{ fontWeight: 750 }}>Driver cards</div>
                  <div style={{ marginTop: 6, fontSize: 12, ...styles.muted }}>
                    Create drivers and assign one to this vehicle for rankings and performance tracking.
                  </div>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    <input
                      value={newDriverName}
                      onChange={(e) => setNewDriverName(e.target.value)}
                      placeholder="New driver name…"
                      style={styles.input}
                    />
                    <input
                      value={newDriverPhone}
                      onChange={(e) => setNewDriverPhone(e.target.value)}
                      placeholder="Phone (optional)"
                      style={styles.input}
                    />
                    <button type="button" disabled={saving} style={styles.btnGhost} onClick={createDriverCard}>
                      Add driver
                    </button>
                  </div>
                  <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>Driver on this vehicle</div>
                    <select
                      value={asgDriverId}
                      onChange={(e) => setAsgDriverId(e.target.value)}
                      style={{ ...styles.input, padding: "10px 10px" }}
                    >
                      <option value="">— Unassigned —</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" disabled={saving} style={styles.btn} onClick={saveDriverAssignment}>
                        Save driver
                      </button>
                      <button type="button" disabled={saving || !selectedVehicle?.driver?.id} style={styles.btnGhost} onClick={unassignDriverOnly}>
                        Unassign driver
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    ...styles.card,
                    background: theme === "dark" ? "#0b1437" : styles.t.panelBright,
                    padding: 12,
                  }}
                >
                  <div style={{ fontWeight: 750 }}>Fleet map icon</div>
                  <div style={{ marginTop: 6, fontSize: 12, ...styles.muted }}>
                    Files are served from the project <b>ICONS</b> folder. If none is saved, the map uses the default bus marker.
                  </div>
                  {iconFiles.length === 0 ? (
                    <div style={{ marginTop: 8, fontSize: 12, ...styles.muted }}>No image files found — add PNG/SVG to ICONS and refresh.</div>
                  ) : (
                    <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 240, overflow: "auto" }}>
                      {iconFiles.map((fn) => (
                        <button
                          key={fn}
                          type="button"
                          title={fn}
                          onClick={() => setPickIconKey(fn)}
                          style={{
                            width: 52,
                            height: 52,
                            padding: 4,
                            borderRadius: 10,
                            cursor: "pointer",
                            background: styles.t.panel,
                            border:
                              pickIconKey === fn ? `2px solid ${styles.t.accent}` : `1px solid ${styles.t.border}`,
                          }}
                        >
                          <img src={`/api/icons/${encodeURIComponent(fn)}`} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" disabled={saving} style={styles.btn} onClick={saveVehicleIcon}>
                      Save icon
                    </button>
                    <button type="button" disabled={saving} style={styles.btnGhost} onClick={clearVehicleIcon}>
                      Use default marker
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    disabled={saving}
                    style={styles.btn}
                    onClick={saveAssignment}
                  >
                    Save assignment
                  </button>
                  <button
                    disabled={saving || !selectedVehicle?.assignment?.companyId}
                    style={{ ...styles.btnGhost, borderColor: styles.t.red, color: styles.t.red }}
                    onClick={unassignVehicle}
                    title="Remove the vehicle from any company"
                  >
                    Unassign
                  </button>
                  <button style={styles.btnGhost} onClick={() => setSelectedVehicle(null)}>
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
      <ChangePasswordDialog
        open={pwdOpen}
        targetUser={pwdTarget}
        onClose={(ok) => {
          setPwdOpen(false);
          setPwdTarget(null);
          if (ok) flashOk("Password updated.");
        }}
      />
    </div>
  );
}

