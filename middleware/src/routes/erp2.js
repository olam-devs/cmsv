/**
 * routes/erp2.js — ERP v2 API (Cartrack-style)
 * Mounted at /api/erp2
 */

const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const erp2    = require('../services/erp2.service');
const logger  = require('../utils/logger');
const cms     = require('../services/cmsv6.service');
const requireUser = require('../utils/require-user');

const ok  = (res, data, meta = {}) => res.json({ success: true, ...meta, data });
const err = (res, msg, status = 400) => res.status(status).json({ success: false, message: msg });

// ERP2 is protected by user auth (JWT).
router.use(requireUser);

function isSuper(req) {
  return req.user?.role === 'superadmin';
}

function has(req, feature) {
  if (isSuper(req)) return true;
  if (typeof req.user?.hasFeature === 'function') return req.user.hasFeature(feature);
  const feats = req.user?.effectiveFeatures || [];
  return feats.includes('*') || feats.includes(feature);
}

function requireFeature(req, res, feature) {
  if (!has(req, feature)) {
    err(res, `Forbidden (missing feature: ${feature})`, 403);
    return false;
  }
  return true;
}

function scopeCompanyIds(req) {
  if (isSuper(req)) return null; // null means "all"
  return Array.isArray(req.user?.companyIds) ? req.user.companyIds : [];
}

function enforceCompanyScope(req, companyId) {
  if (isSuper(req)) return true;
  const allowed = scopeCompanyIds(req);
  return allowed.includes(companyId);
}

async function fetchMfgVehicles() {
  const base = (process.env.MFG_CMSV6_BASE_URL || '').replace(/\/+$/, '');
  const user = process.env.MFG_CMSV6_USERNAME;
  const pass = process.env.MFG_CMSV6_PASSWORD;

  if (!base || !user || !pass) {
    const e = new Error('Missing manufacturer CMS env vars. Set MFG_CMSV6_BASE_URL, MFG_CMSV6_USERNAME, MFG_CMSV6_PASSWORD');
    e.status = 500;
    throw e;
  }

  const login = await axios.get(`${base}/StandardApiAction_login.action`, {
    params: { account: user, password: pass },
    maxRedirects: 0,
    validateStatus: s => s < 400,
    timeout: 20000,
  });

  const loginData = login.data || {};
  if (loginData.result !== 0 || !loginData.jsession) {
    logger.warn('[MFG] Login failed: ' + JSON.stringify(loginData).slice(0, 250));
    const e = new Error(`Manufacturer login failed (result=${loginData.result ?? 'unknown'})`);
    e.status = 502;
    throw e;
  }

  const jsession = loginData.jsession;
  const vRes = await axios.get(`${base}/StandardApiAction_queryUserVehicle.action`, {
    params: { jsession },
    timeout: 20000,
  });

  const rawVehicles = vRes.data?.vehicles || [];
  const vehicles = rawVehicles.map(v => ({
    plate:   v.nm || v.plate || v.vid || '—',
    name:    v.nm || null,
    devIdno: v.dl?.[0]?.id || null,
    vehicleId: v.id ?? null,
  })).filter(v => v.devIdno);

  return { base, vehicles };
}

let mfgGpsCache = { at: 0, statuses: [], server: null };
const MFG_GPS_TTL_MS = 10_000;

