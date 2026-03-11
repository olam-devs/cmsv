/**
 * hourly-report.service.js
 *
 * Fires once per hour at the :30 mark (e.g. 1:30, 2:30, 5:30, 15:30 …).
 *
 * For each vehicle reports:
 *   • Current ACC status (ON / OFF / OFFLINE)
 *   • Fuel at start of day, fuel now, fuel consumed
 *   • Total engine uptime today up to this moment
 *   • Current speed & GPS coordinates
 *
 * Delivery:
 *   1. SMS  — one separate SMS per vehicle (keeps each under 160 chars)
 *   2. SSE  — single 'hourly_report' event pushed to all dashboard clients
 */

require('dotenv').config();
const logger = require('../utils/logger');
const cms    = require('./cmsv6.service');
const sms    = require('./sms.service');
const { monitor, getDailyStats, getLastNonZeroFuel, getTotalFuelDuringOff } = require('./monitor.service');

const TIMEZONE = process.env.FLEET_TIMEZONE || 'Africa/Dar_es_Salaam';
const COMPANY  = process.env.COMPANY_NAME   || 'Star Link Fleet';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDur(secs) {
  if (!secs || secs <= 0) return '0m';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function r1(v) { return Math.round(v * 10) / 10; }

// Returns ms until next phase boundary (00:05, 08:05, or 16:05 in fleet timezone)
function msUntilNextPhase() {
  const now = new Date();
  const tzStr = now.toLocaleString('en-US', { timeZone: TIMEZONE });
  const tzDate = new Date(tzStr);
  const totalMins = tzDate.getHours() * 60 + tzDate.getMinutes();
  const phaseMins = [5, 8 * 60 + 5, 16 * 60 + 5]; // 00:05, 08:05, 16:05
  const nextMins = phaseMins.find(p => p > totalMins) ?? (24 * 60 + 5);
  const diffMs = (nextMins - totalMins) * 60 * 1000
               - tzDate.getSeconds() * 1000
               - tzDate.getMilliseconds();
  return Math.max(diffMs, 0);
}

function getPhaseName() {
  const tzStr = new Date().toLocaleString('en-US', { timeZone: TIMEZONE });
  const h = new Date(tzStr).getHours();
  if (h < 8)  return 'NIGHT REPORT (00:00–07:59)';
  if (h < 16) return 'DAY REPORT (08:00–15:59)';
  return 'EVENING REPORT (16:00–23:59)';
}

// ── Build full report data ────────────────────────────────────────────────────

async function buildReport() {
  const now          = Date.now();
  const dailyStats   = getDailyStats();
  const lastFuelMap  = getLastNonZeroFuel();
  const fuelDuringOffMap = getTotalFuelDuringOff();

  const [vehicles, statuses] = await Promise.all([
    cms.getVehicles(),
    cms.getAllGPS().catch(() => []),
  ]);

  const statusMap = {};
  for (const s of statuses) {
    const id = s.devIdno || s.id;
    if (id) statusMap[id] = s;
  }

  const vehicleReports = [];
  let totalUptimeSecs  = 0;
  let totalFuelUsed    = 0;
  let countOn = 0, countOff = 0, countOffline = 0;

  for (const v of vehicles) {
    const id    = v.devIdno;
    const s     = statusMap[id] || {};
    const stats = dailyStats[id];

    const plate   = s.vid || v.plate || v.nm || id;
    const name    = v.nm  || plate;
    const accOn   = s.accOn  ?? false;
    const online  = s.ol     ?? 0;
    const speed   = s.speed  ?? 0;
    const lat     = s.lat    ?? null;
    const lng     = s.lng    ?? null;
    const todayKm = s.todayKm ?? null;

    // Use last non-zero fuel as fallback when sensor reads 0 or null
    const rawFuel = s.fuel;
    const fuel    = (rawFuel != null && rawFuel > 0) ? rawFuel
                  : (lastFuelMap[id] != null ? lastFuelMap[id] : rawFuel);
    const fuelEstimated = (rawFuel === 0 || rawFuel == null) && lastFuelMap[id] != null;

    // Current uptime: banked seconds + any live session
    let uptimeSecs = stats?.totalUptimeSecs ?? 0;
    if (stats?.lastAccOnTime) {
      uptimeSecs += Math.round((now - stats.lastAccOnTime) / 1000);
    }

    const fuelStart = stats?.fuelStartOfDay ?? null;
    const fuelUsed  = (fuelStart != null && fuel != null && fuelStart > fuel)
      ? r1(fuelStart - fuel) : null;

    totalUptimeSecs += uptimeSecs;
    if (fuelUsed != null) totalFuelUsed += fuelUsed;
    if (online === 0) countOffline++;
    else if (accOn)   countOn++;
    else              countOff++;

    vehicleReports.push({
      plate, name, accOn, online, fuel, fuelEstimated, fuelStart, fuelUsed,
      uptimeSecs, speed, lat, lng, todayKm, devIdno: id,
      fuelDuringOff: fuelDuringOffMap[id] || 0,
    });
  }

  const timeStr = new Date(now).toLocaleString('en-TZ', {
    timeZone: TIMEZONE,
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return {
    type: 'hourly_report',
    time: new Date(now).toISOString(),
    timeStr,
    phaseName: getPhaseName(),
    vehicleReports,
    totals: {
      vehicles:        vehicles.length,
      on:              countOn,
      off:             countOff,
      offline:         countOffline,
      totalUptimeSecs,
      totalFuelUsed:   r1(totalFuelUsed),
      totalFuelDuringOff: r1(Object.values(fuelDuringOffMap).reduce((a, b) => a + b, 0)),
    },
  };
}

// ── Format one SMS per vehicle (kept short — fits in a single 160-char SMS) ───

function formatVehicleSMS(v, timeStr, phaseName) {
  const status = v.online === 0 ? 'OFFLINE' : v.accOn ? 'ON' : 'OFF';
  const lines  = [
    COMPANY,
    phaseName || 'FLEET REPORT',
    `${v.name}${v.name !== v.plate ? ` (${v.plate})` : ''}`,
    `ACC:${status} | Uptime:${fmtDur(v.uptimeSecs)}`,
  ];

  // Fuel line — only if we have data
  const fuelParts = [];
  if (v.fuelStart != null) fuelParts.push(`Start:${v.fuelStart}`);
  if (v.fuel      != null) fuelParts.push(`Now:${v.fuel}${v.fuelEstimated ? '*' : ''}`);
  if (v.fuelUsed  != null) fuelParts.push(`Used:${v.fuelUsed}`);
  if (fuelParts.length)    lines.push(`Fuel ${fuelParts.join(' ')}`);

  if (v.fuelDuringOff > 0) lines.push(`Off-consumption:-${v.fuelDuringOff}L`);
  if (v.todayKm   != null && v.todayKm > 0) lines.push(`Distance today:${v.todayKm.toFixed(1)}km`);
  if (v.speed > 0)         lines.push(`Speed:${v.speed}km/h`);

  lines.push(timeStr);
  return lines.join('\n');
}

// ── Send ──────────────────────────────────────────────────────────────────────

async function sendReport(sendSms = true, manual = false) {
  logger.info(`[Report] Generating fleet report… (SMS: ${sendSms})`);
  try {
    const report = await buildReport();

    // 1. Push full report to all SSE / dashboard clients
    if (manual) report._manual = true;
    monitor.emit('event', report);
    logger.info(`[Report] SSE pushed — ${report.vehicleReports.length} vehicles`);

    // 2. Conditionally send one SMS per vehicle
    if (sendSms) {
      for (const v of report.vehicleReports) {
        const message = formatVehicleSMS(v, report.timeStr, report.phaseName || 'FLEET REPORT');
        await sms.sendAccEvent({ ...report, _smsMessage: message })
          .catch(e => logger.error(`[Report] SMS failed for ${v.plate}: ${e.message}`));
      }
    }

    logger.info(`[Report] Done`);
  } catch (e) {
    logger.error('[Report] Failed: ' + e.message);
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

let scheduleTimer = null;

function scheduleNext() {
  const delay = msUntilNextPhase();
  const mins  = Math.round(delay / 60000);
  logger.info(`[Report] Next phase report in ${mins}m (${getPhaseName()})`);
  scheduleTimer = setTimeout(() => {
    sendReport();
    scheduleNext();
  }, delay);
}

function start() {
  if (scheduleTimer) return;
  scheduleNext();
}

function stop() {
  if (scheduleTimer) { clearTimeout(scheduleTimer); scheduleTimer = null; }
  logger.info('[Report] Scheduler stopped');
}

module.exports = { start, stop, sendReport };
