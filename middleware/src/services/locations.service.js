/**
 * locations.service.js
 * Named waypoint locations for route tracking.
 * Supports both circle and polygon shapes.
 * Persists to data/locations.json
 *
 * Circle:  id, name, type, lat, lng, radius (m), color, iconKey, userName, phone,
 *          contactPerson, role, placeAddress, createdAt
 * Polygon: id, name, type, polygon, lat/lng centroid, color, iconKey, + optional meta
 */

const fs   = require('fs');
const path = require('path');
const presets = require('../config/location-presets');
const DEFAULT_MIN_RADIUS = presets.DEFAULT_MIN_RADIUS;

const FILE = path.join(__dirname, '../../../data/locations.json');
let store = { locations: [] };

function load() {
  try {
    if (fs.existsSync(FILE)) store = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    store.locations = store.locations || [];
    // Back-compat: old records without type field are circles
    for (const l of store.locations) {
      if (!l.type) l.type = 'circle';
      if (!l.iconKey) l.iconKey = 'pin';
      if (l.type === 'circle' && (l.radius == null || Number(l.radius) < DEFAULT_MIN_RADIUS)) {
        l.radius = Math.max(Number(l.radius) || 0, DEFAULT_MIN_RADIUS);
      }
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
  const r = require('crypto').randomBytes(6).toString('hex');
  return `loc_${Date.now().toString(36)}_${r}`;
}

// ── Geometry helpers ───────────────────────────────────────────────────────────

/** Haversine distance in metres between two lat/lng points */
function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Ray-casting point-in-polygon test.
 * polygon: [[lat, lng], [lat, lng], ...]
 * Returns true if (lat, lng) is inside the polygon.
 */
function pointInPolygon(lat, lng, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    const intersect = (xi > lng) !== (xj > lng) &&
      lat < ((yj - yi) * (lng - xi)) / (xj - xi) + yi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Approximate centroid of a polygon — used for display/ordering purposes */
function polygonCentroid(polygon) {
  const lat = polygon.reduce((s, p) => s + p[0], 0) / polygon.length;
  const lng = polygon.reduce((s, p) => s + p[1], 0) / polygon.length;
  return { lat, lng };
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

function trimStr(v) {
  if (v == null) return '';
  return String(v).trim();
}

function normalizeMeta(data = {}) {
  return {
    userName: trimStr(data.userName),
    phone: trimStr(data.phone),
    contactPerson: trimStr(data.contactPerson),
    role: trimStr(data.role),
    placeAddress: trimStr(data.placeAddress),
    iconKey: trimStr(data.iconKey) || 'pin',
  };
}

function clampRadius(r) {
  const n = Number(r);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MIN_RADIUS;
  return Math.max(n, DEFAULT_MIN_RADIUS);
}

function listLocations() {
  return store.locations;
}

function getLocation(id) { return store.locations.find(l => l.id === id) || null; }

/**
 * Create a location.
 * Circle:  { name, type:'circle',  lat, lng, radius, color }
 * Polygon: { name, type:'polygon', polygon:[[lat,lng],...], color }
 */
/**
 * @param {object} payload
 * @param {{ deferSave?: boolean }} [options] deferSave: true = push to store only (caller must save once)
 */
function createLocation(payload, options = {}) {
  const deferSave = Boolean(options.deferSave);
  const {
    name,
    type = 'circle',
    lat,
    lng,
    radius,
    polygon,
    color = '#4318d1',
  } = payload || {};
  const n = name != null ? String(name).trim() : '';
  if (!n) throw new Error('name is required');
  const meta = normalizeMeta(payload);
  let loc;
  if (type === 'polygon') {
    if (!Array.isArray(polygon) || polygon.length < 3) throw new Error('Polygon requires at least 3 vertices');
    const c = polygonCentroid(polygon);
    loc = {
      id: newId(),
      name: n,
      type: 'polygon',
      polygon,
      lat: c.lat,
      lng: c.lng,
      color,
      createdAt: new Date().toISOString(),
      ...meta,
    };
  } else {
    if (lat == null || lng == null) throw new Error('lat and lng are required for circle locations');
    loc = {
      id: newId(),
      name: n,
      type: 'circle',
      lat: Number(lat),
      lng: Number(lng),
      radius: clampRadius(radius != null ? radius : DEFAULT_MIN_RADIUS),
      color,
      createdAt: new Date().toISOString(),
      ...meta,
    };
  }
  store.locations.push(loc);
  if (!deferSave) save();
  return loc;
}

const PATCH_KEYS = new Set([
  'name', 'type', 'lat', 'lng', 'radius', 'polygon', 'color',
  'userName', 'phone', 'contactPerson', 'role', 'placeAddress', 'iconKey',
]);

function updateLocation(id, data) {
  const i = store.locations.findIndex((l) => l.id === id);
  if (i < 0) throw new Error('Location not found');
  const prev = store.locations[i];
  const patch = {};
  for (const k of Object.keys(data || {})) {
    if (PATCH_KEYS.has(k) && k !== 'type') patch[k] = data[k];
  }
  if (data.name != null) patch.name = String(data.name).trim();
  const metaIn = normalizeMeta({ ...prev, ...patch });
  let updated = { ...prev, ...patch, id, ...metaIn };
  if (updated.type === 'circle' && patch.radius != null) {
    updated.radius = clampRadius(patch.radius);
  }
  if (updated.type === 'polygon' && data.polygon) {
    const c = polygonCentroid(updated.polygon);
    updated.lat = c.lat;
    updated.lng = c.lng;
  }
  store.locations[i] = updated;
  save();
  return store.locations[i];
}

/** Apply icon, colour, and/or radius to many locations (radius only affects circles). */
function bulkPatchLocation(ids, { iconKey, radius, color } = {}) {
  const idSet = new Set((ids || []).map(String));
  if (idSet.size === 0) throw new Error('ids required');
  const touched = [];
  for (const loc of store.locations) {
    if (!idSet.has(loc.id)) continue;
    if (iconKey != null && String(iconKey).trim()) loc.iconKey = String(iconKey).trim();
    if (color != null && String(color).trim()) loc.color = String(color).trim();
    if (radius != null && loc.type === 'circle') loc.radius = clampRadius(radius);
    touched.push(loc.id);
  }
  save();
  return { updated: touched.length, ids: touched };
}

/**
 * Bulk create from validated client rows.
 * Each item: same shape as createLocation payload. Strips _csvRow before save.
 */
function importLocations(items) {
  const created = [];
  const errors = [];
  if (!Array.isArray(items)) throw new Error('items must be an array');
  items.forEach((row, idx) => {
    const csvRow = row._csvRow;
    const clean = { ...row };
    delete clean._csvRow;
    const label = csvRow != null ? `CSV row ${csvRow}` : `Item ${idx + 1}`;
    const nm = clean.name != null ? String(clean.name).trim() : '';
    try {
      const loc = createLocation(clean, { deferSave: true });
      created.push({ id: loc.id, name: loc.name, csvRow: csvRow ?? null });
    } catch (e) {
      const msg = e.message || String(e);
      errors.push({
        row: csvRow ?? idx + 1,
        message: `${label}${nm ? ` · "${nm}"` : ''}: ${msg}`,
      });
    }
  });
  if (created.length > 0) save();
  return { created, errors };
}

function deleteLocation(id) {
  store.locations = store.locations.filter(l => l.id !== id);
  save();
}

/**
 * Delete locations by role (case-insensitive exact match).
 * Useful for cleaning up bulk uploads (e.g., removing all "retailer" locations).
 */
function deleteLocationsByRole(role) {
  const target = String(role ?? '').trim().toLowerCase();
  if (!target) throw new Error('role is required');
  const before = store.locations.length;
  const removed = [];
  store.locations = store.locations.filter((l) => {
    const r = String(l?.role ?? '').trim().toLowerCase();
    if (r === target) {
      removed.push({ id: l.id, name: l.name, role: l.role });
      return false;
    }
    return true;
  });
  const deleted = before - store.locations.length;
  if (deleted > 0) save();
  return { deleted, removed };
}

// ── Proximity checks ───────────────────────────────────────────────────────────

/**
 * Check if a vehicle position is within a location.
 * Returns { near: bool, distanceM: number|null }
 */
function isNear(vLat, vLng, location) {
  if (location.type === 'polygon') {
    const near = pointInPolygon(vLat, vLng, location.polygon);
    // For polygons report distance to centroid (approximate)
    const distanceM = Math.round(haversineM(vLat, vLng, location.lat, location.lng));
    return { near, distanceM };
  }
  // Circle (default)
  const distanceM = Math.round(haversineM(vLat, vLng, location.lat, location.lng));
  return { near: distanceM <= location.radius, distanceM };
}

/** Find the location the vehicle is currently inside. Returns location or null. */
function findNearestLocation(vLat, vLng) {
  if (vLat == null || vLng == null) return null;
  // Prefer smallest area / closest centroid among matches
  let nearest = null;
  let nearestDist = Infinity;
  for (const loc of store.locations) {
    const { near, distanceM } = isNear(vLat, vLng, loc);
    if (near && distanceM < nearestDist) {
      nearest = loc;
      nearestDist = distanceM;
    }
  }
  return nearest;
}

module.exports = {
  listLocations,
  getLocation,
  createLocation,
  updateLocation,
  deleteLocation,
  bulkPatchLocation,
  importLocations,
  deleteLocationsByRole,
  isNear,
  findNearestLocation,
  haversineM,
  pointInPolygon,
  DEFAULT_MIN_RADIUS,
};
