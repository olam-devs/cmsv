/**
 * daily-log.service.js — Fleet daily operations journal
 *
 * Manual entries (multiple per vehicle per day) + auto-generated CMS insights.
 * Persists to data/daily-log.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cms = require('./cmsv6.service');
const {
  normalizeFuelPoints,
  detectFuelEvents,
  totalConsumption,
  buildAutoNotes,
} = require('../utils/fuel-analyze');
const { analyzeGpsTrack, buildInspectionRow } = require('../utils/daily-inspection');
const { sortDailyReportRows } = require('../utils/daily-report-sort');
const uptimeAnalytics = require('./uptime-analytics.service');

const FILE = path.join(__dirname, '../../../data/daily-log.json');
const TIMEZONE = process.env.FLEET_TIMEZONE || 'Africa/Dar_es_Salaam';

let store = {
  entries: [],
  /** @type {Record<string, object>} key: `${devIdno}_${reportDate}` — cameras/notes for that CMS snapshot day */
  inspections: {},
  /** @type {Record<string, object>} persistent per device */
  vehicleMeta: {},
  /** @type {Array} audit trail: cms_sync | manual_edit */
  syncLog: [],
  settings: { defaultDropThresholdL: 20 },
};

function load() {
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      store.entries = raw.entries || [];
      store.inspections = raw.inspections || {};
      store.vehicleMeta = raw.vehicleMeta || {};
      store.syncLog = raw.syncLog || [];
      store.settings = { ...store.settings, ...(raw.settings || {}) };
    }
  } catch (_) {}
}

function save() {
  try {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
    fs.renameSync(tmp, FILE);
  } catch (_) {}
}

load();