async function fetchMfgAllGPS() {
  const now = Date.now();
  if (mfgGpsCache.statuses?.length && (now - mfgGpsCache.at) < MFG_GPS_TTL_MS) return mfgGpsCache;

  const base = (process.env.MFG_CMSV6_BASE_URL || '').replace(/\/+$/, '');
  const user = process.env.MFG_CMSV6_USERNAME;
  const pass = process.env.MFG_CMSV6_PASSWORD;

  if (!base || !user || !pass) {
    const e = new Error('Missing manufacturer CMS env vars. Set MFG_CMSV6_BASE_URL, MFG_CMSV6_USERNAME, MFG_CMSV6_PASSWORD');
    e.status = 500;
    throw e;
  }

  const login = await axios.get(`${base}/StandardApiAction_login.action`, {
    params: { account: user, password: pass },
    maxRedirects: 0,
    validateStatus: s => s < 400,
    timeout: 20000,
  });

  const loginData = login.data || {};
  if (loginData.result !== 0 || !loginData.jsession) {
    logger.warn('[MFG] Login failed (gps): ' + JSON.stringify(loginData).slice(0, 250));
    const e = new Error(`Manufacturer login failed (result=${loginData.result ?? 'unknown'})`);
    e.status = 502;
    throw e;
  }

  const jsession = loginData.jsession;
  const sRes = await axios.get(`${base}/StandardApiAction_getDeviceStatus.action`, {
    params: { jsession },
    timeout: 20000,
  });

  // Keep raw-ish format; we map fields we need below.
  const statuses = Array.isArray(sRes.data?.status) ? sRes.data.status : [];
  mfgGpsCache = { at: now, statuses, server: base };
  return mfgGpsCache;
}

// ── Org tree ───────────────────────────────────────────────────────────────

router.get('/org/tree', (req, res) => {
  if (!requireFeature(req, res, 'erp.read')) return;
  const allowed = scopeCompanyIds(req);
  const tree = erp2.getOrgTree();
  if (!allowed) return ok(res, tree);
  ok(res, tree.filter(c => allowed.includes(c.id)));
});

router.post('/org/companies', (req, res) => {
  if (!requireFeature(req, res, 'erp.org.write')) return;
  try { ok(res, erp2.createCompany(req.body)); }
  catch (e) { err(res, e.message); }
});

router.put('/org/companies/:id', (req, res) => {
  if (!requireFeature(req, res, 'erp.org.write')) return;
  try { ok(res, erp2.updateCompany(req.params.id, req.body)); }
  catch (e) { err(res, e.message, 404); }
});

router.delete('/org/companies/:id', (req, res) => {
  if (!requireFeature(req, res, 'erp.org.write')) return;
  try { ok(res, erp2.deleteCompany(req.params.id)); }
  catch (e) { err(res, e.message, 404); }
});

router.post('/org/branches', (req, res) => {
  if (!requireFeature(req, res, 'erp.org.write')) return;
  try {
    if (!enforceCompanyScope(req, req.body?.companyId)) return err(res, 'Forbidden (company scope)', 403);
    ok(res, erp2.createBranch(req.body));
  }
  catch (e) { err(res, e.message); }
});

router.put('/org/branches/:id', (req, res) => {
  if (!requireFeature(req, res, 'erp.org.write')) return;
  try { ok(res, erp2.updateBranch(req.params.id, req.body)); }
  catch (e) { err(res, e.message, 404); }
});

router.delete('/org/branches/:id', (req, res) => {
  if (!requireFeature(req, res, 'erp.org.write')) return;
  try { ok(res, erp2.deleteBranch(req.params.id)); }
  catch (e) { err(res, e.message, 404); }
});

router.post('/org/depots', (req, res) => {
  if (!requireFeature(req, res, 'erp.org.write')) return;
  try {
    const branch = erp2.getBranch(req.body?.branchId);
    if (!branch) return err(res, 'Branch not found', 404);
    if (!enforceCompanyScope(req, branch.companyId)) return err(res, 'Forbidden (company scope)', 403);
    ok(res, erp2.createDepot(req.body));
  }
  catch (e) { err(res, e.message); }
});

router.put('/org/depots/:id', (req, res) => {
  if (!requireFeature(req, res, 'erp.org.write')) return;
  try { ok(res, erp2.updateDepot(req.params.id, req.body)); }
  catch (e) { err(res, e.message, 404); }
});

