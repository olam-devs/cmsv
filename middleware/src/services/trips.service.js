/**
 * trips.service.js
 * Detects route completions, records trip metrics, computes scores and rankings.
 * Called by monitor.service.js on every GPS poll.
 *
 * Trip record shape:
 *   { id, routeId, routeName, devIdno, plate,
 *     startTime, endTime, durationMin,
 *     distanceKm, fuelStart, fuelEnd, fuelUsed, fuelPer100km,
 *     avgSpeedKmh, maxSpeedKmh, accOnTimeMin,
 *     actualFromId, actualToId,
 *     score, scoreFuel, scoreTime, scoreSpeed, scoreSafety,
 *     createdAt }
 */

const fs   = require('fs');
const path = require('path');

const FILE     = path.join(__dirname, '../../../data/trips.json');
const MAX_TRIPS = 2000;

let store = { trips: [] };

function load() {
  try {
    if (fs.existsSync(FILE)) store = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    store.trips = store.trips || [];
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
  return `trp_${Date.now().toString(36)}_${r}`;
}

// ── In-memory vehicle location state ──────────────────────────────────────────
// vehicleState[devIdno] = { locationId, arrivedAt (ms), fuelAtArrival, mileageAtArrivalM, lat, lng }
const vehicleState = {};

// ── Score computation ──────────────────────────────────────────────────────────

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2;
}

function computeScore(metrics, routeId, speedLimitKmh = 80) {
  // ── Fuel efficiency (40 pts) ──
  const FUEL_BASELINE = 30; // units per 100 km — adjust per fleet
  let scoreFuel = 50;
  if (metrics.fuelPer100km != null && metrics.fuelPer100km > 0) {
    scoreFuel = clamp(100 - ((metrics.fuelPer100km - FUEL_BASELINE) / FUEL_BASELINE) * 100, 0, 100);
  }

  // ── Time efficiency (30 pts) — based on historical median ──
  let scoreTime = 50;
  const historicalDurations = store.trips
    .filter(t => t.routeId === routeId && t.durationMin > 0)
    .map(t => t.durationMin);
  if (historicalDurations.length >= 3) {
    const med = median(historicalDurations);
    if (med > 0) {
      scoreTime = clamp(100 - ((metrics.durationMin - med) / med) * 50, 0, 100);
    }
  }

  // ── Speed compliance (20 pts) ──
  let scoreSpeed = 100;
  if (metrics.maxSpeedKmh != null && metrics.maxSpeedKmh > speedLimitKmh) {
    const over = metrics.maxSpeedKmh - speedLimitKmh;
    scoreSpeed = clamp(100 - over * 2, 0, 100);
  }

  // ── Safety / no theft (10 pts) ──
  let scoreSafety = 10;
  if (metrics.fuelUsed < 0) scoreSafety = 0; // fuel increased (sensor anomaly/theft)
  if (metrics.fuelPer100km != null && metrics.fuelPer100km > 80) scoreSafety = 0; // extreme consumption

  const score = Math.round(scoreFuel * 0.40 + scoreTime * 0.30 + scoreSpeed * 0.20 + scoreSafety);
  return { score: clamp(score, 0, 100), scoreFuel: Math.round(scoreFuel), scoreTime: Math.round(scoreTime), scoreSpeed: Math.round(scoreSpeed), scoreSafety };
}

// ── Metric computation from GPS track points ───────────────────────────────────

function computeMetrics(tracks, prevState, arrival) {
  const startTime = new Date(prevState.arrivedAt).toISOString();
  const endTime   = new Date(arrival.arrivedAt).toISOString();
  const durationMin = Math.round((arrival.arrivedAt - prevState.arrivedAt) / 60000 * 10) / 10;

  // Distance: odometer delta (most reliable)
  let distanceKm = 0;
  if (arrival.mileageAtArrivalM > 0 && prevState.mileageAtArrivalM > 0 &&
      arrival.mileageAtArrivalM > prevState.mileageAtArrivalM) {
    distanceKm = Math.round((arrival.mileageAtArrivalM - prevState.mileageAtArrivalM) / 1000 * 100) / 100;
  } else if (tracks.length >= 2) {
    // Fallback: sum haversine between consecutive points
    const { haversineM } = require('./locations.service');
    let sum = 0;
    for (let i = 1; i < tracks.length; i++) {
      sum += haversineM(tracks[i-1].lat, tracks[i-1].lng, tracks[i].lat, tracks[i].lng);
    }
    distanceKm = Math.round(sum / 1000 * 100) / 100;
  }

  // Fuel
  const fuelStart = prevState.fuelAtArrival ?? null;
  const fuelEnd   = arrival.fuel ?? null;
  const fuelUsed  = (fuelStart != null && fuelEnd != null) ? Math.round((fuelStart - fuelEnd) * 10) / 10 : null;
  const fuelPer100km = (fuelUsed != null && distanceKm > 0) ? Math.round((fuelUsed / distanceKm) * 100 * 10) / 10 : null;

  // Speed stats from track points
  const speeds = tracks.map(t => t.speed ?? 0).filter(s => s > 0);
  const avgSpeedKmh = speeds.length ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : null;
  const maxSpeedKmh = speeds.length ? Math.round(Math.max(...speeds)) : null;

  // ACC on time: sum intervals where accOn = true
  let accOnTimeMin = 0;
  if (tracks.length >= 2) {
    for (let i = 1; i < tracks.length; i++) {
      if (tracks[i-1].accOn) {
        const t1 = new Date(tracks[i-1].gpsTime || tracks[i-1].time).getTime();
        const t2 = new Date(tracks[i].gpsTime   || tracks[i].time).getTime();
        if (t2 > t1) accOnTimeMin += (t2 - t1) / 60000;
      }
    }
    accOnTimeMin = Math.round(accOnTimeMin * 10) / 10;
  }

  return { startTime, endTime, durationMin, distanceKm, fuelStart, fuelEnd, fuelUsed, fuelPer100km, avgSpeedKmh, maxSpeedKmh, accOnTimeMin };
}

