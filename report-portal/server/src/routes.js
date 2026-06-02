/**
 * Daily fleet report API only — no fleet map, ERP, or delivery routes.
 */
const express = require('express');
const path = require('path');

const router = express.Router();
const requireReportUser = require('./require-report-user');
const { verifyLogin, signReportUser } = require('./auth');
const users = require('./users-store');

const MW = path.join(__dirname, '../../../middleware/src');
const dailyLog = require(path.join(MW, 'services/daily-log.service'));
const cms = require(path.join(MW, 'services/cmsv6.service'));
const { normalizeFuelPoints, detectFuelEvents } = require(path.join(MW, 'utils/fuel-analyze'));
const { enrichMonitorFields } = require(path.join(MW, 'utils/report-monitor-fields'));
const { loadFleetVehicles } = require('./vehicles');

const ok = (res, data, meta = {}) => res.json({ success: true, ...meta, data });
const err = (res, msg, status = 400) => res.status(status).json({ success: false, message: msg });

async function loadVehicles(res) {
  try {
    return await loadFleetVehicles();
  } catch (e) {
    err(res, e.message, 503);
    return null;
  }
}

function queryPeriod(req) {
  const date = (req.query.date || req.query.from || dailyLog.todayStr()).slice(0, 10);
  return dailyLog.resolveReportPeriod(date, {
    from: req.query.from,
    to: req.query.to || req.query.date,
  });
}

function dtToCms(str) {
  // Accept: YYYY-MM-DDTHH:MM (datetime-local) OR "YYYY-MM-DD HH:MM:SS"
  const s = String(str || '').trim();
  if (!s) return null;
  if (s.includes('T')) return s.replace('T', ' ') + ':00';
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(s)) return s.includes(':') && s.length === 16 ? s + ':00' : s;
  return null;
}

function queryDateTimeRange(req) {
  const p = queryPeriod(req);
  const bt = dtToCms(req.query.begintime || req.query.begin || req.query.fromTs);
  const et = dtToCms(req.query.endtime || req.query.end || req.query.toTs);
  if (bt && et) {
    return { period: p, begintime: bt, endtime: et };
  }
  // fallback to whole-day range
  return {
    period: p,
    begintime: `${p.from} 00:00:00`,
    endtime: `${p.to} 23:59:59`,
  };
}

async function mapWithConcurrency(items, fn, concurrency = 6) {
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

router.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const v = verifyLogin(username, password);
  if (!v?.ok) {
    return err(res, 'Invalid username or password', 401);
  }
  ok(res, {
    token: signReportUser({ username: v.username, role: v.role }),
    user: { username: v.username, role: v.role },
  });
});

router.get('/auth/me', requireReportUser, (req, res) => {
  ok(res, req.user);
});

router.use(requireReportUser);

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return err(res, 'Admin only', 403);
  return next();
}

router.get('/admin/users', requireAdmin, (req, res) => {
  ok(res, users.listUsers());
});

router.post('/admin/users', requireAdmin, (req, res) => {
  try {
    const { username, password, role } = req.body || {};
    const saved = users.upsertUser({ username, password, role });
    ok(res, saved);
  } catch (e) {
    err(res, e.message, 400);
  }
});

router.delete('/admin/users/:username', requireAdmin, (req, res) => {
  const un = req.params.username;
  if (!un) return err(res, 'username required', 400);
  if (String(un).toLowerCase() === String(req.user?.username || '').toLowerCase()) {
    return err(res, 'Cannot delete your own account', 400);
  }
  ok(res, { deleted: users.deleteUser(un) });
});

async function resolveDevIdno(id) {
  const s = String(id || '').trim();
  const vehicles = await cms.getVehicles();
  const hit = vehicles.find((v) => v.devIdno === s || v.plate === s || v.nm === s);
  return hit?.devIdno || s;
}

router.get('/diagnostics/cms', async (req, res) => {
  try {
    let cmsCount = null;
    let cmsError = null;
    try {
      const cmsList = await cms.getVehicles();
      cmsCount = cmsList.filter((v) => v.devIdno).length;
    } catch (e) {
      cmsError = e.message;
    }
    const fleet = await loadFleetVehicles();
    ok(res, {
      fleetCount: fleet.length,
      cmsDirectCount: cmsCount,
      cmsError,
      cmsv6BaseUrl: process.env.CMSV6_BASE_URL,
      cmsv6User: process.env.CMSV6_USERNAME,
      middlewareApi: process.env.HELION_API_BASE || 'http://127.0.0.1:3000/api',
    });
  } catch (e) {
    err(res, e.message, 503);
  }
});

