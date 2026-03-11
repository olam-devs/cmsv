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
const { monitor, getDailyStats, getLastNonZeroFuel, getTotalFuelDuringOff } = require('./monitor.service'); // getDailyStats used for fuelStartOfDay fallback

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

// Returns the phase that JUST ENDED (fires at 08:05→night ended, 16:05→day ended, 00:05→evening ended)
function getPhaseInfo() {
  const tzStr = new Date().toLocaleString('en-US', { timeZone: TIMEZONE });
  const tzDate = new Date(tzStr);
  const h = tzDate.getHours();
  const today = tzDate.toLocaleDateString('en-CA'); // YYYY-MM-DD
  const yd    = new Date(tzDate); yd.setDate(yd.getDate() - 1);
  const yesterday = yd.toLocaleDateString('en-CA');
  // h>=8 && h<16 → fired at 08:05, night window (00:00–07:59) just ended
  // h>=16        → fired at 16:05, day window  (08:00–15:59) just ended
  // h<8          → fired at 00:05, evening window (16:00–23:59) of yesterday just ended
  if (h >= 8 && h < 16) return { name: 'NIGHT REPORT (00:00–07:59)',   begin: `${today} 00:00:00`,     end: `${today} 07:59:59`     };
  if (h >= 16)           return { name: 'DAY REPORT (08:00–15:59)',     begin: `${today} 08:00:00`,     end: `${today} 15:59:59`     };
  return                        { name: 'EVENING REPORT (16:00–23:59)', begin: `${yesterday} 16:00:00`, end: `${yesterday} 23:59:59` };
}

// Calculate real ACC-ON uptime from GPS track points within a time window
// Uses the 'ac' bit field (bit0=1 → ACC ON) from queryTrackDetail track points
async function calcWindowUptime(devIdno, begintime, endtime) {
  try {
    const tracks = await cms.getGPSHistory(devIdno, begintime, endtime);
    if (!Array.isArray(tracks) || tracks.length < 2) return 0;
    const sorted = tracks.filter(p => p.gt).sort((a, b) => new Date(a.gt) - new Date(b.gt));
    let secs = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      if ((sorted[i].ac & 1) === 1) {
        const dt = (new Date(sorted[i + 1].gt) - new Date(sorted[i].gt)) / 1000;
        if (dt > 0 && dt < 3600) secs += dt; // skip gaps >1hr (offline/no-signal)
      }
    }
    return Math.round(secs);
  } catch (e) {
    logger.warn(`[Report] calcWindowUptime failed for ${devIdno}: ${e.message}`);
    return 0;
  }
}

// ── Build full report data ────────────────────────────────────────────────────

async function buildReport(manual = false) {
  const now          = Date.now();
  const dailyStats   = getDailyStats();
  const lastFuelMap  = getLastNonZeroFuel();
  const fuelDuringOffMap = getTotalFuelDuringOff();

  // Determine uptime calculation window
  // Manual: from start of day to now. Scheduled: the phase window that just ended.
  const phaseInfo = getPhaseInfo();
  const todayLocal = new Date().toLocaleString('sv', { timeZone: TIMEZONE }).slice(0, 10);
  const nowLocal   = new Date().toLocaleString('sv', { timeZone: TIMEZONE }).slice(0, 19);
  const uptimeWindow = manual
    ? { begin: `${todayLocal} 00:00:00`, end: nowLocal }
    : { begin: phaseInfo.begin, end: phaseInfo.end };

  const [vehicles, statuses] = await Promise.all([
    cms.getVehicles(),
    cms.getAllGPS().catch(() => []),
  ]);

  const statusMap = {};
  for (const s of statuses) {
    const id = s.devIdno || s.id;
    if (id) statusMap[id] = s;
  }

  // Fetch real uptime from GPS tracks for all vehicles in parallel
  const uptimeSecs_list = await Promise.all(
    vehicles.map(v => calcWindowUptime(v.devIdno, uptimeWindow.begin, uptimeWindow.end))
  );

  const vehicleReports = [];
  let totalUptimeSecs  = 0;
  let totalFuelUsed    = 0;
  let countOn = 0, countOff = 0, countOffline = 0;

  for (let i = 0; i < vehicles.length; i++) {
    const v     = vehicles[i];
    const id    = v.devIdno;
    const s     = statusMap[id] || {};
    const stats = dailyStats[id];

    const plate   = s.vid || v.plate || v.nm || id;
    const name    = v.nm  || plate;
    const accOn   = s.accOn  ?? false;
    const online  = s.ol     ?? 0;
    const speed   = s.speed  ?? 0;
    const todayKm = s.todayKm ?? null;

    // Use last non-zero fuel as fallback when sensor reads 0 or null
    const rawFuel = s.fuel;
    const fuel    = (rawFuel != null && rawFuel > 0) ? rawFuel
                  : (lastFuelMap[id] != null ? lastFuelMap[id] : rawFuel);
    const fuelEstimated = (rawFuel === 0 || rawFuel == null) && lastFuelMap[id] != null;

    // Real uptime from GPS track points for the relevant window
    const uptimeSecs = uptimeSecs_list[i];

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
      uptimeSecs, speed, todayKm, devIdno: id,
      fuelDuringOff: fuelDuringOffMap[id] || 0,
    });
  }

  const timeStr = new Date(now).toLocaleString('en-TZ', {
    timeZone: TIMEZONE,
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const reportLabel = manual
    ? `MANUAL PULL REPORT (00:00–${nowLocal.slice(11, 16)})`
    : phaseInfo.name;

  return {
    type:      'hourly_report',
    time:      new Date(now).toISOString(),
    timeStr,
    phaseName: reportLabel,
    uptimeWindow,
    vehicleReports,
    totals: {
      vehicles:           vehicles.length,
      on:                 countOn,
      off:                countOff,
      offline:            countOffline,
      totalUptimeSecs,
      totalFuelUsed:      r1(totalFuelUsed),
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
    const report = await buildReport(manual);

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
  logger.info(`[Report] Next phase report in ${mins}m (${getPhaseInfo().name})`);
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
