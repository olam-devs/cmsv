/**
 * erp2.service.js — ERP v2 (Cartrack-style org + fleet registry)
 *
 * Goals:
 * - Keep existing /api/erp/* working (fleet-erp.service.js)
 * - Provide a richer, cleaner data model for UI + future auth scoping (step 3)
 *
 * Persistence: data/erp-v2.json
 *
 * Model (minimal but extensible):
 *   org: {
 *     companies: [{ id, name, color, phone, createdAt }],
 *     branches:  [{ id, companyId, name, createdAt }],
 *     depots:    [{ id, branchId,  name, lat?, lng?, radiusM?, createdAt }],
 *   }
 *
 *   vehicles: [{
 *     id,                     // stable ERP vehicle id (veh_*)
 *     provider: 'cmsv6',       // for now; later could add more providers
 *     providerKey,            // e.g. "aws:1468..." or "mfg:445250..."
 *     devIdno,                // CMSV6 device id (when provider=cmsv6)
 *     plate,                  // display name / plate
 *     meta: { ... },          // optional extra fields
 *     createdAt
 *   }]
 *
 *   assignments: {
 *     [vehicleId]: { companyId, branchId?, depotId?, categoryId?, assignedAt }
 *   }
 *
 *   categories: [{ id, name, color, createdAt }]
 *   drivers:    [{ id, name, phone?, companyId?, createdAt }]
 *   driverAssignments: { [vehicleId]: { driverId, assignedAt } }
 */

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '../../../data/erp-v2.json');

let store = {
  org: { companies: [], branches: [], depots: [] },
  vehicles: [],
  assignments: {},
  categories: [],
  drivers: [],
  driverAssignments: {},
};

function nowIso() { return new Date().toISOString(); }

function newId(prefix) {
  const r = crypto.randomBytes(6).toString('hex');
  return `${prefix}_${Date.now().toString(36)}_${r}`;
}

