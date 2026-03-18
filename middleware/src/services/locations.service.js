/**
 * locations.service.js
 * Named waypoint locations for route tracking.
 * Supports both circle and polygon shapes.
 * Persists to data/locations.json
 *
 * Circle model : { id, name, type:'circle',  lat, lng, radius (m), color, createdAt }
 * Polygon model: { id, name, type:'polygon', polygon:[[lat,lng],...], color, createdAt }
 */

const fs   = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../../../data/locations.json');
let store = { locations: [] };

function load() {
  try {
    if (fs.existsSync(FILE)) store = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    store.locations = store.locations || [];
    // Back-compat: old records without type field are circles
    for (const l of store.locations) if (!l.type) l.type = 'circle';
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

function listLocations() { return store.locations; }

function getLocation(id) { return store.locations.find(l => l.id === id) || null; }

/**
 * Create a location.
 * Circle:  { name, type:'circle',  lat, lng, radius, color }
 * Polygon: { name, type:'polygon', polygon:[[lat,lng],...], color }
 */
function createLocation({ name, type = 'circle', lat, lng, radius = 200, polygon, color = '#4318d1' }) {
  let loc;
  if (type === 'polygon') {
    if (!Array.isArray(polygon) || polygon.length < 3) throw new Error('Polygon requires at least 3 vertices');
    const c = polygonCentroid(polygon);
    loc = { id: newId(), name, type: 'polygon', polygon, lat: c.lat, lng: c.lng, color, createdAt: new Date().toISOString() };
  } else {
    if (lat == null || lng == null) throw new Error('lat and lng are required for circle locations');
    loc = { id: newId(), name, type: 'circle', lat: Number(lat), lng: Number(lng), radius: Number(radius), color, createdAt: new Date().toISOString() };
  }
  store.locations.push(loc);
  save();
  return loc;
}

function updateLocation(id, data) {
  const i = store.locations.findIndex(l => l.id === id);
  if (i < 0) throw new Error('Location not found');
  const updated = { ...store.locations[i], ...data, id };
  // Re-compute centroid if polygon vertices changed
  if (updated.type === 'polygon' && data.polygon) {
    const c = polygonCentroid(updated.polygon);
    updated.lat = c.lat;
    updated.lng = c.lng;
  }
  store.locations[i] = updated;
  save();
  return store.locations[i];
}

function deleteLocation(id) {
  store.locations = store.locations.filter(l => l.id !== id);
  save();
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
  listLocations, getLocation, createLocation, updateLocation, deleteLocation,
  isNear, findNearestLocation, haversineM, pointInPolygon,
};