router.delete('/org/depots/:id', (req, res) => {
  if (!requireFeature(req, res, 'erp.org.write')) return;
  try { ok(res, erp2.deleteDepot(req.params.id)); }
  catch (e) { err(res, e.message, 404); }
});

// ── Categories ─────────────────────────────────────────────────────────────

router.get('/categories', (req, res) => {
  if (!requireFeature(req, res, 'erp.read')) return;
  ok(res, erp2.listCategories());
});
router.post('/categories', (req, res) => {
  if (!requireFeature(req, res, 'erp.org.write')) return;
  try { ok(res, erp2.createCategory(req.body)); }
  catch (e) { err(res, e.message); }
});

// ── Drivers (cards) + vehicle assignment ────────────────────────────────────

router.get('/drivers', (req, res) => {
  if (!requireFeature(req, res, 'erp.read')) return;
  let list = erp2.listDrivers();
  const allowed = scopeCompanyIds(req);
  if (allowed) list = list.filter(d => !d.companyId || allowed.includes(d.companyId));
  ok(res, list);
});

router.post('/drivers', (req, res) => {
  if (!requireFeature(req, res, 'erp.assign.write')) return;
  try {
    const cid = req.body?.companyId;
    if (cid && !enforceCompanyScope(req, cid)) return err(res, 'Forbidden (company scope)', 403);
    ok(res, erp2.createDriver(req.body));
  } catch (e) { err(res, e.message); }
});

router.put('/drivers/:id', (req, res) => {
  if (!requireFeature(req, res, 'erp.assign.write')) return;
  try {
    const cur = erp2.getDriver(req.params.id);
    if (cur?.companyId && !enforceCompanyScope(req, cur.companyId)) return err(res, 'Forbidden (company scope)', 403);
    if (req.body?.companyId && !enforceCompanyScope(req, req.body.companyId)) return err(res, 'Forbidden (company scope)', 403);
    ok(res, erp2.updateDriver(req.params.id, req.body));
  } catch (e) { err(res, e.message, 404); }
});

router.delete('/drivers/:id', (req, res) => {
  if (!requireFeature(req, res, 'erp.assign.write')) return;
  try {
    const cur = erp2.getDriver(req.params.id);
    if (cur?.companyId && !enforceCompanyScope(req, cur.companyId)) return err(res, 'Forbidden (company scope)', 403);
    ok(res, erp2.deleteDriver(req.params.id));
  } catch (e) { err(res, e.message, 404); }
});

router.post('/vehicles/:vehicleId/driver', (req, res) => {
  if (!requireFeature(req, res, 'erp.assign.write')) return;
  try {
    const v = erp2.getVehicleById(req.params.vehicleId);
    if (!v) return err(res, 'Vehicle not found', 404);
    const asg = erp2.listAssignments()[v.id];
    if (asg?.companyId && !enforceCompanyScope(req, asg.companyId)) return err(res, 'Forbidden (company scope)', 403);
    const { driverId } = req.body || {};
    if (!driverId) return err(res, 'driverId is required');
    ok(res, erp2.assignDriverToVehicle(req.params.vehicleId, driverId));
  } catch (e) { err(res, e.message); }
});

router.delete('/vehicles/:vehicleId/driver', (req, res) => {
  if (!requireFeature(req, res, 'erp.assign.write')) return;
  try {
    const v = erp2.getVehicleById(req.params.vehicleId);
    if (!v) return err(res, 'Vehicle not found', 404);
    const asg = erp2.listAssignments()[v.id];
    if (asg?.companyId && !enforceCompanyScope(req, asg.companyId)) return err(res, 'Forbidden (company scope)', 403);
    ok(res, erp2.unassignDriverFromVehicle(req.params.vehicleId));
  } catch (e) { err(res, e.message); }
});