function load() {
  try {
    if (fs.existsSync(FILE)) store = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (_) {}
  store.org = store.org || { companies: [], branches: [], depots: [] };
  store.org.companies = store.org.companies || [];
  store.org.branches  = store.org.branches  || [];
  store.org.depots    = store.org.depots    || [];
  store.vehicles = store.vehicles || [];
  store.assignments = store.assignments || {};
  store.categories = store.categories || [];
  store.drivers = store.drivers || [];
  store.driverAssignments = store.driverAssignments || {};
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

// ── Org CRUD ───────────────────────────────────────────────────────────────

function listCompanies() { return store.org.companies; }

function createCompany({ name, color = '#4318d1', phone = '' }) {
  if (!name) throw new Error('name is required');
  const c = { id: newId('cmp'), name, color, phone, createdAt: nowIso() };
  store.org.companies.push(c);
  save();
  return c;
}

function updateCompany(id, data) {
  const i = store.org.companies.findIndex(c => c.id === id);
  if (i < 0) throw new Error('Company not found');
  store.org.companies[i] = { ...store.org.companies[i], ...data, id };
  save();
  return store.org.companies[i];
}

function deleteCompany(id) {
  store.org.companies = store.org.companies.filter(c => c.id !== id);
  const branchesToRemove = store.org.branches.filter(b => b.companyId === id).map(b => b.id);
  const depotsToRemove   = store.org.depots.filter(d => branchesToRemove.includes(d.branchId)).map(d => d.id);
  store.org.branches = store.org.branches.filter(b => b.companyId !== id);
  store.org.depots   = store.org.depots.filter(d => !branchesToRemove.includes(d.branchId));

  // Remove assignments under this company
  for (const [vehId, a] of Object.entries(store.assignments)) {
    if (a.companyId === id || branchesToRemove.includes(a.branchId) || depotsToRemove.includes(a.depotId)) {
      delete store.assignments[vehId];
    }
  }
  save();
  return { deleted: true };
}

function listBranches(companyId) {
  return companyId ? store.org.branches.filter(b => b.companyId === companyId) : store.org.branches;
}

function getBranch(id) {
  return store.org.branches.find(b => b.id === id) || null;
}

function createBranch({ companyId, name }) {
  if (!companyId) throw new Error('companyId is required');
  if (!store.org.companies.find(c => c.id === companyId)) throw new Error('Company not found');
  if (!name) throw new Error('name is required');
  const b = { id: newId('br'), companyId, name, createdAt: nowIso() };
  store.org.branches.push(b);
  save();
  return b;
}

function updateBranch(id, data) {
  const i = store.org.branches.findIndex(b => b.id === id);
  if (i < 0) throw new Error('Branch not found');
  store.org.branches[i] = { ...store.org.branches[i], ...data, id };
  save();
  return store.org.branches[i];
}

function deleteBranch(id) {
  store.org.branches = store.org.branches.filter(b => b.id !== id);
  store.org.depots   = store.org.depots.filter(d => d.branchId !== id);
  for (const [vehId, a] of Object.entries(store.assignments)) {
    if (a.branchId === id) {
      store.assignments[vehId] = { ...a, branchId: null, depotId: null };
    }
  }
  save();
  return { deleted: true };
}

function listDepots(branchId) {
  return branchId ? store.org.depots.filter(d => d.branchId === branchId) : store.org.depots;
}

function getDepot(id) {
  return store.org.depots.find(d => d.id === id) || null;
}

function createDepot({ branchId, name, lat = null, lng = null, radiusM = 200 }) {
  if (!branchId) throw new Error('branchId is required');
  if (!store.org.branches.find(b => b.id === branchId)) throw new Error('Branch not found');
  if (!name) throw new Error('name is required');
  const d = { id: newId('dep'), branchId, name, lat, lng, radiusM, createdAt: nowIso() };
  store.org.depots.push(d);
  save();
  return d;
}

function updateDepot(id, data) {
  const i = store.org.depots.findIndex(d => d.id === id);
  if (i < 0) throw new Error('Depot not found');
  store.org.depots[i] = { ...store.org.depots[i], ...data, id };
  save();
  return store.org.depots[i];
}

function deleteDepot(id) {
  store.org.depots = store.org.depots.filter(d => d.id !== id);
  for (const [vehId, a] of Object.entries(store.assignments)) {
    if (a.depotId === id) store.assignments[vehId] = { ...a, depotId: null };
  }
  save();
  return { deleted: true };
}

function getOrgTree() {
  const companies = listCompanies();
  const branches  = listBranches();
  const depots    = listDepots();
  const byCompany = Object.fromEntries(companies.map(c => [c.id, { ...c, branches: [] }]));
  const byBranch  = {};
  for (const b of branches) {
    byBranch[b.id] = { ...b, depots: [] };
    if (byCompany[b.companyId]) byCompany[b.companyId].branches.push(byBranch[b.id]);
  }
  for (const d of depots) {
    if (byBranch[d.branchId]) byBranch[d.branchId].depots.push(d);
  }
  return Object.values(byCompany);
}

// ── Categories (kept global) ───────────────────────────────────────────────

function listCategories() { return store.categories; }
function createCategory({ name, color = '#05cd99' }) {
  if (!name) throw new Error('name is required');
  const c = { id: newId('cat'), name, color, createdAt: nowIso() };
  store.categories.push(c);
  save();
  return c;
}

// ── Vehicle registry + assignment ──────────────────────────────────────────

function listVehicles() { return store.vehicles; }

function upsertVehicle({ provider = 'cmsv6', providerKey, devIdno = null, plate, meta = {} }) {
  if (!providerKey) throw new Error('providerKey is required');
  if (!plate) throw new Error('plate is required');
  const existing = store.vehicles.find(v => v.provider === provider && v.providerKey === providerKey);
  if (existing) {
    Object.assign(existing, { devIdno: devIdno ?? existing.devIdno, plate, meta: { ...existing.meta, ...meta } });
    save();
    return existing;
  }
  const v = { id: newId('veh'), provider, providerKey, devIdno, plate, meta, createdAt: nowIso() };
  store.vehicles.push(v);
  save();
  return v;
}

function getVehicleById(id) { return store.vehicles.find(v => v.id === id) || null; }

function assignVehicle(vehicleId, { companyId, branchId = null, depotId = null, categoryId = null }) {
  if (!getVehicleById(vehicleId)) throw new Error('Vehicle not found');
  if (!companyId) throw new Error('companyId is required');
  if (!store.org.companies.find(c => c.id === companyId)) throw new Error('Company not found');
  if (branchId && !store.org.branches.find(b => b.id === branchId)) throw new Error('Branch not found');
  if (depotId && !store.org.depots.find(d => d.id === depotId)) throw new Error('Depot not found');
  if (categoryId && !store.categories.find(c => c.id === categoryId)) throw new Error('Category not found');
  store.assignments[vehicleId] = { companyId, branchId, depotId, categoryId, assignedAt: nowIso() };
  save();
  return store.assignments[vehicleId];
}

function unassignVehicle(vehicleId) {
  delete store.assignments[vehicleId];
  save();
  return { unassigned: true };
}

function listAssignments() { return store.assignments; }

function getEnrichedVehicles({ companyId = null, branchId = null, depotId = null } = {}) {
  const a = store.assignments;
  const res = store.vehicles.map(v => {
    const asg = a[v.id] || null;
    const drv = store.driverAssignments[v.id] || null;
    const driver = drv ? (store.drivers.find(d => d.id === drv.driverId) || null) : null;
    return { ...v, assignment: asg, driver, driverAssignedAt: drv?.assignedAt || null };
  });
  return res.filter(v => {
    if (!companyId && !branchId && !depotId) return true;
    const asg = v.assignment;
    if (!asg) return false;
    if (companyId && asg.companyId !== companyId) return false;
    if (branchId  && asg.branchId  !== branchId)  return false;
    if (depotId   && asg.depotId   !== depotId)   return false;
    return true;
  });
}

// ── Drivers ────────────────────────────────────────────────────────────────

function listDrivers() { return store.drivers; }

function getDriver(id) { return store.drivers.find(d => d.id === id) || null; }

function createDriver({ name, phone = '', companyId = null }) {
  if (!name || !String(name).trim()) throw new Error('name is required');
  if (companyId && !store.org.companies.find(c => c.id === companyId)) throw new Error('Company not found');
  const d = { id: newId('drv'), name: String(name).trim(), phone: phone || '', companyId, createdAt: nowIso() };
  store.drivers.push(d);
  save();
  return d;
}

function updateDriver(id, data) {
  const i = store.drivers.findIndex(d => d.id === id);
  if (i < 0) throw new Error('Driver not found');
  const cur = store.drivers[i];
  if (data.companyId && !store.org.companies.find(c => c.id === data.companyId)) throw new Error('Company not found');
  store.drivers[i] = {
    ...cur,
    ...data,
    id,
    name: data.name != null ? String(data.name).trim() : cur.name,
  };
  save();
  return store.drivers[i];
}

function deleteDriver(id) {
  const i = store.drivers.findIndex(d => d.id === id);
  if (i < 0) throw new Error('Driver not found');
  store.drivers.splice(i, 1);
  for (const [vehId, a] of Object.entries(store.driverAssignments)) {
    if (a.driverId === id) delete store.driverAssignments[vehId];
  }
  save();
  return { deleted: true };
}

function assignDriverToVehicle(vehicleId, driverId) {
  if (!getVehicleById(vehicleId)) throw new Error('Vehicle not found');
  if (!getDriver(driverId)) throw new Error('Driver not found');
  store.driverAssignments[vehicleId] = { driverId, assignedAt: nowIso() };
  save();
  return store.driverAssignments[vehicleId];
}

function unassignDriverFromVehicle(vehicleId) {
  if (!getVehicleById(vehicleId)) throw new Error('Vehicle not found');
  delete store.driverAssignments[vehicleId];
  save();
  return { unassigned: true };
}

function getVehicleByDevIdno(devIdno) {
  if (devIdno == null) return null;
  const s = String(devIdno);
  return store.vehicles.find(v => v.devIdno != null && String(v.devIdno) === s) || null;
}

function updateVehicleMeta(vehicleId, patch) {
  const v = getVehicleById(vehicleId);
  if (!v) throw new Error('Vehicle not found');
  const { meta, iconKey } = patch || {};
  if (meta && typeof meta === 'object') v.meta = { ...v.meta, ...meta };
  if (iconKey !== undefined) v.meta = { ...v.meta, iconKey: iconKey || null };
  save();
  return v;
}

function bulkSetVehicleIcons({ vehicleIds = [], devIdnos = [], iconKey = null }) {
  const targets = new Set();
  for (const id of vehicleIds) {
    if (getVehicleById(id)) targets.add(id);
  }
  for (const d of devIdnos) {
    const v = getVehicleByDevIdno(d);
    if (v) targets.add(v.id);
  }
  for (const id of targets) {
    const v = getVehicleById(id);
    v.meta = { ...v.meta, iconKey: iconKey || null };
  }
  save();
  return { updated: targets.size };
}

/** For fleet map: devIdno -> { iconKey, driver } */
function getFleetExtrasByDevIdno() {
  const out = {};
  for (const v of store.vehicles) {
    if (!v.devIdno) continue;
    const key = String(v.devIdno);
    const iconKey = v.meta?.iconKey || null;
    const da = store.driverAssignments[v.id];
    let driver = null;
    if (da) {
      const d = store.drivers.find(x => x.id === da.driverId);
      if (d) driver = { id: d.id, name: d.name, phone: d.phone || '' };
    }
    out[key] = { iconKey, driver };
  }
  return out;
}

module.exports = {
  // org
  listCompanies, createCompany, updateCompany, deleteCompany,
  listBranches, getBranch, createBranch, updateBranch, deleteBranch,
  listDepots, getDepot, createDepot, updateDepot, deleteDepot,
  getOrgTree,
  // categories
  listCategories, createCategory,
  // vehicles
  listVehicles, upsertVehicle, getVehicleById,
  // assignments
  assignVehicle, unassignVehicle, listAssignments,
  // list views
  getEnrichedVehicles,
  // drivers
  listDrivers, getDriver, createDriver, updateDriver, deleteDriver,
  assignDriverToVehicle, unassignDriverFromVehicle,
  updateVehicleMeta, bulkSetVehicleIcons, getFleetExtrasByDevIdno, getVehicleByDevIdno,
};