function newId() {
  return `dlog_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

function parseDateRange(from, to) {
  const f = String(from || todayStr()).slice(0, 10);
  const t = String(to || f).slice(0, 10);
  return {
    from: f,
    to: t,
    begintime: `${f} 00:00:00`,
    endtime: `${t} 23:59:59`,
  };
}

function entryInRange(entry, from, to) {
  const d = String(entry.reportDate || entry.recordedAt?.slice(0, 10) || '');
  return d >= from && d <= to;
}

function listEntries({ from, to, devIdnos = null, plate = null }) {
  const range = parseDateRange(from, to);
  const idSet = devIdnos?.length ? new Set(devIdnos.map(String)) : null;
  let rows = store.entries.filter((e) => entryInRange(e, range.from, range.to));
  if (idSet) rows = rows.filter((e) => idSet.has(String(e.devIdno)));
  if (plate) {
    const p = String(plate).toLowerCase();
    rows = rows.filter((e) => String(e.plate || '').toLowerCase() === p);
  }
  rows.sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
  return rows;
}

function getEntry(id) {
  return store.entries.find((e) => e.id === id) || null;
}

function createEntry({
  devIdno,
  plate,
  manualNote = '',
  fields = {},
  reportDate,
  autoSnapshot = null,
  createdBy = null,
}) {
  const recordedAt = new Date().toISOString();
  const entry = {
    id: newId(),
    devIdno: String(devIdno || '').trim(),
    plate: String(plate || devIdno || '').trim(),
    reportDate: String(reportDate || recordedAt.slice(0, 10)),
    recordedAt,
    manualNote: String(manualNote || '').trim(),
    fields: fields && typeof fields === 'object' ? fields : {},
    autoSnapshot: autoSnapshot || null,
    createdBy: createdBy || null,
    updatedAt: recordedAt,
  };
  store.entries.push(entry);
  save();
  return entry;
}

function updateEntry(id, patch = {}) {
  const entry = getEntry(id);
  if (!entry) return null;
  if (patch.manualNote != null) entry.manualNote = String(patch.manualNote).trim();
  if (patch.fields != null) entry.fields = { ...entry.fields, ...patch.fields };
  if (patch.reportDate != null) entry.reportDate = String(patch.reportDate).slice(0, 10);
  entry.updatedAt = new Date().toISOString();
  save();
  return entry;
}

function deleteEntry(id) {
  const idx = store.entries.findIndex((e) => e.id === id);
  if (idx < 0) return false;
  store.entries.splice(idx, 1);
  save();
  return true;
}

function getSettings() {
  return { ...store.settings };
}

function setSettings(patch) {
  if (patch.defaultDropThresholdL != null) {
    store.settings.defaultDropThresholdL = Math.max(1, Number(patch.defaultDropThresholdL) || 20);
  }
  save();
  return getSettings();
}

function inspectionKey(devIdno, reportDate) {
  return `${String(devIdno)}_${String(reportDate).slice(0, 10)}`;
}

function ensureVehicleMeta(devIdno, plate = '') {
  const id = String(devIdno);
  if (!store.vehicleMeta[id]) {
    store.vehicleMeta[id] = {
      devIdno: id,
      plate: String(plate || ''),
      bundlePurchasedDate: null,
      lastCmsSyncAt: null,
      lastManualEditAt: null,
      lastGpsUploadAt: null,
    };
  }
  if (plate) store.vehicleMeta[id].plate = String(plate);
  return store.vehicleMeta[id];
}

function getVehicleMeta(devIdno) {
  return store.vehicleMeta[String(devIdno)] || null;
}

function pushSyncLog(evt, persist = true) {
  store.syncLog.unshift({
    id: newId(),
    at: new Date().toISOString(),
    ...evt,
  });
  if (store.syncLog.length > 4000) store.syncLog.length = 4000;
  if (persist) save();
}

function getManualInspection(devIdno, reportDate) {
  return store.inspections[inspectionKey(devIdno, reportDate)] || {};
}

function saveManualInspection(devIdno, reportDate, patch = {}, createdBy = null) {
  const key = inspectionKey(devIdno, reportDate);
  const prev = store.inspections[key] || {};
  const now = new Date().toISOString();
  const meta = ensureVehicleMeta(devIdno, patch.plate || prev.plate);

  if (patch.bundlePurchasedDate !== undefined) {
    const d = patch.bundlePurchasedDate;
    meta.bundlePurchasedDate = d ? String(d).slice(0, 10) : null;
  }

  store.inspections[key] = {
    ...prev,
    devIdno: String(devIdno),
    reportDate: String(reportDate).slice(0, 10),
    camerasOk: patch.camerasOk !== undefined ? patch.camerasOk : prev.camerasOk,
    notes: patch.notes !== undefined ? String(patch.notes) : prev.notes,
    updatedAt: now,
  };

  meta.lastManualEditAt = now;
  save();

  const parts = [];
  if (patch.camerasOk !== undefined) parts.push(`cameras=${patch.camerasOk ? 'OK' : 'issue'}`);
  if (patch.notes !== undefined && patch.notes) parts.push('notes updated');
  if (patch.bundlePurchasedDate !== undefined) parts.push(`bundle=${meta.bundlePurchasedDate || 'cleared'}`);

  pushSyncLog({
    devIdno: String(devIdno),
    plate: meta.plate,
    type: 'manual_edit',
    cmsReportDate: String(reportDate).slice(0, 10),
    summary: parts.join('; ') || 'Manual update',
    createdBy,
  });

  return { inspection: store.inspections[key], vehicleMeta: meta };
}

function attachVehicleTimestamps(row, devIdno, cmsReportDate) {
  const meta = ensureVehicleMeta(devIdno, row.plate);
  const syncedAt = new Date().toISOString();
  meta.lastCmsSyncAt = syncedAt;
  if (row.live?.gpsTime) meta.lastGpsUploadAt = row.live.gpsTime;
  else if (row.connectivity?.lastGpsAt) meta.lastGpsUploadAt = row.connectivity.lastGpsAt;

  row.cmsReportDate = cmsReportDate;
  row.bundlePurchasedDate = meta.bundlePurchasedDate;
  row.cmsDataSyncedAt = syncedAt;
  row.lastManualEditAt = meta.lastManualEditAt;
  row.lastGpsUploadAt = meta.lastGpsUploadAt || row.live?.gpsTime || null;
  row.updatedAt = syncedAt;
  return row;
}

function getVehicleUpdateHistory(devIdno, opts = {}) {
  const id = String(devIdno);
  const limit = Math.min(parseInt(opts.limit) || 100, 300);
  const meta = getVehicleMeta(id) || ensureVehicleMeta(id);

  const syncLog = store.syncLog
    .filter((e) => String(e.devIdno) === id)
    .slice(0, limit);

  const journalEntries = store.entries
    .filter((e) => String(e.devIdno) === id)
    .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))
    .slice(0, limit);

  const inspectionSnapshots = Object.values(store.inspections)
    .filter((i) => String(i.devIdno) === id)
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .slice(0, 50);

  return {
    vehicleMeta: meta,
    syncLog,
    journalEntries,
    inspectionSnapshots,
  };
}

async function buildInspectionForVehicle(vehicle, reportDate, dropThresholdL) {
  const devIdno = vehicle.devIdno || vehicle.id;
  const plate = vehicle.plate || vehicle.nm || devIdno;
  const range = parseDateRange(reportDate, reportDate);
  const dropThreshold = dropThresholdL ?? store.settings.defaultDropThresholdL ?? 20;
  const manual = getManualInspection(devIdno, reportDate);

  const [statusRes, tracksRes, alarmRes] = await Promise.allSettled([
    cms.getVehicleGPS(devIdno),
    cms.getGPSHistory(devIdno, range.begintime, range.endtime),
    cms.getAlarms({ devIdno, begintime: range.begintime, endtime: range.endtime, pageSize: 50 }),
  ]);

  const liveStatus = statusRes.status === 'fulfilled' ? statusRes.value : null;

  const trackList = tracksRes.status === 'fulfilled' ? (tracksRes.value || []) : [];
  const scaledTracks = trackList.map((t) => ({
    gpsTime: t.gpsTime || t.gt,
    gt: t.gt || t.gpsTime,
    fuel: t.fuel,
    yl: t.yl,
  }));
  const fuelSeries = normalizeFuelPoints({ infos: trackList });
  const fuelEvents = detectFuelEvents(fuelSeries, dropThreshold, dropThreshold);
  const isToday = reportDate === todayStr();
  const connectivity = analyzeGpsTrack(trackList.length ? trackList : scaledTracks, {
    asOfMs: isToday ? Date.now() : new Date(`${reportDate}T23:59:59`).getTime(),
    historicalDay: !isToday,
  });

  let uptimeWrap = { offlineNowSecs: 0, last: null };
  try {
    const tl = uptimeAnalytics.timeline(devIdno, { date: reportDate });
    uptimeWrap = {
      offlineNowSecs: tl.summary?.offlineNowSecs || 0,
      last: tl.summary?.last || null,
    };
  } catch (_) {}

  const alarms = alarmRes.status === 'fulfilled' ? (alarmRes.value?.alarms || []) : [];

  const row = buildInspectionRow({
    vehicle,
    liveStatus: liveStatus || { ol: 0, online: 0 },
    fuelSeries,
    fuelEvents,
    connectivity,
    uptimeSummary: uptimeWrap,
    dropThresholdL: dropThreshold,
    reportDate,
    manual: {
      camerasOk: manual.camerasOk,
      notes: manual.notes || '',
      alarmCount: alarms.length,
    },
  });

  row.manualEntries = listEntries({
    from: reportDate,
    to: reportDate,
    devIdnos: [devIdno],
  });

  attachVehicleTimestamps(row, devIdno, reportDate);

  pushSyncLog({
    devIdno,
    plate,
    type: 'cms_sync',
    cmsReportDate: reportDate,
    summary: (row.autoNotes || '').slice(0, 200),
    createdBy: null,
    lastGpsUploadAt: row.lastGpsUploadAt,
    helionStatus: row.helionStatus,
  }, false);

  return row;
}

/** Run async work over items with limited parallelism (CMS calls are slow). */
async function mapWithConcurrency(items, fn, concurrency = 8) {
  const n = items.length;
  if (!n) return [];
  const out = new Array(n);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, n) }, async () => {
    while (next < n) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

const reportBuildCache = new Map();
const inflightReports = new Map();
const REPORT_CACHE_MS = parseInt(process.env.DAILY_REPORT_CACHE_MS, 10) || 180000;

function reportCacheKey(date, dropThresholdL, vehicleCount) {
  return `${date}|${dropThresholdL}|${vehicleCount}`;
}

async function buildDailyFleetReport(vehicles, reportDate, dropThresholdL, opts = {}) {
  const date = String(reportDate || todayStr()).slice(0, 10);
  const cacheKey = reportCacheKey(date, dropThresholdL, vehicles.length);
  if (!opts.forceRefresh) {
    const hit = reportBuildCache.get(cacheKey);
    if (hit && Date.now() - hit.at < REPORT_CACHE_MS) {
      const report = { ...hit.report, cached: true };
      report.rows = sortDailyReportRows(report.rows || []);
      return report;
    }
    const pending = inflightReports.get(cacheKey);
    if (pending) return pending;
  }

  const work = buildDailyFleetReportWork(vehicles, date, dropThresholdL, cacheKey);
  if (!opts.forceRefresh) inflightReports.set(cacheKey, work);
  try {
    return await work;
  } finally {
    inflightReports.delete(cacheKey);
  }
}

async function buildDailyFleetReportWork(vehicles, date, dropThresholdL, cacheKey) {
  const concurrency = Math.max(1, Math.min(16, parseInt(process.env.DAILY_REPORT_CONCURRENCY, 10) || 8));
  const built = await mapWithConcurrency(
    vehicles,
    async (v, i) => {
      try {
        const row = await buildInspectionForVehicle(v, date, dropThresholdL);
        row.no = i + 1;
        return row;
      } catch (e) {
        return {
          no: i + 1,
          devIdno: v.devIdno || v.id,
          plate: v.plate || v.nm,
          reportDate: date,
          error: e.message,
          hasIssues: true,
          issues: [{ code: 'error', message: e.message, severity: 'high' }],
        };
      }
    },
    concurrency,
  );

  const rows = sortDailyReportRows(built);
  const issues = [];
  for (const row of rows) {
    if (row.hasIssues) {
      for (const iss of row.issues) {
        issues.push({
          ...iss,
          devIdno: row.devIdno,
          plate: row.plate,
          reportDate: date,
        });
      }
    }
  }

  issues.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };
    return (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9);
  });

  save();

  const result = {
    reportDate: date,
    reportRefreshedAt: new Date().toISOString(),
    title: 'HELION TRACKING — DAILY FLEET MONITORING REPORT',
    rows,
    summary: {
      total: rows.length,
      withIssues: rows.filter((r) => r.hasIssues).length,
      offline: rows.filter((r) => r.helionStatus !== 'connected').length,
      fuelIssues: rows.filter((r) => r.fuelSensorOk === false).length,
      gprsIssues: rows.filter((r) => r.gprsOk === false).length,
      cameraIssues: rows.filter((r) => r.camerasOk === false).length,
    },
    issues,
    settings: getSettings(),
    cached: false,
  };
  reportBuildCache.set(cacheKey, { at: Date.now(), report: result });
  return result;
}

function rowsToCsv(report) {
  const header = [
    'NO',
    'PLATE / CHASSIS NO',
    'DEVICE ID',
    'SIM NUMBER',
    'DATA BUNDLE PURCHASED',
    'LAST CMS SYNC',
    'LAST GPS UPLOAD',
    'CMS ANALYTICS DAY',
    'CAMERAS',
    'FUEL SENSOR',
    'GPRS',
    'ANTENNA',
    'HELION STATUS',
    'NOTES / DETAILS',
  ];
  const lines = [header.join(',')];
  for (const r of report.rows) {
    const ok = (v) => (v === true ? 'OK' : v === false ? 'ISSUE' : '');
    lines.push(
      [
        r.no,
        `"${String(r.plate || '').replace(/"/g, '""')}"`,
        r.devIdno,
        r.sim || '',
        r.bundlePurchasedDate || '',
        r.cmsDataSyncedAt || '',
        r.lastGpsUploadAt || '',
        r.cmsReportDate || r.reportDate || '',
        ok(r.camerasOk),
        ok(r.fuelSensorOk),
        ok(r.gprsOk),
        r.offlineLabel || ok(r.antennaOk),
        r.helionLabel || '',
        `"${String((r.notes || r.autoNotes || '')).replace(/"/g, '""')}"`,
      ].join(','),
    );
  }
  return lines.join('\n');
}