router.post('/vehicles/:vehicleId/meta', (req, res) => {
  if (!requireFeature(req, res, 'erp.assign.write')) return;
  try {
    const v = erp2.getVehicleById(req.params.vehicleId);
    if (!v) return err(res, 'Vehicle not found', 404);
    const asg = erp2.listAssignments()[v.id];
    if (asg?.companyId && !enforceCompanyScope(req, asg.companyId)) return err(res, 'Forbidden (company scope)', 403);
    ok(res, erp2.updateVehicleMeta(req.params.vehicleId, req.body || {}));
  } catch (e) { err(res, e.message); }
});

router.post('/vehicles/bulk-icons', (req, res) => {
  if (!requireFeature(req, res, 'erp.assign.write')) return;
  try {
    const { vehicleIds = [], devIdnos = [], iconKey = null } = req.body || {};
    ok(res, erp2.bulkSetVehicleIcons({ vehicleIds, devIdnos, iconKey }));
  } catch (e) { err(res, e.message); }
});

// ── Vehicles registry ──────────────────────────────────────────────────────

router.get('/vehicles', (req, res) => {
  if (!requireFeature(req, res, 'erp.read')) return;
  const { companyId, branchId, depotId } = req.query;
  if (companyId && !enforceCompanyScope(req, companyId)) return err(res, 'Forbidden (company scope)', 403);
  const allowed = scopeCompanyIds(req);
  const list = erp2.getEnrichedVehicles({ companyId, branchId, depotId });
  if (!allowed) return ok(res, list, {});
  ok(res, list.filter(v => (v.assignment?.companyId ? allowed.includes(v.assignment.companyId) : false)), {});
});

/**
 * GET /api/erp2/vehicles/live
 * Returns ERP2 vehicles enriched with live status from CMSV6 (AWS).
 * Note: currently supports provider=cmsv6 only.
 */
router.get('/vehicles/live', async (req, res) => {
  if (!requireFeature(req, res, 'erp.read')) return;
  const { companyId, branchId, depotId } = req.query;
  if (companyId && !enforceCompanyScope(req, companyId)) return err(res, 'Forbidden (company scope)', 403);
  const allowed = scopeCompanyIds(req);
  let list = erp2.getEnrichedVehicles({ companyId, branchId, depotId });
  if (allowed) list = list.filter(v => (v.assignment?.companyId ? allowed.includes(v.assignment.companyId) : false));

  const needsMfg = list.some(v => String(v.providerKey || '').startsWith('mfg:'));

  // Pull AWS CMSV6 status once and index by devIdno
  const awsStatuses = await cms.getAllGPS().catch(() => []);
  const awsMap = {};
  for (const s of awsStatuses) {
    const id = s.devIdno || s.id;
    if (id) awsMap[id] = s;
  }

  // Pull MFG CMSV6 status (raw) and index by devIdno
  let mfgMap = null;
  if (needsMfg) {
    const mfg = await fetchMfgAllGPS().catch(() => ({ statuses: [] }));
    mfgMap = {};
    for (const s of (mfg.statuses || [])) {
      const id = s.devIdno || s.id || s.DevIDNO;
      if (id) mfgMap[id] = s;
    }
  }

  const enriched = list.map(v => {
    if (v.provider !== 'cmsv6' || !v.devIdno) return { ...v, live: null };
    const isMfg = String(v.providerKey || '').startsWith('mfg:');
    const s = (isMfg ? (mfgMap?.[v.devIdno] || null) : (awsMap[v.devIdno] || null));
    if (!s) return { ...v, live: null };

    // AWS statuses are already scaled in cmsv6.service.js; MFG statuses are raw.
    const isAwsScaled = !isMfg;
    const online = s.ol ?? s.online ?? s.isOnline ?? 0;
    const speed = isAwsScaled ? (s.speed ?? null) : (s.sp != null ? s.sp / 10 : (s.speed ?? null));
    const fuel  = isAwsScaled ? (s.fuel ?? null)  : (s.yl != null ? s.yl / 100 : (s.fuel ?? null));
    const lat   = isAwsScaled ? (s.lat ?? null)   : (s.lat != null ? s.lat / 1_000_000 : null);
    const lng   = isAwsScaled ? (s.lng ?? null)   : (s.lng != null ? s.lng / 1_000_000 : null);
    const gpsTime = s.gpsTime ?? s.gpstm ?? s.gps ?? null;
    const todayKm = isAwsScaled ? (s.todayKm ?? null) : (s.lt != null ? s.lt / 1000 : null);
    const accOn = isAwsScaled ? (s.accOn ?? null) : (s.s1 != null ? ((s.s1 & 2) === 2) : null);

    return {
      ...v,
      live: {
        online,
        accOn,
        speed,
        fuel,
        lat,
        lng,
        gpsTime,
        todayKm,
      },
    };
  });

  ok(res, enriched, { count: enriched.length });
});

