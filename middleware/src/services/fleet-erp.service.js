/**
 * fleet-erp.service.js
 *
 * Multi-company / category fleet organisation layer.
 * Persists to data/fleet-erp.json (same directory as monitor-state.json).
 *
 * Data model:
 *   companies  : [{ id, name, color, phone, createdAt }]
 *   categories : [{ id, name, color, createdAt }]          ← global, not per-company
 *   assignments: { devIdno: { companyId, categoryId, assignedAt } }
 */

const fs   = require('fs');
const path = require('path');

const ERP_FILE = path.join(__dirname, '../../../data/fleet-erp.json');

let store = { companies: [], categories: [], assignments: {} };

// ── Persistence ────────────────────────────────────────────────────────────────

function load() {
  try {
    if (fs.existsSync(ERP_FILE)) store = JSON.parse(fs.readFileSync(ERP_FILE, 'utf8'));
    store.companies  = store.companies  || [];
    store.categories = store.categories || [];
    store.assignments= store.assignments|| {};
  } catch (e) { /* start fresh */ }
}

function save() {
  try {
    const dir = path.dirname(ERP_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = ERP_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
    fs.renameSync(tmp, ERP_FILE);
  } catch (e) { /* non-fatal */ }
}

load();

// ── ID helper ─────────────────────────────────────────────────────────────────

function newId(prefix) {
  const r = require('crypto').randomBytes(6).toString('hex');
  return `${prefix}_${Date.now().toString(36)}_${r}`;
}

// ── Companies ─────────────────────────────────────────────────────────────────

function listCompanies() { return store.companies; }

function createCompany({ name, color = '#4318d1', phone = '' }) {
  const c = { id: newId('cmp'), name, color, phone, createdAt: new Date().toISOString() };
  store.companies.push(c);
  save();
  return c;
}

function updateCompany(id, data) {
  const i = store.companies.findIndex(c => c.id === id);
  if (i < 0) throw new Error('Company not found');
  store.companies[i] = { ...store.companies[i], ...data, id };
  save();
  return store.companies[i];
}

/**
 * Delete company. All vehicles assigned to it become unassigned.
 * Returns number of vehicles that were unassigned.
 */
function deleteCompany(id) {
  store.companies = store.companies.filter(c => c.id !== id);
  let unassigned = 0;
  for (const k of Object.keys(store.assignments)) {
    if (store.assignments[k].companyId === id) { delete store.assignments[k]; unassigned++; }
  }
  save();
  return unassigned;
}

// ── Categories ────────────────────────────────────────────────────────────────

function listCategories() { return store.categories; }

function createCategory({ name, color = '#05cd99' }) {
  const c = { id: newId('cat'), name, color, createdAt: new Date().toISOString() };
  store.categories.push(c);
  save();
  return c;
}

function updateCategory(id, data) {
  const i = store.categories.findIndex(c => c.id === id);
  if (i < 0) throw new Error('Category not found');
  store.categories[i] = { ...store.categories[i], ...data, id };
  save();
  return store.categories[i];
}

/**
 * Delete category. Affected assignments lose their categoryId (vehicle stays in company).
 */
function deleteCategory(id) {
  store.categories = store.categories.filter(c => c.id !== id);
  for (const k of Object.keys(store.assignments)) {
    if (store.assignments[k].categoryId === id) store.assignments[k].categoryId = null;
  }
  save();
}

// ── Assignments ───────────────────────────────────────────────────────────────

function listAssignments() { return store.assignments; }

function getAssignment(devIdno) { return store.assignments[devIdno] || null; }

function assign(devIdno, companyId, categoryId = null) {
  store.assignments[devIdno] = { companyId, categoryId: categoryId || null, assignedAt: new Date().toISOString() };
  save();
  return store.assignments[devIdno];
}

function bulkAssign(devIdnos, companyId, categoryId = null) {
  for (const d of devIdnos) assign(d, companyId, categoryId);
}

function unassign(devIdno) {
  delete store.assignments[devIdno];
  save();
}

function getUnassigned(allDevIdnos) {
  return allDevIdnos.filter(id => !store.assignments[id]);
}

/** Count assigned vehicles per company */
function vehicleCountByCompany() {
  const counts = {};
  for (const { companyId } of Object.values(store.assignments)) {
    if (companyId) counts[companyId] = (counts[companyId] || 0) + 1;
  }
  return counts;
}

/** Count assigned vehicles per category */
function vehicleCountByCategory() {
  const counts = {};
  for (const { categoryId } of Object.values(store.assignments)) {
    if (categoryId) counts[categoryId] = (counts[categoryId] || 0) + 1;
  }
  return counts;
}

module.exports = {
  listCompanies, createCompany, updateCompany, deleteCompany,
  listCategories, createCategory, updateCategory, deleteCategory,
  listAssignments, getAssignment, assign, bulkAssign, unassign,
  getUnassigned, vehicleCountByCompany, vehicleCountByCategory,
};
