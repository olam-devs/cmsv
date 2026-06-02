import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useTheme } from "./theme.jsx";
import { Panel, Inp, Sel, Btn, ErrorBanner, Spinner, Empty, Badge } from "./ui/primitives.jsx";
import { apiFetch, API_BASE, getToken, logout } from "./api.js";
import { FuelCell, GprsCell, AntennaCell } from "./MonitorCells.jsx";
import { cameraStatusFromRow, CamCellLabel } from "./CameraEditor.jsx";
import VehicleEditDrawer from "./VehicleEditDrawer.jsx";
import AnalyticsPanel from "./AnalyticsPanel.jsx";

const THRESHOLD_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50];
const LIVE_REFRESH_MS = 30000;
const fuelTodayIso = () => new Date().toISOString().slice(0, 10);
const dtLocalNowMinus = (mins) => {
  const d = new Date(Date.now() - mins * 60000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

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

export default function DailyReport({ username, user }) {
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
  const [analyticsView, setAnalyticsView] = useState("closed");
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [fuelDropMinL, setFuelDropMinL] = useState(20);
  const [customFuelMin, setCustomFuelMin] = useState("");
  const [fuelDropHits, setFuelDropHits] = useState([]);
  const [gprsGapHits, setGprsGapHits] = useState([]);
  const [gprsGapMin, setGprsGapMin] = useState(30);
  const [newNote, setNewNote] = useState("");
  const [cameraDraft, setCameraDraft] = useState({ mode: "unchecked", badChannels: [] });
  const [analyticsBeginTs, setAnalyticsBeginTs] = useState(() => dtLocalNowMinus(6 * 60));
  const [analyticsEndTs, setAnalyticsEndTs] = useState(() => dtLocalNowMinus(0));

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

  const isToday = reportDate === today;

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
    if (!autoRefresh || !isToday || !reportRaw?.rows?.length) return undefined;
    const id = setInterval(loadLiveRefresh, LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, isToday, reportRaw?.rows?.length, loadLiveRefresh]);

  useEffect(() => {
    if (!selectedDev) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setSelectedDev(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedDev]);

  const loadAnalytics = useCallback(
    async (mode = "both") => {
      const minL = customFuelMin.trim() ? parseFloat(customFuelMin) : fuelDropMinL;
      setAnalyticsLoading(true);
      setError(null);
      try {
        const base = new URLSearchParams({
          begin: analyticsBeginTs,
          end: analyticsEndTs,
          dropThresholdL: String(dropThreshold),
        });
        if (mode === "fuel" || mode === "both") {
          const fq = new URLSearchParams(base);
          fq.set("minL", String(minL));
          const fuel = await apiFetch(`/daily-log/analytics/fuel-drops?${fq}`, { timeoutMs: 300000 });
          setFuelDropHits(fuel?.hits || []);
        }
        if (mode === "gprs" || mode === "both") {
          const gq = new URLSearchParams(base);
          gq.set("minGapMin", String(gprsGapMin));
          const gprs = await apiFetch(`/daily-log/analytics/gprs-gaps?${gq}`, { timeoutMs: 300000 });
          setGprsGapHits(gprs?.hits || []);
        }
      } catch (e) {
        setError(e.message);
      }
      setAnalyticsLoading(false);
    },
    [analyticsBeginTs, analyticsEndTs, dropThreshold, fuelDropMinL, customFuelMin, gprsGapMin],
  );

  const selected = report?.rows?.find((r) => r.devIdno === selectedDev) || null;

  const selectRow = async (row) => {
    setSelectedDev(row.devIdno);
    setNoteDraft(row.notes || "");
    setBundleDraft(row.bundlePurchasedDate || "");
    setNewNote("");
    setCameraDraft(cameraStatusFromRow(row));
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
      const cam =
        patch.cameraStatus !== undefined ? patch.cameraStatus : cameraDraft;
      const body = {
        cameraStatus: cam,
        camerasOk:
          cam.mode === "all_ok" ? true : cam.mode === "issues" ? false : null,
        badChannels: cam.badChannels || [],
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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {user?.role === "admin" && (
            <button
              type="button"
              onClick={() => window.location.assign("/admin/users")}
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
              Admin: Users
            </button>
          )}
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
        </div>
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
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: t.textSoft,
              opacity: isToday ? 1 : 0.5,
            }}
            title={isToday ? "" : "Live refresh only for today"}
          >
            <input
              type="checkbox"
              checked={autoRefresh && isToday}
              disabled={!isToday}
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
          <Btn
            onClick={() => {
              if (analyticsView === "closed") setAnalyticsView("minimized");
              else setAnalyticsView("closed");
            }}
          >
            {analyticsView === "closed" ? "Fuel drops & GPS gaps" : "Close analytics"}
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

      <AnalyticsPanel
        view={analyticsView}
        onViewChange={setAnalyticsView}
        periodLabel="Custom range"
        beginTs={analyticsBeginTs}
        setBeginTs={setAnalyticsBeginTs}
        endTs={analyticsEndTs}
        setEndTs={setAnalyticsEndTs}
        fuelDropMinL={fuelDropMinL}
        setFuelDropMinL={setFuelDropMinL}
        customFuelMin={customFuelMin}
        setCustomFuelMin={setCustomFuelMin}
        gprsGapMin={gprsGapMin}
        setGprsGapMin={setGprsGapMin}
        fuelDropHits={fuelDropHits}
        gprsGapHits={gprsGapHits}
        analyticsLoading={analyticsLoading}
        onRunFuel={() => loadAnalytics("fuel")}
        onRunGprs={() => loadAnalytics("gprs")}
        onRunBoth={() => loadAnalytics("both")}
      />

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

      <Panel
        title={`Fleet table — CMS day ${reportDate}`}
        subtitle="Click a row to edit cameras & notes. Table scrolls independently — close edit panel with ×."
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
            <div
              style={{
                maxHeight: "calc(100vh - 300px)",
                overflow: "auto",
                scrollBehavior: "smooth",
                border: `1px solid ${t.border}`,
                borderRadius: 10,
                opacity: loading ? 0.65 : 1,
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 3 }}>
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
                          boxShadow: active ? `inset 0 0 0 2px ${t.accent}` : undefined,
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
                        <td style={{ padding: 8 }}>
                          <CamCellLabel row={row} t={t} />
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

      <VehicleEditDrawer
        selected={selected}
        bundleDraft={bundleDraft}
        setBundleDraft={setBundleDraft}
        cameraDraft={cameraDraft}
        setCameraDraft={setCameraDraft}
        noteDraft={noteDraft}
        setNoteDraft={setNoteDraft}
        newNote={newNote}
        setNewNote={setNewNote}
        manualHistory={manualHistory}
        updateHistory={updateHistory}
        saving={saving}
        onSave={() =>
          saveManual({
            cameraStatus: cameraDraft,
            notes: noteDraft,
            bundlePurchasedDate: bundleDraft || null,
          })
        }
        onAddNote={addManualNote}
        onClose={() => setSelectedDev(null)}
        fmtTs={fmtTs}
        fmtDay={fmtDay}
      />
    </div>
  );
}