async function buildVehicleInsight(devIdno, plate, begintime, endtime, dropThresholdL) {
  const dropThreshold = dropThresholdL ?? store.settings.defaultDropThresholdL ?? 20;

  const [tracks, alarmResp, liveFuel] = await Promise.allSettled([
    cms.getGPSHistory(devIdno, begintime, endtime),
    cms.getAlarms({ devIdno, begintime, endtime, pageSize: 100 }),
    cms.getFuelLevel(devIdno),
  ]);

  const trackList = tracks.status === 'fulfilled' ? tracks.value || [] : [];
  const fuelSeries = normalizeFuelPoints({ infos: trackList });
  const fuelEvents = detectFuelEvents(fuelSeries, dropThreshold, dropThreshold);
  const alarms = alarmResp.status === 'fulfilled' ? (alarmResp.value?.alarms || []) : [];

  let live = null;
  if (liveFuel.status === 'fulfilled' && liveFuel.value) {
    const f = liveFuel.value;
    live = {
      fuel: f.fuelValue,
      speed: f.speed,
      online: f.online,
      gpsTime: f.gpsTime,
      lat: f.lat,
      lng: f.lng,
    };
  }

  const autoNote = buildAutoNotes({
    plate,
    devIdno,
    live,
    fuelSeries,
    fuelEvents,
    alarms,
    dropThresholdL: dropThreshold,
  });

  return {
    devIdno,
    plate,
    period: { begintime, endtime },
    dropThresholdL: dropThreshold,
    live,
    fuel: {
      points: fuelSeries.length,
      startL: fuelSeries[0]?.fuel ?? null,
      endL: fuelSeries[fuelSeries.length - 1]?.fuel ?? null,
      consumedL: totalConsumption(fuelSeries),
      events: fuelEvents,
      sharpDrops: fuelEvents.filter((e) => e.type === 'drop'),
      refuels: fuelEvents.filter((e) => e.type === 'refuel'),
    },
    alarms: alarms.slice(0, 20),
    alarmCount: alarms.length,
    autoNote,
  };
}

