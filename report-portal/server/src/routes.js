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

const ok = (res, data, meta = {}) => res.json({ success: true, ...meta, data });
const err = (res, msg, status = 400) => res.status(status).json({ success: false, message: msg });

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
  const vehicles = await cms.getVehicles().catch(() => []);
  const hit = vehicles.find((v) => v.devIdno === s || v.plate === s || v.nm === s);
  return hit?.devIdno || s;
}

router.get('/vehicles', async (req, res) => {
  const vehicles = await cms.getVehicles().catch(() => []);
  ok(res, vehicles.map((v) => ({
    devIdno: v.devIdno,
    plate: v.plate || v.nm || v.devIdno,
    nm: v.nm,
  })));
});

router.get('/daily-log/report', async (req, res) => {
  const date = (req.query.date || req.query.from || dailyLog.todayStr()).slice(0, 10);
  const dropThresholdL = parseFloat(req.query.dropThresholdL) || dailyLog.getSettings().defaultDropThresholdL;
  let vehicles = await cms.getVehicles().catch(() => []);
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
  const vehicles = await cms.getVehicles().catch(() => []);
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
  const vehicles = await cms.getVehicles().catch(() => []);
  const v = vehicles.find((x) => x.devIdno === devIdno) || { devIdno, plate: req.params.id };
  const saved = dailyLog.saveManualInspection(
    devIdno,
    date,
    { camerasOk, notes, bundlePurchasedDate, plate: v.plate || v.nm },
    req.user?.username || null,
  );
  const row = await dailyLog.buildInspectionForVehicle(v, date, dailyLog.getSettings().defaultDropThresholdL);
  ok(res, { manual: saved.inspection, vehicleMeta: saved.vehicleMeta, row });
});

router.get('/daily-log/report/:id/live', async (req, res) => {
  const run = { devIdno: await resolveDevIdno(req.params.id) };
  const date = (req.query.date || dailyLog.todayStr()).slice(0, 10);
  const vehicles = await cms.getVehicles().catch(() => []);
  const v = vehicles.find((x) => x.devIdno === run.devIdno) || { devIdno: run.devIdno };
  const row = await dailyLog.buildInspectionForVehicle(v, date, dailyLog.getSettings().defaultDropThresholdL);
  const statuses = await cms.getAllGPS();
  const truck = statuses.find((x) => String(x.devIdno || x.id) === String(run.devIdno));
  ok(res, { row, truck: truck || null });
});

module.exports = router;