// ── SMS format ─────────────────────────────────────────────────────────────────

function formatTripSms(trip, route, company) {
  const lines = [
    company || 'Star Link Fleet',
    `🗺 TRIP COMPLETED`,
    `Route   : ${route.name || trip.routeName}`,
    `Vehicle : ${trip.plate}`,
    `Duration: ${trip.durationMin} min`,
    `Distance: ${trip.distanceKm} km`,
  ];
  if (trip.fuelUsed != null) lines.push(`Fuel used: ${trip.fuelUsed} (${trip.fuelPer100km ?? '?'}/100km)`);
  if (trip.maxSpeedKmh != null) lines.push(`Max speed: ${trip.maxSpeedKmh} km/h`);
  lines.push(`Score   : ${trip.score}/100`);
  return lines.join('\n');
}

// ── Complete trip (async, fire-and-forget from onVehiclePosition) ─────────────

async function completeTripAsync(devIdno, plate, route, prevState, arrival) {
  const logger  = require('../utils/logger');
  const cms     = require('./cmsv6.service');
  const sms     = require('./sms.service');
  const company = process.env.COMPANY_NAME || 'Star Link Fleet';

  try {
    const begintime = new Date(prevState.arrivedAt).toISOString().replace('T', ' ').slice(0, 19);
    const endtime   = new Date(arrival.arrivedAt).toISOString().replace('T', ' ').slice(0, 19);

    let tracks = [];
    try { tracks = await cms.getGPSHistory(devIdno, begintime, endtime); } catch (_) {}

    const metrics = computeMetrics(tracks, prevState, arrival);
    const { score, scoreFuel, scoreTime, scoreSpeed, scoreSafety } = computeScore(metrics, route.id, route.speedLimitKmh);

    const trip = {
      id: newId(), routeId: route.id, routeName: route.name,
      devIdno, plate,
      actualFromId: route.reversed ? route.toId : route.fromId,
      actualToId:   route.reversed ? route.fromId : route.toId,
      ...metrics,
      score, scoreFuel, scoreTime, scoreSpeed, scoreSafety,
      createdAt: new Date().toISOString(),
    };

    store.trips.unshift(trip);
    if (store.trips.length > MAX_TRIPS) store.trips.length = MAX_TRIPS;
    save();

    logger.info(`[Trips] ✓ Trip recorded: ${plate} on ${route.name} — ${metrics.distanceKm}km, ${metrics.durationMin}min, score=${score}`);

    sms.sendAccEvent({ _smsMessage: formatTripSms(trip, route, company), type: 'trip_completed', plate, vehicleName: plate })
      .catch(e => logger.warn('[Trips] SMS failed: ' + e.message));

  } catch (e) {
    require('../utils/logger').error('[Trips] completeTripAsync failed: ' + e.message);
  }
}

// ── Main hook — called from monitor poll loop ──────────────────────────────────