router.get('/vehicles', async (req, res) => {
  const vehicles = await loadVehicles(res);
  if (vehicles == null) return;
  ok(res, vehicles.map((v) => ({
    devIdno: v.devIdno,
    plate: v.plate || v.nm || v.devIdno,
    nm: v.nm,
  })));
});

router.get('/daily-log/report', async (req, res) => {
  const period = queryPeriod(req);
  const dropThresholdL = parseFloat(req.query.dropThresholdL) || dailyLog.getSettings().defaultDropThresholdL;
  let vehicles = await loadVehicles(res);
  if (vehicles == null) return;
  const filterList = String(req.query.vehicles || '').trim();
  if (filterList) {
    const parts = new Set(filterList.split(',').map((s) => s.trim()).filter(Boolean));
    vehicles = vehicles.filter((v) => parts.has(v.devIdno) || parts.has(v.plate) || parts.has(v.nm));
  }
  const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
  const report = await dailyLog.buildDailyFleetReport(vehicles, period.from, dropThresholdL, {
    from: period.from,
    to: period.to,
    forceRefresh,
  });
  ok(res, report, { period });
});

// Fast table mode: live snapshot only (single CMS call, no per-vehicle track history).
router.get('/daily-log/report/quick', async (req, res) => {
  const date = (req.query.date || dailyLog.todayStr()).slice(0, 10);
  const vehicles = await loadVehicles(res);
  if (vehicles == null) return;
  const statuses = await cms.getAllGPS().catch(() => []);
  const map = new Map();
  for (const s of statuses) {
    const id = String(s.devIdno || s.id || '');
    if (id) map.set(id, s);
  }
  const rows = vehicles.map((v, i) => {
    const devIdno = v.devIdno || v.id;
    const live = map.get(String(devIdno)) || null;
    const online = live ? (live.ol ?? live.online ?? 0) !== 0 : false;
    const row = {
      no: i + 1,
      devIdno,
      plate: v.plate || v.nm || devIdno,
      nm: v.nm,
      reportDate: date,
      live: live
        ? {
            online,
            speed: live.speed,
            fuel: live.fuel,
            gpsTime: live.gpsTime,
            accOn: live.accOn,
            lat: live.lat,
            lng: live.lng,
            ps: live.ps != null ? String(live.ps) : null,
          }
        : null,
      helionStatus: online ? 'connected' : 'offline',
      helionLabel: online ? 'Connected' : 'Offline',
      hasIssues: false,
      issues: [],
      notes: dailyLog.getManualInspection(devIdno, date)?.notes || '',
      bundlePurchasedDate: dailyLog.getVehicleMeta(devIdno)?.bundlePurchasedDate || null,
      camerasOk: dailyLog.getManualInspection(devIdno, date)?.camerasOk ?? null,
      cameraStatus: dailyLog.getManualInspection(devIdno, date)?.cameraStatus ?? null,
      badChannels: dailyLog.getManualInspection(devIdno, date)?.badChannels ?? [],
      gprsLocation: null,
      connectivity: { lastGpsAt: live?.gpsTime || null, offlineSpells: [] },
      offlineDurationSecs: 0,
    };
    enrichMonitorFields(row);
    // gprsDisplay already includes parked/driving + coords from live
    row.hasIssues = row.fuelDisplay?.status === 'error' || row.gprsDisplay?.status === 'error' || row.antennaDisplay?.status === 'error';
    if (row.hasIssues) row.issues.push({ code: 'monitor', message: 'Monitoring issue', severity: 'low' });
    return row;
  });
  ok(
    res,
    {
      reportDate: date,
      reportRefreshedAt: new Date().toISOString(),
      title: 'HELION TRACKING — DAILY FLEET MONITORING REPORT',
      rows,
      summary: {
        total: rows.length,
        withIssues: rows.filter((r) => r.hasIssues).length,
        offline: rows.filter((r) => r.helionStatus !== 'connected').length,
      },
      cached: false,
      quick: true,
    },
    { period: { from: date, to: date, label: date, singleDay: true } },
  );
});