// ── External provider discovery / import (Manufacturer CMSV6) ───────────────

router.get('/providers/mfg/vehicles', async (req, res) => {
  if (!requireFeature(req, res, 'erp.read')) return;
  try {
    const { base, vehicles } = await fetchMfgVehicles();
    ok(res, vehicles, { count: vehicles.length, server: base });
  } catch (e) {
    err(res, e.message, e.status || 400);
  }
});

router.post('/bootstrap/mfg', async (req, res) => {
  if (!requireFeature(req, res, 'erp.assign.write')) return;
  try {
    const { base, vehicles } = await fetchMfgVehicles();
    const out = [];
    for (const v of vehicles) {
      const devIdno = v.devIdno;
      const plate = v.plate || v.name || devIdno;
      out.push(erp2.upsertVehicle({
        provider: 'cmsv6',
        providerKey: `mfg:${devIdno}`,
        devIdno,
        plate,
        meta: { source: 'mfg', server: base, mfgVehicleId: v.vehicleId ?? null },
      }));
    }
    ok(res, out, { count: out.length, server: base });
  } catch (e) {
    err(res, e.message, e.status || 400);
  }
});

router.post('/vehicles/upsert', (req, res) => {
  if (!requireFeature(req, res, 'erp.assign.write')) return;
  try { ok(res, erp2.upsertVehicle(req.body)); }
  catch (e) { err(res, e.message); }
});

router.post('/vehicles/:vehicleId/assign', (req, res) => {
  if (!requireFeature(req, res, 'erp.assign.write')) return;
  try {
    if (!enforceCompanyScope(req, req.body?.companyId)) return err(res, 'Forbidden (company scope)', 403);
    ok(res, erp2.assignVehicle(req.params.vehicleId, req.body));
  }
  catch (e) { err(res, e.message); }
});

router.delete('/vehicles/:vehicleId/assign', (req, res) => {
  if (!requireFeature(req, res, 'erp.assign.write')) return;
  try { ok(res, erp2.unassignVehicle(req.params.vehicleId)); }
  catch (e) { err(res, e.message); }
});

// ── Bootstrap helpers (for migration from CMSV6 list) ──────────────────────
// This is intentionally simple: client sends { devIdno, plate, providerKey }.
router.post('/bootstrap/cmsv6', (req, res) => {
  if (!requireFeature(req, res, 'erp.assign.write')) return;
  try {
    const { vehicles = [] } = req.body;
    if (!Array.isArray(vehicles)) return err(res, 'vehicles[] is required');
    const out = [];
    for (const v of vehicles) {
      if (!v?.providerKey || !v?.plate) continue;
      out.push(erp2.upsertVehicle({
        provider: 'cmsv6',
        providerKey: v.providerKey,
        devIdno: v.devIdno || null,
        plate: v.plate,
        meta: v.meta || {},
      }));
    }
    ok(res, out, { count: out.length });
  } catch (e) {
    logger.warn('[ERP2] bootstrap failed: ' + e.message);
    err(res, e.message);
  }
});

module.exports = router;