async function buildInsightsForVehicles(vehicles, begintime, endtime, dropThresholdL) {
  const results = [];
  for (const v of vehicles) {
    const devIdno = v.devIdno || v.id;
    const plate = v.plate || v.nm || devIdno;
    try {
      const insight = await buildVehicleInsight(devIdno, plate, begintime, endtime, dropThresholdL);
      const manualEntries = listEntries({
        from: begintime.slice(0, 10),
        to: endtime.slice(0, 10),
        devIdnos: [devIdno],
      });
      results.push({ ...insight, manualEntries });
    } catch (e) {
      results.push({
        devIdno,
        plate,
        error: e.message,
        autoNote: `Failed to load CMS data: ${e.message}`,
        manualEntries: listEntries({
          from: begintime.slice(0, 10),
          to: endtime.slice(0, 10),
          devIdnos: [devIdno],
        }),
      });
    }
  }
  return results;
}

module.exports = {
  listEntries,
  getEntry,
  createEntry,
  updateEntry,
  deleteEntry,
  getSettings,
  setSettings,
  buildVehicleInsight,
  buildInsightsForVehicles,
  parseDateRange,
  todayStr,
  inspectionKey,
  getManualInspection,
  saveManualInspection,
  buildInspectionForVehicle,
  buildDailyFleetReport,
  rowsToCsv,
  ensureVehicleMeta,
  getVehicleMeta,
  getVehicleUpdateHistory,
  pushSyncLog,
};
