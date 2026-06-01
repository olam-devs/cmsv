/**
 * Daily fleet report API only — no fleet map, ERP, or delivery routes.
 */
const express = require('express');
const path = require('path');

const router = express.Router();
const requireReportUser = require('./require-report-user');
const { verifyLogin, signReportUser } = require('./auth');

const MW = path.join(__dirname, '../../../middleware/src');
const dailyLog = require(path.join(MW, 'services/daily-log.service'));
const cms = require(path.join(MW, 'services/cmsv6.service'));
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

router.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!verifyLogin(username, password)) {
    return err(res, 'Invalid username or password', 401);
  }
  ok(res, {
    token: signReportUser(),
    user: { username: String(username).trim() },
  });
});

router.get('/auth/me', requireReportUser, (req, res) => {
  ok(res, req.user);
});

router.use(requireReportUser);

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
  const date = (req.query.date || req.query.from || dailyLog.todayStr()).slice(0, 10);
  const dropThresholdL = parseFloat(req.query.dropThresholdL) || dailyLog.getSettings().defaultDropThresholdL;
  let vehicles = await loadVehicles(res);
  if (vehicles == null) return;
  const filterList = String(req.query.vehicles || '').trim();
  if (filterList) {
    const parts = new Set(filterList.split(',').map((s) => s.trim()).filter(Boolean));
    vehicles = vehicles.filter((v) => parts.has(v.devIdno) || parts.has(v.plate) || parts.has(v.nm));
  }
  const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
  const report = await dailyLog.buildDailyFleetReport(vehicles, date, dropThresholdL, { forceRefresh });
  ok(res, report, { period: { date } });
});

router.get('/daily-log/report/export', async (req, res) => {
  const date = (req.query.date || dailyLog.todayStr()).slice(0, 10);
  const dropThresholdL = parseFloat(req.query.dropThresholdL) || dailyLog.getSettings().defaultDropThresholdL;
  const vehicles = await loadVehicles(res);
  if (vehicles == null) return;
  const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
  const report = await dailyLog.buildDailyFleetReport(vehicles, date, dropThresholdL, { forceRefresh });
  const csv = dailyLog.rowsToCsv(report);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="Helion_Daily_Report_${date}.csv"`);
  res.send(csv);
});

router.get('/daily-log/vehicle/:id/history', async (req, res) => {
  const devIdno = await resolveDevIdno(req.params.id);
  ok(res, dailyLog.getVehicleUpdateHistory(devIdno, { limit: req.query.limit }));
});

router.patch('/daily-log/report/:id', async (req, res) => {
  const devIdno = await resolveDevIdno(req.params.id);
  const date = (req.query.date || req.body?.reportDate || dailyLog.todayStr()).slice(0, 10);
  const { camerasOk, notes, bundlePurchasedDate } = req.body || {};
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
    { camerasOk, notes, bundlePurchasedDate, plate: v.plate || v.nm },
    req.user?.username || null,
  );
  const row = await dailyLog.buildInspectionForVehicle(v, date, dailyLog.getSettings().defaultDropThresholdL);
  const manualHistory = dailyLog.getManualHistory(devIdno, { limit: 100 });
  ok(res, { manual: saved.inspection, vehicleMeta: saved.vehicleMeta, row, manualHistory });
});

router.get('/daily-log/report/live-refresh', async (req, res) => {
  const date = (req.query.date || dailyLog.todayStr()).slice(0, 10);
  const dropThresholdL = parseFloat(req.query.dropThresholdL) || dailyLog.getSettings().defaultDropThresholdL;
  const vehicles = await loadVehicles(res);
  if (vehicles == null) return;
  let payload = await dailyLog.refreshReportLiveByDate(date, dropThresholdL, vehicles);
  if (!payload && req.query.rows) {
    try {
      const rows = JSON.parse(req.query.rows);
      payload = await dailyLog.refreshReportLive(rows, date);
    } catch (_) {}
  }
  if (!payload) {
    return err(res, 'No cached report for this day — click Refresh from CMS first', 404);
  }
  ok(res, payload, { period: { date } });
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
  const date = (req.query.date || dailyLog.todayStr()).slice(0, 10);
  const minL = parseFloat(req.query.minL) || 20;
  const dropThresholdL = parseFloat(req.query.dropThresholdL) || dailyLog.getSettings().defaultDropThresholdL;
  const vehicles = await loadVehicles(res);
  if (vehicles == null) return;
  const report = await dailyLog.buildDailyFleetReport(vehicles, date, dropThresholdL, { forceRefresh: false });
  const hits = dailyLog.analyzeFleetFuelDrops(report.rows, minL, req.query.maxGapMin);
  ok(res, { hits, minL, date }, { count: hits.length });
});

router.get('/daily-log/analytics/gprs-gaps', async (req, res) => {
  const date = (req.query.date || dailyLog.todayStr()).slice(0, 10);
  const minGapMin = parseFloat(req.query.minGapMin) || 30;
  const dropThresholdL = parseFloat(req.query.dropThresholdL) || dailyLog.getSettings().defaultDropThresholdL;
  const vehicles = await loadVehicles(res);
  if (vehicles == null) return;
  const report = await dailyLog.buildDailyFleetReport(vehicles, date, dropThresholdL, { forceRefresh: false });
  const hits = dailyLog.analyzeFleetGprsGaps(report.rows, minGapMin);
  ok(res, { hits, minGapMin, date }, { count: hits.length });
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