router.get('/daily-log/report/export', async (req, res) => {
  const period = queryPeriod(req);
  const dropThresholdL = parseFloat(req.query.dropThresholdL) || dailyLog.getSettings().defaultDropThresholdL;
  const vehicles = await loadVehicles(res);
  if (vehicles == null) return;
  const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
  const report = await dailyLog.buildDailyFleetReport(vehicles, period.from, dropThresholdL, {
    from: period.from,
    to: period.to,
    forceRefresh,
  });
  const csv = dailyLog.rowsToCsv(report);
  const fname =
    period.from === period.to
      ? `Helion_Daily_Report_${period.from}.csv`
      : `Helion_Report_${period.from}_to_${period.to}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
  res.send(csv);
});

router.get('/daily-log/vehicle/:id/history', async (req, res) => {
  const devIdno = await resolveDevIdno(req.params.id);
  ok(res, dailyLog.getVehicleUpdateHistory(devIdno, { limit: req.query.limit }));
});

router.patch('/daily-log/report/:id', async (req, res) => {
  const devIdno = await resolveDevIdno(req.params.id);
  const date = (req.query.date || req.body?.reportDate || dailyLog.todayStr()).slice(0, 10);
  const { camerasOk, cameraStatus, badChannels, notes, bundlePurchasedDate } = req.body || {};
  let vehicles;
  try {
    vehicles = await cms.getVehicles();
  } catch (e) {
    return err(res, `CMS connection failed: ${e.message}`, 503);
  }
  const v = vehicles.find((x) => x.devIdno === devIdno) || { devIdno, plate: req.params.id };
  const saved = dailyLog.saveManualInspection(
    devIdno,
    date,
    {
      camerasOk,
      cameraStatus,
      badChannels,
      notes,
      bundlePurchasedDate,
      plate: v.plate || v.nm,
    },
    req.user?.username || null,
  );
  const row = await dailyLog.buildInspectionForVehicle(v, date, dailyLog.getSettings().defaultDropThresholdL);
  const manualHistory = dailyLog.getManualHistory(devIdno, { limit: 100 });
  ok(res, { manual: saved.inspection, vehicleMeta: saved.vehicleMeta, row, manualHistory });
});

router.get('/daily-log/report/live-refresh', async (req, res) => {
  const period = queryPeriod(req);
  const dropThresholdL = parseFloat(req.query.dropThresholdL) || dailyLog.getSettings().defaultDropThresholdL;
  const vehicles = await loadVehicles(res);
  if (vehicles == null) return;
  let payload = await dailyLog.refreshReportLiveByDate(period.to, dropThresholdL, vehicles, {
    from: period.from,
    to: period.to,
  });
  if (!payload && req.query.rows) {
    try {
      const rows = JSON.parse(req.query.rows);
      payload = await dailyLog.refreshReportLive(rows, date);
    } catch (_) {}
  }
  if (!payload) {
    return err(res, 'No cached report for this day — click Refresh from CMS first', 404);
  }
  ok(res, payload, { period });
});

router.post('/daily-log/report/live-refresh', async (req, res) => {
  const date = (req.query.date || req.body?.date || dailyLog.todayStr()).slice(0, 10);
  const rows = req.body?.rows;
  if (!Array.isArray(rows) || !rows.length) {
    return err(res, 'Body must include rows array from current report', 400);
  }
  const payload = await dailyLog.refreshReportLive(rows, date);
  ok(res, payload, { period: { date } });
});

router.get('/daily-log/analytics/fuel-drops', async (req, res) => {
  const minL = parseFloat(req.query.minL) || 20;
  const dropThresholdL = parseFloat(req.query.dropThresholdL) || dailyLog.getSettings().defaultDropThresholdL;
  const { period, begintime, endtime } = queryDateTimeRange(req);
  const vehicles = await loadVehicles(res);
  if (vehicles == null) return;

  const maxGapMin = parseFloat(req.query.maxGapMin) || 180;
  const maxGapMs = Math.max(1, maxGapMin) * 60 * 1000;
  const concurrency = Math.max(1, Math.min(12, parseInt(process.env.ANALYTICS_CONCURRENCY || '', 10) || 6));

  const perVehicle = await mapWithConcurrency(
    vehicles,
    async (v) => {
      const devIdno = v.devIdno;
      if (!devIdno) return [];
      let tracks = [];
      try {
        tracks = await cms.getGPSHistory(devIdno, begintime, endtime);
      } catch (_) {
        return [];
      }
      const series = normalizeFuelPoints({ infos: tracks });
      const evs = detectFuelEvents(series, dropThresholdL, dropThresholdL).filter((e) => e.type === 'drop' && e.litres >= minL);
      const out = [];
      for (let i = 0; i < evs.length; i++) {
        const d = evs[i];
        let gapMin = null;
        if (i > 0 && evs[i - 1].time && d.time) {
          const diff = d.time - evs[i - 1].time;
          if (diff > 0) gapMin = Math.round(diff / 60000);
        }
        if (i === 0 || gapMin == null || (gapMin * 60000) <= maxGapMs) {
          out.push({
            devIdno,
            plate: v.plate || v.nm || devIdno,
            litres: d.litres,
            at: d.timeStr || (d.time ? new Date(d.time).toISOString() : null),
            minutesSincePrevDrop: gapMin,
          });
        }
      }
      return out;
    },
    concurrency,
  );

  const hits = perVehicle.flat().sort((a, b) => (b.litres || 0) - (a.litres || 0));
  ok(res, { hits, minL, period, range: { begintime, endtime } }, { count: hits.length });
});

router.get('/daily-log/analytics/gprs-gaps', async (req, res) => {
  const minGapMin = parseFloat(req.query.minGapMin) || 30;
  const dropThresholdL = parseFloat(req.query.dropThresholdL) || dailyLog.getSettings().defaultDropThresholdL;
  const { period, begintime, endtime } = queryDateTimeRange(req);
  const vehicles = await loadVehicles(res);
  if (vehicles == null) return;

  const minGapMs = Math.max(1, minGapMin) * 60 * 1000;
  const concurrency = Math.max(1, Math.min(12, parseInt(process.env.ANALYTICS_CONCURRENCY || '', 10) || 6));
  const endMs = new Date(endtime.replace(' ', 'T')).getTime();

  const perVehicle = await mapWithConcurrency(
    vehicles,
    async (v) => {
      const devIdno = v.devIdno;
      if (!devIdno) return [];
      let tracks = [];
      try {
        tracks = await cms.getGPSHistory(devIdno, begintime, endtime);
      } catch (_) {
        return [];
      }
      const pts = (tracks || [])
        .map((t) => ({ ts: new Date(String(t.gpsTime || t.gt || '').replace(' ', 'T')).getTime(), iso: t.gpsTime || t.gt || null }))
        .filter((p) => Number.isFinite(p.ts))
        .sort((a, b) => a.ts - b.ts);

      const hits = [];
      for (let i = 1; i < pts.length; i++) {
        const gap = pts[i].ts - pts[i - 1].ts;
        if (gap >= minGapMs) {
          hits.push({
            devIdno,
            plate: v.plate || v.nm || devIdno,
            durationSecs: Math.round(gap / 1000),
            durationLabel: `${Math.round(gap / 60000)}m`,
            from: pts[i - 1].iso || new Date(pts[i - 1].ts).toISOString(),
            to: pts[i].iso || new Date(pts[i].ts).toISOString(),
          });
        }
      }

      // stale at end of window (no recent GPS)
      if (pts.length) {
        const last = pts[pts.length - 1];
        const staleGap = endMs - last.ts;
        if (Number.isFinite(endMs) && staleGap >= minGapMs) {
          hits.push({
            devIdno,
            plate: v.plate || v.nm || devIdno,
            durationSecs: Math.round(staleGap / 1000),
            durationLabel: `Stale GPS (${Math.round(staleGap / 60000)}m)`,
            from: last.iso || new Date(last.ts).toISOString(),
            to: null,
          });
        }
      }

      return hits;
    },
    concurrency,
  );

  const hits = perVehicle.flat().sort((a, b) => (b.durationSecs || 0) - (a.durationSecs || 0));
  ok(res, { hits, minGapMin, period, range: { begintime, endtime } }, { count: hits.length });
});

router.post('/daily-log/entries', async (req, res) => {
  const { devIdno, plate, manualNote, reportDate, fields, entryType } = req.body || {};
  if (!devIdno) return err(res, 'devIdno required', 400);
  const entry = dailyLog.createEntry({
    devIdno,
    plate,
    manualNote: manualNote || '',
    reportDate: reportDate || dailyLog.todayStr(),
    fields: { ...(fields || {}), type: entryType || fields?.type || 'note' },
    createdBy: req.user?.username || null,
  });
  ok(res, entry);
});

router.get('/daily-log/vehicle/:id/manual-history', async (req, res) => {
  const devIdno = await resolveDevIdno(req.params.id);
  ok(res, dailyLog.getManualHistory(devIdno, { limit: req.query.limit }));
});

router.get('/daily-log/report/:id/live', async (req, res) => {
  const run = { devIdno: await resolveDevIdno(req.params.id) };
  const date = (req.query.date || dailyLog.todayStr()).slice(0, 10);
  let vehicles;
  try {
    vehicles = await cms.getVehicles();
  } catch (e) {
    return err(res, `CMS connection failed: ${e.message}`, 503);
  }
  const v = vehicles.find((x) => x.devIdno === run.devIdno) || { devIdno: run.devIdno };
  const row = await dailyLog.buildInspectionForVehicle(v, date, dailyLog.getSettings().defaultDropThresholdL);
  const statuses = await cms.getAllGPS();
  const truck = statuses.find((x) => String(x.devIdno || x.id) === String(run.devIdno));
  ok(res, { row, truck: truck || null });
});

module.exports = router;
