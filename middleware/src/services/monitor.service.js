/**
 * monitor.service.js — Real-time ACC state + online/offline watcher
 *
 * Polls CMSV6 every POLL_INTERVAL ms, detects ACC on/off and online/offline
 * transitions per vehicle, records fuel at each transition, and calculates
 * uptime/downtime durations. Emits events via EventEmitter for SSE clients.
 *
 * Events emitted:
 *   'event' — { type:'acc_on'|'acc_off'|'vehicle_online'|'vehicle_offline',
 *               plate, devIdno, fuel, time,
 *               downtimeSecs?, downtimeStr?,   ← on acc_on / vehicle_online
 *               uptimeSecs?,   uptimeStr?,     ← on acc_off
 *               fuelAtStart?,  fuelUsed? }     ← on acc_off
 *
 * Online/offline uses 2-poll confirmation (~30s) to avoid false alarms.
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const cms    = require('./cmsv6.service');
const sms    = require('./sms.service');

const STATE_FILE = path.join(__dirname, '../../../data/monitor-state.json');

const POLL_INTERVAL         = parseInt(process.env.MONITOR_POLL_MS)      || 15000; // 15 s
const TIMEZONE              = process.env.FLEET_TIMEZONE                  || 'Africa/Dar_es_Salaam';
const FUEL_THEFT_THRESHOLD  = parseFloat(process.env.FUEL_THEFT_THRESHOLD) || 10;   // scaled units (after ÷100); tune per fleet

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
// { [devIdno]: { accOn: bool, online: bool, offlineSince: ms|null,
//                pendingOffline: bool, fuelAtChange: number|null,
//                changedAt: ms, plate: str } }
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
      date:                   today,
      fuelStartOfDay:         null,
      totalUptimeSecs:        0,
      totalFuelConsumedDuringOff: 0,
      lastAccOnTime:          wasOn ? now : null, // if engine stayed on overnight, start counting from midnight
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

// ── State persistence (survives middleware restarts) ──────────────────────────
function saveState() {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify({ dailyStats, eventHistory, lastNonZeroFuel }, null, 2));
  } catch (e) {
    logger.warn('[Monitor] State save failed: ' + e.message);
  }
}

function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (raw.dailyStats) Object.assign(dailyStats, raw.dailyStats);
    if (raw.eventHistory) eventHistory.push(...raw.eventHistory.slice(0, MAX_HISTORY));
    if (raw.lastNonZeroFuel) Object.assign(lastNonZeroFuel, raw.lastNonZeroFuel);
    logger.info('[Monitor] State loaded from disk');
  } catch (e) {
    logger.warn('[Monitor] State load failed: ' + e.message);
  }
}

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
    const accOn  = s.accOn;          // boolean from scaleStatus() — null if field missing
    const online = (s.ol ?? 0) !== 0; // ol: 0=offline, 1=online, 2=alarm
    const fuel   = s.fuel;           // scaled (yl / 100), may be null

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
      vehicleState[id] = { accOn, online, pendingOffline: false, offlineSince: online ? null : now, fuelAtChange: fuel, changedAt: now, plate, vehicleName };
      if (accOn && stats.lastAccOnTime === null) stats.lastAccOnTime = now;
      // Don't fire online/offline SMS on first observation — avoid spam on restart
      continue;
    }

    // Keep plate / name up to date
    prev.plate       = plate;
    prev.vehicleName = vehicleName;

    // ── Online / offline transition (2-poll confirmation) ─────────────────
    if (online && !prev.online) {
      // Vehicle came back online — fire immediately
      const offlineSecs = prev.offlineSince ? Math.round((now - prev.offlineSince) / 1000) : null;

      // ── Fuel theft detection ──────────────────────────────────────────────
      if (prev.fuelAtOffline != null && fuel != null) {
        const fuelDrop = round1(prev.fuelAtOffline - fuel);
        if (fuelDrop > FUEL_THEFT_THRESHOLD) {
          const theftEvt = {
            type:           'fuel_theft_suspected',
            plate,
            vehicleName,
            devIdno:        id,
            fuelBefore:     round1(prev.fuelAtOffline),
            fuelNow:        round1(fuel),
            fuelDrop,
            time:           new Date(now).toISOString(),
            offlineSecs,
            offlineStr:     offlineSecs ? formatDuration(offlineSecs) : null,
            accOnAtOffline: prev.accOnAtOffline ?? false,
          };
          pushHistory(theftEvt);
          monitor.emit('event', theftEvt);
          sms.sendAccEvent(theftEvt).catch(e => logger.error('[Monitor] SMS dispatch error: ' + e.message));
          logger.warn(`[Monitor] 🚨 FUEL DROP ${plate} | before=${prev.fuelAtOffline} now=${round1(fuel)} drop=${fuelDrop}`);
        }
      }

      const onlineEvt = {
        type:         'vehicle_online',
        plate,
        vehicleName,
        devIdno:      id,
        fuel:         fuel != null ? round1(fuel) : null,
        time:         new Date(now).toISOString(),
        offlineSecs,
        offlineStr:   offlineSecs ? formatDuration(offlineSecs) : null,
      };
      prev.online         = true;
      prev.pendingOffline = false;
      prev.offlineSince   = null;
      prev.fuelAtOffline  = null; // clear — no longer relevant
      pushHistory(onlineEvt);
      monitor.emit('event', onlineEvt);
      sms.sendAccEvent(onlineEvt).catch(e => logger.error('[Monitor] SMS dispatch error: ' + e.message));
      logger.info(`[Monitor] 🟡 ONLINE  ${plate}${offlineSecs ? ` — was offline ${formatDuration(offlineSecs)}` : ''}`);
    } else if (!online && prev.online) {
      // Vehicle went offline — mark pending; confirm on next poll
      if (!prev.pendingOffline) {
        prev.pendingOffline = true;
        prev.offlineSince   = now;
      } else {
        // Second consecutive offline poll — confirmed offline
        // If engine was ON, bank uptime up to the moment it went offline and stop the clock
        if (prev.accOn === true && stats.lastAccOnTime !== null) {
          stats.totalUptimeSecs += Math.round((prev.offlineSince - stats.lastAccOnTime) / 1000);
          stats.lastAccOnTime    = null;
          logger.info(`[Monitor] ⏱  Banked uptime for ${plate} (went offline while ACC ON)`);
        }
        // Snapshot the last known fuel so we can detect theft when it reconnects
        prev.fuelAtOffline    = prev.fuelAtChange;
        prev.accOnAtOffline   = prev.accOn;
        prev.online           = false;
        prev.pendingOffline   = false;

        const offlineEvt = {
          type:        'vehicle_offline',
          plate,
          vehicleName,
          devIdno:     id,
          fuel:        prev.fuelAtChange != null ? round1(prev.fuelAtChange) : null,
          time:        new Date(now).toISOString(),
        };
        pushHistory(offlineEvt);
        monitor.emit('event', offlineEvt);
        sms.sendAccEvent(offlineEvt).catch(e => logger.error('[Monitor] SMS dispatch error: ' + e.message));
        logger.info(`[Monitor] ⚫ OFFLINE ${plate}${prev.accOnAtOffline ? ' (ACC was ON)' : ''}`);
      }
    } else {
      // No change in online state — clear pending if back online
      if (online) prev.pendingOffline = false;
    }

    if (accOn === null || accOn === undefined) continue; // ACC not tracked on this device
    if (prev.accOn === accOn) continue; // no ACC state change

    // ── ACC transition detected ───────────────────────────────────────────
    const durationSecs = Math.round((now - prev.changedAt) / 1000);
    let evt;

    if (accOn) {
      // OFF → ON: downtime = how long engine was OFF (parked)
      const fuelConsumedDuringOff = (prev.fuelAtChange != null && fuel != null && prev.fuelAtChange > fuel)
        ? round1(prev.fuelAtChange - fuel) : null;
      evt = {
        type:         'acc_on',
        plate,
        vehicleName,
        devIdno:      id,
        fuel:         fuel  != null ? round1(fuel)  : null,
        time:         new Date(now).toISOString(),
        downtimeSecs: durationSecs,
        downtimeStr:  formatDuration(durationSecs),
        fuelConsumedDuringOff,
      };
      if (fuelConsumedDuringOff != null) stats.totalFuelConsumedDuringOff += fuelConsumedDuringOff;
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

    // Update state — mutate in place to preserve online/offline tracking fields
    prev.accOn       = accOn;
    prev.fuelAtChange = fuel;
    prev.changedAt   = now;

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
  loadState();
  logger.info(`[Monitor] ACC monitor started — polling every ${POLL_INTERVAL / 1000}s`);
  poll(); // immediate first run
  pollTimer = setInterval(poll, POLL_INTERVAL);
  // Save state every 2 minutes
  setInterval(saveState, 2 * 60 * 1000);
}

function stop() {
  saveState();
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  logger.info('[Monitor] ACC monitor stopped');
}

function getHistory(limit = 50) {
  return eventHistory.slice(0, Math.min(limit, MAX_HISTORY));
}

function getDailyStats()      { return dailyStats; }
function getVehicleState()   { return vehicleState; }
function getLastNonZeroFuel() { return lastNonZeroFuel; }
function getTotalFuelDuringOff() { return Object.fromEntries(Object.entries(dailyStats).map(([id, s]) => [id, s.totalFuelConsumedDuringOff || 0])); }

module.exports = { monitor, start, stop, getHistory, getDailyStats, getVehicleState, getLastNonZeroFuel, getTotalFuelDuringOff };
