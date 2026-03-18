/**
 * routes-def.service.js
 * Named route definitions (from-location → to-location).
 * Persists to data/routes-def.json
 * Model: [{ id, name, fromId, toId, color, speedLimitKmh, createdAt }]
 */

const fs   = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../../../data/routes-def.json');
let store = { routes: [] };

function load() {
  try {
    if (fs.existsSync(FILE)) store = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    store.routes = store.routes || [];
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
  const r = require('crypto').randomBytes(6).toString('hex');
  return `rte_${Date.now().toString(36)}_${r}`;
}

function listRoutes() { return store.routes; }

function getRoute(id) { return store.routes.find(r => r.id === id) || null; }

function createRoute({ name, fromId, toId, color = '#39b8ff', speedLimitKmh = 80 }) {
  const route = { id: newId(), name, fromId, toId, color, speedLimitKmh: Number(speedLimitKmh), createdAt: new Date().toISOString() };
  store.routes.push(route);
  save();
  return route;
}

function updateRoute(id, data) {
  const i = store.routes.findIndex(r => r.id === id);
  if (i < 0) throw new Error('Route not found');
  store.routes[i] = { ...store.routes[i], ...data, id };
  save();
  return store.routes[i];
}

function deleteRoute(id) {
  store.routes = store.routes.filter(r => r.id !== id);
  save();
}

/** Find a route matching fromId→toId (bidirectional). Returns route + { reversed } or null. */
function findRoute(fromId, toId) {
  const fwd = store.routes.find(r => r.fromId === fromId && r.toId === toId);
  if (fwd) return { ...fwd, reversed: false };
  const rev = store.routes.find(r => r.fromId === toId   && r.toId === fromId);
  if (rev) return { ...rev, reversed: true };
  return null;
}

module.exports = { listRoutes, getRoute, createRoute, updateRoute, deleteRoute, findRoute };
