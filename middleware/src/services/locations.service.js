/**
 * locations.service.js
 * Named waypoint locations for route tracking.
 * Persists to data/locations.json
 * Model: [{ id, name, lat, lng, radius (metres), color, createdAt }]
 */

const fs   = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../../../data/locations.json');
let store = { locations: [] };

function load() {
  try {
    if (fs.existsSync(FILE)) store = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    store.locations = store.locations || [];
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

// Haversine distance in metres
function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function listLocations() { return store.locations; }

function getLocation(id) { return store.locations.find(l => l.id === id) || null; }

function createLocation({ name, lat, lng, radius = 200, color = '#4318d1' }) {
  const loc = { id: newId(), name, lat: Number(lat), lng: Number(lng), radius: Number(radius), color, createdAt: new Date().toISOString() };
  store.locations.push(loc);
  save();
  return loc;
}

function updateLocation(id, data) {
  const i = store.locations.findIndex(l => l.id === id);
  if (i < 0) throw new Error('Location not found');
  store.locations[i] = { ...store.locations[i], ...data, id };
  save();
  return store.locations[i];
}

function deleteLocation(id) {
  store.locations = store.locations.filter(l => l.id !== id);
  save();
}

/** Check if vehicle position is within a location's radius. Returns { near, distanceM } */
function isNear(vLat, vLng, location) {
  const distanceM = haversineM(vLat, vLng, location.lat, location.lng);
  return { near: distanceM <= location.radius, distanceM: Math.round(distanceM) };
}

/** Find the nearest location that is within its own radius. Returns location or null. */
function findNearestLocation(vLat, vLng) {
  if (vLat == null || vLng == null) return null;
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

module.exports = { listLocations, getLocation, createLocation, updateLocation, deleteLocation, isNear, findNearestLocation, haversineM };