async function onVehiclePosition(devIdno, plate, lat, lng, fuel, accOn, speed, mileageTotalM) {
  if (lat == null || lng == null) return;

  const locSvc  = require('./locations.service');
  const routeDef = require('./routes-def.service');
  const logger  = require('../utils/logger');

  const loc = locSvc.findNearestLocation(lat, lng);
  const prev = vehicleState[devIdno];
  const now  = Date.now();

  if (!prev) {
    // First observation
    if (loc) {
      vehicleState[devIdno] = { locationId: loc.id, arrivedAt: now, fuelAtArrival: fuel, mileageAtArrivalM: mileageTotalM, lat, lng };
      logger.info(`[Trips] ${plate} arrived at "${loc.name}"`);
    }
    return;
  }

  // Always update last known position
  prev.lat = lat;
  prev.lng = lng;

  if (loc && loc.id !== prev.locationId) {
    // Vehicle transitioned to a new location
    const route = routeDef.findRoute(prev.locationId, loc.id);
    if (route) {
      const arrival = { arrivedAt: now, fuel, mileageAtArrivalM: mileageTotalM, lat, lng };
      completeTripAsync(devIdno, plate, route, prev, arrival);
    }
    // Update state to new location
    vehicleState[devIdno] = { locationId: loc.id, arrivedAt: now, fuelAtArrival: fuel, mileageAtArrivalM: mileageTotalM, lat, lng };
    logger.info(`[Trips] ${plate} moved to "${loc.name}"${route ? ` — trip on "${route.name}" recorded` : ''}`);
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

function listTrips({ routeId, devIdno, limit = 100, from, to } = {}) {
  let trips = store.trips;
  if (routeId)  trips = trips.filter(t => t.routeId === routeId);
  if (devIdno)  trips = trips.filter(t => t.devIdno === devIdno);
  if (from)     trips = trips.filter(t => t.startTime >= from);
  if (to)       trips = trips.filter(t => t.startTime <= to);
  return trips.slice(0, Math.min(limit, 500));
}

function getRankings(routeId) {
  const trips = store.trips.filter(t => t.routeId === routeId);
  const vehicleMap = {};
  for (const t of trips) {
    if (!vehicleMap[t.devIdno]) vehicleMap[t.devIdno] = { devIdno: t.devIdno, plate: t.plate, trips: [], scores: [], fuels: [], times: [], speeds: [] };
    const vm = vehicleMap[t.devIdno];
    vm.trips.push(t);
    vm.scores.push(t.score);
    if (t.fuelPer100km != null) vm.fuels.push(t.fuelPer100km);
    if (t.durationMin  != null) vm.times.push(t.durationMin);
    if (t.avgSpeedKmh  != null) vm.speeds.push(t.avgSpeedKmh);
  }
  const results = Object.values(vehicleMap).map(vm => {
    const avg = arr => arr.length ? Math.round(arr.reduce((a,b) => a+b, 0) / arr.length * 10) / 10 : null;
    return {
      devIdno: vm.devIdno, plate: vm.plate,
      totalTrips: vm.trips.length,
      avgScore:   Math.round(avg(vm.scores) * 10) / 10,
      bestScore:  Math.max(...vm.scores),
      avgFuelPer100km: avg(vm.fuels),
      avgDurationMin:  avg(vm.times),
      avgSpeedKmh:     avg(vm.speeds),
      totalDistanceKm: Math.round(vm.trips.reduce((s, t) => s + (t.distanceKm || 0), 0) * 10) / 10,
    };
  });
  return results.sort((a, b) => b.avgScore - a.avgScore).map((r, i) => ({ ...r, rank: i + 1 }));
}

function getLeaderboard() {
  const vehicleMap = {};
  for (const t of store.trips) {
    if (!vehicleMap[t.devIdno]) vehicleMap[t.devIdno] = { devIdno: t.devIdno, plate: t.plate, trips: [], scores: [], fuels: [], times: [], speeds: [], routes: new Set() };
    const vm = vehicleMap[t.devIdno];
    vm.trips.push(t);
    vm.scores.push(t.score);
    vm.routes.add(t.routeId);
    if (t.fuelPer100km != null) vm.fuels.push(t.fuelPer100km);
    if (t.durationMin  != null) vm.times.push(t.durationMin);
    if (t.avgSpeedKmh  != null) vm.speeds.push(t.avgSpeedKmh);
  }
  const avg = arr => arr.length ? Math.round(arr.reduce((a,b) => a+b, 0) / arr.length * 10) / 10 : null;
  const results = Object.values(vehicleMap).map(vm => ({
    devIdno: vm.devIdno, plate: vm.plate,
    totalTrips:      vm.trips.length,
    totalRoutes:     vm.routes.size,
    avgScore:        avg(vm.scores),
    bestScore:       Math.max(...vm.scores),
    avgFuelPer100km: avg(vm.fuels),
    avgDurationMin:  avg(vm.times),
    avgSpeedKmh:     avg(vm.speeds),
    totalDistanceKm: Math.round(vm.trips.reduce((s, t) => s + (t.distanceKm || 0), 0) * 10) / 10,
    avgScoreFuel:    avg(vm.trips.map(t => t.scoreFuel).filter(v => v != null)),
    avgScoreTime:    avg(vm.trips.map(t => t.scoreTime).filter(v => v != null)),
    avgScoreSpeed:   avg(vm.trips.map(t => t.scoreSpeed).filter(v => v != null)),
  }));
  return results.sort((a, b) => b.avgScore - a.avgScore).map((r, i) => ({ ...r, rank: i + 1 }));
}

module.exports = { onVehiclePosition, listTrips, getRankings, getLeaderboard };
