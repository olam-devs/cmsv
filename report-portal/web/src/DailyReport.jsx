import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useTheme } from "./theme.jsx";
import { Panel, Inp, Sel, Btn, ErrorBanner, Spinner, Empty, Badge } from "./ui/primitives.jsx";
import { apiFetch, API_BASE, getToken, logout } from "./api.js";
import { FuelCell, GprsCell, AntennaCell } from "./MonitorCells.jsx";

const THRESHOLD_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50];
const FUEL_DROP_FILTER = [5, 10, 20, 30, 50];
const LIVE_REFRESH_MS = 30000;
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
  const [manualHistory, setManualHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [liveTick, setLiveTick] = useState(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [fuelDropMinL, setFuelDropMinL] = useState(20);
  const [customFuelMin, setCustomFuelMin] = useState("");
  const [fuelDropHits, setFuelDropHits] = useState([]);
  const [gprsGapHits, setGprsGapHits] = useState([]);
  const [gprsGapMin, setGprsGapMin] = useState(30);
  const [newNote, setNewNote] = useState("");

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

  const loadLiveRefresh = useCallback(async () => {
    if (!reportRaw?.rows?.length || loading) return;
    try {
      const q = new URLSearchParams({
        date: reportDate,
        dropThresholdL: String(dropThreshold),
      });
      const data = await apiFetch(`/daily-log/report/live-refresh?${q}`, { timeoutMs: 60000 });
      if (data?.rows?.length) {
        setReportRaw((prev) => (prev ? { ...prev, rows: data.rows, liveRefreshedAt: data.refreshedAt } : prev));
        setLiveTick(data.refreshedAt);
      }
    } catch {
      /* keep last rows */
    }
  }, [reportDate, dropThreshold, reportRaw?.rows?.length, loading]);

  useEffect(() => {
    if (!autoRefresh || !reportRaw?.rows?.length) return undefined;
    const id = setInterval(loadLiveRefresh, LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, reportRaw?.rows?.length, loadLiveRefresh]);

  const loadAnalytics = useCallback(async () => {
    const minL = customFuelMin.trim() ? parseFloat(customFuelMin) : fuelDropMinL;
    try {
      const fq = new URLSearchParams({
        date: reportDate,
        minL: String(minL),
        dropThresholdL: String(dropThreshold),
      });
      const gq = new URLSearchParams({
        date: reportDate,
        minGapMin: String(gprsGapMin),
        dropThresholdL: String(dropThreshold),
      });
      const [fuel, gprs] = await Promise.all([
        apiFetch(`/daily-log/analytics/fuel-drops?${fq}`, { timeoutMs: 120000 }),
        apiFetch(`/daily-log/analytics/gprs-gaps?${gq}`, { timeoutMs: 120000 }),
      ]);
      setFuelDropHits(fuel?.hits || []);
      setGprsGapHits(gprs?.hits || []);
    } catch (e) {
      setError(e.message);
    }
  }, [reportDate, dropThreshold, fuelDropMinL, customFuelMin, gprsGapMin]);

  const selected = report?.rows?.find((r) => r.devIdno === selectedDev) || null;

  const selectRow = async (row) => {
    setSelectedDev(row.devIdno);
    setNoteDraft(row.notes || "");
    setBundleDraft(row.bundlePurchasedDate || "");
    setNewNote("");
    try {
      const [hist, manual] = await Promise.all([
        apiFetch(`/daily-log/vehicle/${encodeURIComponent(row.devIdno)}/history`),
        apiFetch(`/daily-log/vehicle/${encodeURIComponent(row.devIdno)}/manual-history`),
      ]);
      setUpdateHistory(hist);
      setManualHistory(Array.isArray(manual) ? manual : []);
    } catch {
      setUpdateHistory(null);
      setManualHistory([]);
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
      if (res?.manualHistory) setManualHistory(res.manualHistory);
      else {
        const manual = await apiFetch(
          `/daily-log/vehicle/${encodeURIComponent(selectedDev)}/manual-history`,
        );
        setManualHistory(Array.isArray(manual) ? manual : []);
      }
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  const addManualNote = async () => {
    if (!selectedDev || !newNote.trim()) return;
    setSaving(true);
    try {
      await apiFetch("/daily-log/entries", {
        method: "POST",
        body: {
          devIdno: selectedDev,
          plate: selected?.plate,
          manualNote: newNote.trim(),
          reportDate,
          entryType: "notes",
        },
      });
      setNewNote("");
      const row = report?.rows?.find((r) => r.devIdno === selectedDev);
      if (row) await selectRow(row);
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

      <Panel subtitle="Refresh from CMS for full day data. Live update every 30s refreshes fuel, location & offline times. Cell colours: green=OK, orange=aging (2h+), red=stale (6h+) or never.">
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
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: t.textSoft }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Live update every 30s
          </label>
          {liveTick && (
            <Badge color={t.textSoft}>Live {fmtTs(liveTick)}</Badge>
          )}
          {report?.cached && (
            <Badge color={t.textSoft}>Cached — use Refresh for live data</Badge>
          )}
          <Btn onClick={exportCsv} disabled={!report?.rows?.length}>
            Export CSV
          </Btn>
          <Btn onClick={() => { setAnalyticsOpen((o) => !o); if (!analyticsOpen) loadAnalytics(); }}>
            {analyticsOpen ? "Hide analytics" : "Fuel drops & GPS gaps"}
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

      {analyticsOpen && (
        <Panel title="Monitoring analytics" subtitle="Fuel drops and GPS location gaps for selected CMS day">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginBottom: 16 }}>
            <Sel
              label="Min fuel drop (L)"
              value={String(fuelDropMinL)}
              onChange={(e) => setFuelDropMinL(Number(e.target.value))}
              options={FUEL_DROP_FILTER.map((n) => ({ value: String(n), label: `${n} L` }))}
            />
            <Inp
              label="Custom min (L)"
              value={customFuelMin}
              onChange={(e) => setCustomFuelMin(e.target.value)}
              placeholder="e.g. 35"
              style={{ width: 100 }}
            />
            <Inp
              label="Min GPS gap (min)"
              value={String(gprsGapMin)}
              onChange={(e) => setGprsGapMin(Number(e.target.value) || 30)}
              type="number"
            />
            <Btn onClick={loadAnalytics}>Run analysis</Btn>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Fuel drops ({fuelDropHits.length})</div>
              <div style={{ maxHeight: 220, overflowY: "auto", fontSize: 11 }}>
                {fuelDropHits.length === 0 ? (
                  <div style={{ color: t.muted }}>None at this threshold</div>
                ) : (
                  fuelDropHits.slice(0, 80).map((h, i) => (
                    <div key={i} style={{ marginBottom: 6, padding: 6, background: t.bg, borderRadius: 6 }}>
                      <strong>{h.plate}</strong> −{h.litres}L at {h.at}
                      {h.minutesSincePrevDrop != null && (
                        <span style={{ color: t.textSoft }}> ({h.minutesSincePrevDrop}m after prev)</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>GPS gaps / stale ({gprsGapHits.length})</div>
              <div style={{ maxHeight: 220, overflowY: "auto", fontSize: 11 }}>
                {gprsGapHits.length === 0 ? (
                  <div style={{ color: t.muted }}>None at this threshold</div>
                ) : (
                  gprsGapHits.slice(0, 80).map((h, i) => (
                    <div key={i} style={{ marginBottom: 6, padding: 6, background: t.bg, borderRadius: 6 }}>
                      <strong>{h.plate}</strong> {h.durationLabel}
                      <div style={{ color: t.textSoft }}>{h.from?.slice(0, 16)} → {h.to?.slice(0, 16) || "—"}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Panel>
      )}

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
            <Empty
              message={
                search.trim()
                  ? "No vehicles match search — clear the search box."
                  : (reportRaw.summary?.total ?? 0) === 0
                    ? "CMS returned 0 vehicles. Check CMS password in report-portal/server/.env, then click Refresh from CMS."
                    : "No rows to display."
              }
            />
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
                          <FuelCell row={row} />
                        </td>
                        <td style={{ padding: 8 }}>
                          <GprsCell row={row} />
                        </td>
                        <td style={{ padding: 8 }}>
                          <AntennaCell row={row} />
                        </td>
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
            <div style={{ marginTop: 14, borderTop: `1px solid ${t.border}`, paddingTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Add new note record</div>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={2}
                placeholder="New monitoring note (saved as separate history entry)…"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                  padding: 8,
                  fontFamily: "inherit",
                  fontSize: 12,
                }}
              />
              <Btn onClick={addManualNote} disabled={saving || !newNote.trim()} style={{ marginTop: 6 }}>
                Add history entry
              </Btn>
            </div>
            {manualHistory.length > 0 && (
              <div style={{ marginTop: 14, borderTop: `1px solid ${t.border}`, paddingTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>All manual records</div>
                <div style={{ maxHeight: 200, overflowY: "auto", fontSize: 10 }}>
                  {manualHistory.map((ent) => (
                    <div
                      key={ent.id}
                      style={{
                        marginBottom: 8,
                        padding: 8,
                        background: t.bg,
                        borderRadius: 8,
                        borderLeft: `3px solid ${ent.fields?.type === "cameras" ? t.orange : t.accent}`,
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>
                        {ent.fields?.type || "note"} · {fmtDay(ent.reportDate)} · {fmtTs(ent.recordedAt)}
                      </div>
                      {ent.createdBy && (
                        <div style={{ color: t.muted }}>by {ent.createdBy}</div>
                      )}
                      <div style={{ marginTop: 4 }}>{ent.manualNote || "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {updateHistory?.syncLog?.length > 0 && (
              <div style={{ marginTop: 14, fontSize: 10, color: t.textSoft }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>CMS sync log</div>
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
