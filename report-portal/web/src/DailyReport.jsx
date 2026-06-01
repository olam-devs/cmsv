import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useTheme } from "./theme.jsx";
import { Panel, Inp, Sel, Btn, ErrorBanner, Spinner, Empty, Badge } from "./ui/primitives.jsx";
import { apiFetch, API_BASE, getToken, logout } from "./api.js";

const THRESHOLD_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50];
const fuelTodayIso = () => new Date().toISOString().slice(0, 10);

function fmtTs(isoOrStr) {
  if (!isoOrStr) return "—";
  const d = new Date(isoOrStr);
  if (Number.isNaN(d.getTime())) return String(isoOrStr).slice(0, 16);
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function fmtDay(iso) {
  if (!iso) return "—";
  return String(iso).slice(0, 10);
}

function StatusCell({ ok, label, t }) {
  if (ok === true) {
    return (
      <span title={label || "OK"} style={{ color: t.green, fontWeight: 800, fontSize: 16 }}>
        ✓
      </span>
    );
  }
  if (ok === false) {
    return (
      <span title={label || "Issue"} style={{ color: t.red, fontWeight: 800, fontSize: 16 }}>
        ✗
      </span>
    );
  }
  return <span style={{ color: t.muted }}>—</span>;
}

function TriToggle({ value, onChange, t }) {
  const cycle = () => {
    if (value === true) onChange(false);
    else if (value === false) onChange(null);
    else onChange(true);
  };
  return (
    <button
      type="button"
      onClick={cycle}
      title="Click: OK → Issue → not checked"
      style={{
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        padding: "4px 10px",
        background: value === true ? t.greenSoft : value === false ? t.redSoft : t.panel,
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 700,
        color: value === true ? t.green : value === false ? t.red : t.textSoft,
      }}
    >
      {value === true ? "✓ OK" : value === false ? "✗ Issue" : "—"}
    </button>
  );
}

export default function DailyReport({ username }) {
  const { t } = useTheme();
  const today = fuelTodayIso();
  const [vehicles, setVehicles] = useState([]);
  const [search, setSearch] = useState("");
  const [reportDate, setReportDate] = useState(today);
  const [dropThreshold, setDropThreshold] = useState(20);
  const [reportRaw, setReportRaw] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const loadGenRef = useRef(0);
  const [selectedDev, setSelectedDev] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [bundleDraft, setBundleDraft] = useState("");
  const [updateHistory, setUpdateHistory] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/vehicles")
      .then(setVehicles)
      .catch(() => setVehicles([]));
  }, []);

  const devFilter = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const ids = new Set();
    for (const v of vehicles) {
      const plate = String(v.plate || v.nm || "").toLowerCase();
      const id = String(v.devIdno || "").toLowerCase();
      if (plate.includes(q) || id.includes(q)) ids.add(v.devIdno);
    }
    return ids;
  }, [vehicles, search]);

  const report = useMemo(() => {
    if (!reportRaw) return null;
    const rows =
      devFilter && devFilter.size > 0
        ? (reportRaw.rows || []).filter((r) => devFilter.has(r.devIdno))
        : reportRaw.rows || [];
    const issues = (reportRaw.issues || []).filter(
      (i) => !devFilter?.size || devFilter.has(i.devIdno),
    );
    return { ...reportRaw, rows, issues };
  }, [reportRaw, devFilter]);

  const loadReport = useCallback(
    async (forceRefresh = false) => {
      const gen = ++loadGenRef.current;
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams({
          date: reportDate,
          dropThresholdL: String(dropThreshold),
        });
        if (forceRefresh) q.set("refresh", "1");
        const data = await apiFetch(`/daily-log/report?${q}`, { timeoutMs: 300000 });
        if (gen !== loadGenRef.current) return;
        setReportRaw(data);
      } catch (e) {
        if (gen !== loadGenRef.current) return;
        setError(e.message);
      } finally {
        if (gen === loadGenRef.current) setLoading(false);
      }
    },
    [reportDate, dropThreshold],
  );

  useEffect(() => {
    loadReport(false);
  }, [reportDate, dropThreshold, loadReport]);

  const selected = report?.rows?.find((r) => r.devIdno === selectedDev) || null;

  const selectRow = async (row) => {
    setSelectedDev(row.devIdno);
    setNoteDraft(row.notes || "");
    setBundleDraft(row.bundlePurchasedDate || "");
    try {
      const hist = await apiFetch(
        `/daily-log/vehicle/${encodeURIComponent(row.devIdno)}/history`,
      );
      setUpdateHistory(hist);
    } catch {
      setUpdateHistory(null);
    }
  };

  const saveManual = async (patch) => {
    if (!selectedDev) return;
    setSaving(true);
    setError(null);
    try {
      const q = new URLSearchParams({ date: reportDate });
      const body = {
        camerasOk:
          patch.camerasOk !== undefined ? patch.camerasOk : selected?.camerasOk,
        notes: patch.notes !== undefined ? patch.notes : noteDraft,
        bundlePurchasedDate:
          patch.bundlePurchasedDate !== undefined
            ? patch.bundlePurchasedDate
            : bundleDraft || null,
      };
      const res = await apiFetch(
        `/daily-log/report/${encodeURIComponent(selectedDev)}?${q}`,
        { method: "PATCH", body },
      );
      const row = res?.row || res;
      setReportRaw((prev) => {
        if (!prev) return prev;
        const rows = prev.rows.map((r) =>
          r.devIdno === selectedDev ? { ...r, ...row } : r,
        );
        return {
          ...prev,
          rows,
          issues: rows.flatMap((r) =>
            (r.issues || []).map((i) => ({
              ...i,
              devIdno: r.devIdno,
              plate: r.plate,
            })),
          ),
        };
      });
      if (patch.notes != null) setNoteDraft(patch.notes);
      if (body.bundlePurchasedDate != null)
        setBundleDraft(body.bundlePurchasedDate || "");
      const hist = await apiFetch(
        `/daily-log/vehicle/${encodeURIComponent(selectedDev)}/history`,
      );
      setUpdateHistory(hist);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  const exportCsv = () => {
    const token = getToken();
    const q = new URLSearchParams({
      date: reportDate,
      dropThresholdL: String(dropThreshold),
    });
    fetch(`${API_BASE}/daily-log/report/export?${q}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => {
        if (!r.ok) throw new Error("Export failed");
        return r.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `Helion_Daily_Report_${reportDate}.csv`;
        a.click();
      })
      .catch((e) => setError(e.message));
  };

  const filteredRows = report?.rows || [];
  const topIssues = (report?.issues || []).slice(0, 12);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: "12px 0",
        }}
      >
        <div style={{ fontSize: 13, color: t.textSoft }}>
          Signed in as <strong style={{ color: t.text }}>{username || "Helion"}</strong>
        </div>
        <button
          type="button"
          onClick={() => {
            logout();
            window.location.assign("/login");
          }}
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
          Sign out
        </button>
      </header>

      <div
        style={{
          background: "linear-gradient(135deg, #0d2137 0%, #1a3a5c 100%)",
          color: "#fff",
          borderRadius: 14,
          padding: "18px 24px",
          textAlign: "center",
          fontWeight: 800,
          fontSize: 15,
          letterSpacing: 0.5,
        }}
      >
        HELION TRACKING — DAILY FLEET MONITORING REPORT
      </div>

      <Panel subtitle="Pick CMS analytics day → Refresh from CMS (30–90s). BUNDLE = last data bundle bought. Click a row to edit cameras/notes.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <Inp
            label="Search plate / device"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter table…"
          />
          <Inp
            label="CMS analytics day"
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
          />
          <Sel
            label="Fuel drop alert (L)"
            value={String(dropThreshold)}
            onChange={(e) => setDropThreshold(Number(e.target.value))}
            options={THRESHOLD_OPTIONS.map((n) => ({
              value: String(n),
              label: `${n} L`,
            }))}
          />
          <Btn onClick={() => loadReport(true)} disabled={loading}>
            {loading ? "Loading CMS (up to 2 min)…" : "Refresh from CMS"}
          </Btn>
          {report?.cached && (
            <Badge color={t.textSoft}>Cached — use Refresh for live data</Badge>
          )}
          <Btn onClick={exportCsv} disabled={!report?.rows?.length}>
            Export CSV
          </Btn>
        </div>
        {report?.summary && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <Badge color={t.accent}>{report.summary.total} vehicles</Badge>
            <Badge color={t.red}>{report.summary.withIssues} with issues</Badge>
            <Badge color={t.orange}>{report.summary.offline} offline</Badge>
          </div>
        )}
        {error && (
          <div style={{ marginTop: 12 }}>
            <ErrorBanner message={error} />
          </div>
        )}
      </Panel>

      {topIssues.length > 0 && (
        <Panel title="Issues to review" subtitle="Click vehicle in table for detail">
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 200, overflowY: "auto" }}>
            {topIssues.map((iss, i) => (
              <button
                key={`${iss.devIdno}-${iss.code}-${i}`}
                type="button"
                onClick={() => setSelectedDev(iss.devIdno)}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${t.border}`,
                  background: t.panel,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 12,
                }}
              >
                <strong>{iss.plate}</strong>
                <span style={{ color: t.textSoft, marginLeft: 8 }}>{iss.message}</span>
              </button>
            ))}
          </div>
        </Panel>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: selected ? "1fr minmax(280px, 340px)" : "1fr",
          gap: 16,
        }}
      >
        <Panel
          title={`Fleet table — CMS day ${reportDate}`}
          subtitle="BUNDLE = last internet bundle · LAST SYNC = CMS pull time"
        >
          {loading && !report ? (
            <Spinner label="Building report from CMSV — can take 1–2 minutes…" />
          ) : !filteredRows.length && !loading && !reportRaw ? (
            <Empty message="No data yet. Click Refresh from CMS." />
          ) : filteredRows.length === 0 && reportRaw ? (
            <Empty message="No vehicles match search." />
          ) : (
            <div style={{ overflowX: "auto", opacity: loading ? 0.65 : 1 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#1a3a5c", color: "#fff" }}>
                    {[
                      "NO",
                      "PLATE",
                      "DEVICE",
                      "SIM",
                      "BUNDLE",
                      "LAST SYNC",
                      "LAST GPS",
                      "CAM",
                      "FUEL",
                      "GPRS",
                      "ANTENNA",
                      "HELION",
                      "NOTES",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 8px",
                          textAlign: "left",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, idx) => {
                    const active = row.devIdno === selectedDev;
                    const rowBg = row.hasIssues
                      ? idx % 2 === 0
                        ? "#fff8e6"
                        : "#fff3cd"
                      : idx % 2 === 0
                        ? t.panel
                        : t.bg;
                    return (
                      <tr
                        key={row.devIdno}
                        onClick={() => selectRow(row)}
                        style={{
                          background: active ? t.accentSoft : rowBg,
                          cursor: "pointer",
                          borderBottom: `1px solid ${t.border}`,
                        }}
                      >
                        <td style={{ padding: 8 }}>{row.no ?? idx + 1}</td>
                        <td style={{ padding: 8, fontWeight: 600 }}>{row.plate}</td>
                        <td style={{ padding: 8 }}>{row.devIdno}</td>
                        <td style={{ padding: 8, fontSize: 11 }}>{row.sim || "—"}</td>
                        <td style={{ padding: 8, fontSize: 11 }}>
                          {fmtDay(row.bundlePurchasedDate)}
                        </td>
                        <td style={{ padding: 8, fontSize: 10, color: t.textSoft }}>
                          {fmtTs(row.cmsDataSyncedAt)}
                        </td>
                        <td style={{ padding: 8, fontSize: 10, color: t.textSoft }}>
                          {row.lastGpsUploadAt ? fmtTs(row.lastGpsUploadAt) : "—"}
                        </td>
                        <td style={{ padding: 8 }} onClick={(e) => e.stopPropagation()}>
                          {active ? (
                            <TriToggle
                              value={row.camerasOk}
                              onChange={(v) =>
                                saveManual({ camerasOk: v, notes: noteDraft })
                              }
                              t={t}
                            />
                          ) : (
                            <StatusCell ok={row.camerasOk} t={t} />
                          )}
                        </td>
                        <td style={{ padding: 8 }}>
                          <StatusCell ok={row.fuelSensorOk} t={t} />
                        </td>
                        <td style={{ padding: 8 }}>
                          <StatusCell ok={row.gprsOk} t={t} />
                        </td>
                        <td style={{ padding: 8, fontSize: 11 }}>{row.offlineLabel || "—"}</td>
                        <td style={{ padding: 8, fontSize: 11 }}>{row.helionLabel}</td>
                        <td
                          style={{
                            padding: 8,
                            maxWidth: 220,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.notes || row.autoNotes || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {selected && (
          <Panel title={selected.plate} subtitle="Per-vehicle record">
            <Inp
              label="Data bundle purchased"
              type="date"
              value={bundleDraft}
              onChange={(e) => setBundleDraft(e.target.value)}
            />
            <div style={{ marginTop: 12, fontSize: 12, color: t.textSoft }}>
              {selected.autoNotes}
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Cameras</div>
              <TriToggle
                value={selected.camerasOk}
                onChange={(v) => saveManual({ camerasOk: v, notes: noteDraft })}
                t={t}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Notes</div>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={4}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  borderRadius: 10,
                  border: `1px solid ${t.border}`,
                  padding: 10,
                  fontFamily: "inherit",
                  fontSize: 12,
                }}
              />
              <Btn
                onClick={() =>
                  saveManual({
                    camerasOk: selected.camerasOk,
                    notes: noteDraft,
                    bundlePurchasedDate: bundleDraft || null,
                  })
                }
                disabled={saving}
                style={{ marginTop: 8 }}
              >
                {saving ? "Saving…" : "Save"}
              </Btn>
            </div>
            {updateHistory?.syncLog?.length > 0 && (
              <div style={{ marginTop: 14, fontSize: 10, color: t.textSoft }}>
                {updateHistory.syncLog.slice(0, 8).map((ev) => (
                  <div key={ev.id} style={{ marginBottom: 4 }}>
                    {ev.type === "cms_sync" ? "CMS sync" : "Edited"} · {fmtTs(ev.at)}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}
