/**
 * monitor.service.js — Real-time ACC state watcher
 *
 * Polls CMSV6 every POLL_INTERVAL ms, detects ACC on/off transitions per
 * vehicle, records fuel at each transition, and calculates uptime/downtime
 * durations. Emits events via EventEmitter for SSE clients to consume.
 *
 * Events emitted:
 *   'event' — { type:'acc_on'|'acc_off', plate, devIdno, fuel,
 *               fuelAtStart?, fuelUsed?, time,
 *               downtimeSecs?, downtimeStr?,   ← on acc_on
 *               uptimeSecs?,   uptimeStr? }    ← on acc_off
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');
const cms    = require('./cmsv6.service');
const sms    = require('./sms.service');

const POLL_INTERVAL = parseInt(process.env.MONITOR_POLL_MS) || 15000; // 15 s
const TIMEZONE      = process.env.FLEET_TIMEZONE || 'Africa/Dar_es_Salaam';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(secs) {
  if (secs < 60)  return `${secs}s`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function round1(v) { return Math.round(v * 10) / 10; }

// ── State tracking ────────────────────────────────────────────────────────────
// { [devIdno]: { accOn: bool, fuelAtChange: number|null, changedAt: ms, plate: str } }
const vehicleState = {};

// ── Daily stats (reset at midnight per vehicle) ───────────────────────────────
// { [devIdno]: { date, fuelStartOfDay, totalUptimeSecs, lastAccOnTime } }
const dailyStats = {};

// ── Last-known non-zero fuel per vehicle (survives across polls, used as fallback) ──
const lastNonZeroFuel = {};

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE }); // YYYY-MM-DD
}

function ensureDailyStats(id, now) {
  const today = todayStr();
  if (!dailyStats[id] || dailyStats[id].date !== today) {
    // New day — reset; if engine was on carry the on-time forward
    const wasOn = dailyStats[id]?.lastAccOnTime != null;
    dailyStats[id] = {
      date:            today,
      fuelStartOfDay:  null,
      totalUptimeSecs: 0,
      lastAccOnTime:   wasOn ? now : null, // if engine stayed on overnight, start counting from midnight
    };
  }
  return dailyStats[id];
}

// Ring buffer — last 200 events (survives in memory for the session)
const eventHistory = [];
const MAX_HISTORY  = 200;

function pushHistory(evt) {
  eventHistory.unshift(evt);
  if (eventHistory.length > MAX_HISTORY) eventHistory.pop();
}

// ── Emitter ───────────────────────────────────────────────────────────────────
class MonitorEmitter extends EventEmitter {}
const monitor = new MonitorEmitter();
monitor.setMaxListeners(200); // support many SSE clients

// ── Core poll ─────────────────────────────────────────────────────────────────
async function poll() {
  let statuses;
  try {
    statuses = await cms.getAllGPS();
  } catch (e) {
    logger.warn('[Monitor] getAllGPS failed: ' + e.message);
    return;
  }

  if (!Array.isArray(statuses)) return;

  const now = Date.now();

  for (const s of statuses) {
    const id = s.devIdno || s.id;
    if (!id) continue;

    const plate       = s.vid || s.plate || id;
    const vehicleName = s.nm  || plate;          // vehicle display name
    const accOn = s.accOn; // boolean from scaleStatus() — null if field missing
    const fuel  = s.fuel;  // scaled (yl / 100), may be null

    if (accOn === null || accOn === undefined) continue;

    // ── Daily stats: seed fuel at start of day ────────────────────────────
    const stats = ensureDailyStats(id, now);
    if (stats.fuelStartOfDay === null && fuel !== null && fuel > 0) {
      stats.fuelStartOfDay = fuel;
    }

    // Track last non-zero fuel reading for fallback when sensor reads 0
    if (fuel != null && fuel > 0) {
      lastNonZeroFuel[id] = fuel;
    }

    const prev = vehicleState[id];

    if (!prev) {
      // First observation — seed state; if engine already on, start uptime clock
      vehicleState[id] = { accOn, fuelAtChange: fuel, changedAt: now, plate, vehicleName };
      if (accOn && stats.lastAccOnTime === null) stats.lastAccOnTime = now;
      continue;
    }

    // Keep plate / name up to date
    prev.plate       = plate;
    prev.vehicleName = vehicleName;

    if (prev.accOn === accOn) continue; // no state change

    // ── Transition detected ───────────────────────────────────────────────
    const durationSecs = Math.round((now - prev.changedAt) / 1000);
    let evt;

    if (accOn) {
      // OFF → ON: downtime = how long engine was OFF (parked)
      evt = {
        type:         'acc_on',
        plate,
        vehicleName,
        devIdno:      id,
        fuel:         fuel  != null ? round1(fuel)  : null,
        time:         new Date(now).toISOString(),
        downtimeSecs: durationSecs,
        downtimeStr:  formatDuration(durationSecs),
      };
    } else {
      // ON → OFF: uptime = how long engine was ON (running)
      const fuelUsed = (prev.fuelAtChange != null && fuel != null)
        ? round1(prev.fuelAtChange - fuel)
        : null;
      evt = {
        type:        'acc_off',
        plate,
        vehicleName,
        devIdno:     id,
        fuel:        fuel != null ? round1(fuel) : null,
        fuelAtStart: prev.fuelAtChange != null ? round1(prev.fuelAtChange) : null,
        fuelUsed,
        time:        new Date(now).toISOString(),
        uptimeSecs:  durationSecs,
        uptimeStr:   formatDuration(durationSecs),
      };
    }

    // ── Update daily uptime stats ─────────────────────────────────────────
    if (accOn) {
      // OFF → ON: start uptime clock
      stats.lastAccOnTime = now;
    } else {
      // ON → OFF: bank elapsed uptime
      if (stats.lastAccOnTime !== null) {
        stats.totalUptimeSecs += Math.round((now - stats.lastAccOnTime) / 1000);
        stats.lastAccOnTime    = null;
      }
    }

    // Update state
    vehicleState[id] = { accOn, fuelAtChange: fuel, changedAt: now, plate, vehicleName };

    pushHistory(evt);
    monitor.emit('event', evt);

    // Fire SMS — non-blocking, errors are logged inside sms.service
    sms.sendAccEvent(evt).catch(e => logger.error('[Monitor] SMS dispatch error: ' + e.message));

    logger.info(
      `[Monitor] ${evt.type === 'acc_on' ? '🟢' : '🔴'} ${plate}` +
      ` | fuel=${evt.fuel ?? '—'}` +
      ` | ${accOn ? `parked ${evt.downtimeStr}` : `ran ${evt.uptimeStr}`}` +
      (evt.fuelUsed != null ? ` | used=${evt.fuelUsed}` : ''),
    );
  }
}

// ── Start / stop ──────────────────────────────────────────────────────────────
let pollTimer = null;

function start() {
  if (pollTimer) return;
  logger.info(`[Monitor] ACC monitor started — polling every ${POLL_INTERVAL / 1000}s`);
  poll(); // immediate first run
  pollTimer = setInterval(poll, POLL_INTERVAL);
}

function stop() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  logger.info('[Monitor] ACC monitor stopped');
}

function getHistory(limit = 50) {
  return eventHistory.slice(0, Math.min(limit, MAX_HISTORY));
}

function getDailyStats()      { return dailyStats; }
function getVehicleState()   { return vehicleState; }
function getLastNonZeroFuel() { return lastNonZeroFuel; }

module.exports = { monitor, start, stop, getHistory, getDailyStats, getVehicleState, getLastNonZeroFuel };
