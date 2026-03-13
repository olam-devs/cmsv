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
const { monitor, getDailyStats, getLastNonZeroFuel, getTotalFuelDuringOff, getVehicleState } = require('./monitor.service');

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

function fmtTime(ms) {
  // Format a UTC ms timestamp as HH:MM in fleet timezone
  return new Date(ms).toLocaleString('en-US', {
    timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

// Returns ms until next fire point (00:05, 06:05, 14:05, 22:05 in fleet timezone)
function msUntilNextPhase() {
  const now = new Date();
  const tzStr = now.toLocaleString('en-US', { timeZone: TIMEZONE });
  const tzDate = new Date(tzStr);
  const totalMins = tzDate.getHours() * 60 + tzDate.getMinutes();
  const fireMins = [5, 6 * 60 + 5, 14 * 60 + 5, 22 * 60 + 5]; // 00:05, 06:05, 14:05, 22:05
  const nextMins = fireMins.find(p => p > totalMins) ?? (24 * 60 + 5);
  const diffMs = (nextMins - totalMins) * 60 * 1000
               - tzDate.getSeconds() * 1000
               - tzDate.getMilliseconds();
  return Math.max(diffMs, 0);
}

// Returns info about the window that just ended, or the daily summary at midnight
function getPhaseInfo() {
  const tzStr = new Date().toLocaleString('en-US', { timeZone: TIMEZONE });
  const tzDate = new Date(tzStr);
  const h = tzDate.getHours();
  const today = tzDate.toLocaleDateString('en-CA'); // YYYY-MM-DD
  const yd = new Date(tzDate); yd.setDate(yd.getDate() - 1);
  const yesterday = yd.toLocaleDateString('en-CA');
  // h < 6   → fired at 00:05 → daily summary for yesterday
  // h >= 6  && h < 14 → fired at 06:05 → night shift report (22:00–05:59)
  // h >= 14 && h < 22 → fired at 14:05 → day shift report   (06:00–13:59)
  // h >= 22            → fired at 22:05 → evening shift report (14:00–21:59)
  if (h < 6)             return { name: `DAILY SUMMARY — ${yesterday}`,            begin: `${yesterday} 00:00:00`, end: `${yesterday} 23:59:59`, isDaily: true  };
  if (h >= 6  && h < 14) return { name: 'NIGHT SHIFT REPORT (22:00–05:59)',        begin: `${yesterday} 22:00:00`, end: `${today} 05:59:59`,    isDaily: false };
  if (h >= 14 && h < 22) return { name: 'DAY SHIFT REPORT (06:00–13:59)',          begin: `${today} 06:00:00`,    end: `${today} 13:59:59`,    isDaily: false };
  return                        { name: 'EVENING SHIFT REPORT (14:00–21:59)',       begin: `${today} 14:00:00`,    end: `${today} 21:59:59`,    isDaily: false };
}

// Analyse GPS track points for a window.
// Returns: uptimeSecs (ACC ON), onlineSecs (connected), offlineSecs (no signal).
// A gap > OFFLINE_GAP between consecutive points is treated as an offline period.
const OFFLINE_GAP = 5 * 60; // 5 minutes

async function calcWindowStats(devIdno, begintime, endtime) {
  const windowBegin = new Date(begintime).getTime();
  const windowEnd   = new Date(endtime).getTime();
  const windowSecs  = Math.round((windowEnd - windowBegin) / 1000);
  const empty = { uptimeSecs: 0, onlineSecs: 0, offlineSecs: windowSecs,
                  wasOfflineAtStart: true, firstOnlineAt: null, fuelAtFirstPoint: null };

  try {
    const tracks = await cms.getGPSHistory(devIdno, begintime, endtime);
    if (!Array.isArray(tracks) || tracks.length === 0) return empty;

    const sorted = tracks
      .filter(p => p.gpsTime)
      .sort((a, b) => new Date(a.gpsTime) - new Date(b.gpsTime));
    if (sorted.length === 0) return empty;

    let uptimeSecs  = 0;
    let offlineSecs = 0;

    // Gap from window start to first packet
    const firstPointMs  = new Date(sorted[0].gpsTime).getTime();
    const gapFromStart  = (firstPointMs - windowBegin) / 1000;
    const wasOfflineAtStart = gapFromStart > OFFLINE_GAP;
    if (wasOfflineAtStart) offlineSecs += gapFromStart;

    // Walk consecutive pairs
    for (let i = 0; i < sorted.length - 1; i++) {
      const t1 = new Date(sorted[i].gpsTime).getTime();
      const t2 = new Date(sorted[i + 1].gpsTime).getTime();
      const dt = (t2 - t1) / 1000;
      if (dt > OFFLINE_GAP) {
        offlineSecs += dt;
      } else if (sorted[i].accOn === true) {
        uptimeSecs += dt;
      }
    }

    // Gap from last packet to window end (only for past windows)
    if (windowEnd < Date.now()) {
      const lastPointMs = new Date(sorted[sorted.length - 1].gpsTime).getTime();
      const gapToEnd    = (windowEnd - lastPointMs) / 1000;
      if (gapToEnd > OFFLINE_GAP) offlineSecs += gapToEnd;
    }

    const onlineSecs = Math.max(0, windowSecs - Math.round(offlineSecs));
    return {
      uptimeSecs:       Math.round(uptimeSecs),
      onlineSecs:       Math.round(onlineSecs),
      offlineSecs:      Math.round(offlineSecs),
      wasOfflineAtStart,
      firstOnlineAt:    firstPointMs,              // ms timestamp of first GPS packet
      fuelAtFirstPoint: sorted[0].fuel ?? null,   // already scaled ÷100 by scaleStatus
    };
  } catch (e) {
    logger.warn(`[Report] calcWindowStats failed for ${devIdno}: ${e.message}`);
    return empty;
  }
}

// ── Build full report data ────────────────────────────────────────────────────

async function buildReport(manual = false) {
  const now          = Date.now();
  const dailyStats   = getDailyStats();
  const lastFuelMap  = getLastNonZeroFuel();
  const fuelDuringOffMap = getTotalFuelDuringOff();
  const vehicleState = getVehicleState();

  // Determine calculation window
  // Manual: from start of day to now. Scheduled: the phase window that just ended.
  const phaseInfo  = getPhaseInfo();
  const todayLocal = new Date().toLocaleString('sv', { timeZone: TIMEZONE }).slice(0, 10);
  const nowLocal   = new Date().toLocaleString('sv', { timeZone: TIMEZONE }).slice(0, 19);
  const uptimeWindow = manual
    ? { begin: `${todayLocal} 00:00:00`, end: nowLocal }
    : { begin: phaseInfo.begin,          end: phaseInfo.end };

  const [vehicles, statuses] = await Promise.all([
    cms.getVehicles(),
    cms.getAllGPS().catch(() => []),
  ]);

  const statusMap = {};
  for (const s of statuses) {
    const id = s.devIdno || s.id;
    if (id) statusMap[id] = s;
  }

  // Fetch window stats (uptime + online/offline breakdown) for all vehicles in parallel
  const windowStats_list = await Promise.all(
    vehicles.map(v => calcWindowStats(v.devIdno, uptimeWindow.begin, uptimeWindow.end))
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
    const vs    = vehicleState[id]; // live monitor state

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

    // Window stats from GPS track history
    const { uptimeSecs, onlineSecs, offlineSecs: windowOfflineSecs,
            wasOfflineAtStart, firstOnlineAt, fuelAtFirstPoint } = windowStats_list[i];

    // Fuel start reference:
    //   • Vehicle online at window start  → use daily fuelStartOfDay
    //   • Offline at window start but came online during window → use fuel at first GPS point
    //   • Offline the entire window → no fuel start available
    let fuelStart, fuelStartTime;
    if (!wasOfflineAtStart) {
      fuelStart     = stats?.fuelStartOfDay ?? null;
      fuelStartTime = null; // normal — no annotation needed
    } else if (firstOnlineAt && fuelAtFirstPoint != null) {
      fuelStart     = r1(fuelAtFirstPoint);
      fuelStartTime = fmtTime(firstOnlineAt); // "online from HH:MM"
    } else {
      fuelStart     = null;
      fuelStartTime = null;
    }

    const fuelUsed = (fuelStart != null && fuel != null && fuelStart > fuel)
      ? r1(fuelStart - fuel) : null;

    // Current ACC state duration — how long has it been in this state right now
    const accCurrentSecs = vs?.changedAt ? Math.round((now - vs.changedAt) / 1000) : null;

    // If currently offline: when did it go offline and for how long
    const isOfflineNow    = online === 0;
    const offlineSinceMs  = isOfflineNow && vs?.offlineSince ? vs.offlineSince : null;
    const offlineForSecs  = offlineSinceMs ? Math.round((now - offlineSinceMs) / 1000) : null;
    const offlineSinceStr = offlineSinceMs ? fmtTime(offlineSinceMs) : null;

    totalUptimeSecs += uptimeSecs;
    if (fuelUsed != null) totalFuelUsed += fuelUsed;
    if (online === 0) countOffline++;
    else if (accOn)   countOn++;
    else              countOff++;

    vehicleReports.push({
      plate, name, accOn, online, fuel, fuelEstimated, fuelStart, fuelStartTime, fuelUsed,
      uptimeSecs, onlineSecs, offlineSecs: windowOfflineSecs,
      wasOfflineAtStart,
      speed, todayKm, devIdno: id,
      fuelDuringOff:   fuelDuringOffMap[id] || 0,
      accCurrentSecs,
      offlineSinceStr, offlineForSecs,
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
    isDaily:   manual ? false : (phaseInfo.isDaily ?? false),
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
  const isOffline      = v.online === 0;
  const entireOffline  = isOffline && v.onlineSecs === 0; // offline the whole window
  const status         = isOffline ? 'OFFLINE' : v.accOn ? 'ON' : 'OFF';

  // Duration in current state
  let stateDur = '';
  if (isOffline && v.offlineForSecs)  stateDur = ` (${fmtDur(v.offlineForSecs)})`;
  else if (v.accCurrentSecs != null)  stateDur = ` (${fmtDur(v.accCurrentSecs)})`;

  const lines = [
    COMPANY,
    phaseName || 'FLEET REPORT',
    `${v.name}${v.name !== v.plate ? ` (${v.plate})` : ''}`,
    `ACC:${status}${stateDur} | Uptime:${fmtDur(v.uptimeSecs)}`,
  ];

  // Offline context
  if (isOffline && v.offlineSinceStr) {
    lines.push(`Offline since:${v.offlineSinceStr}`);
  }

  // Window connectivity breakdown (only if there was any offline time)
  if (v.offlineSecs > 0) {
    lines.push(`Window: Online ${fmtDur(v.onlineSecs)} / Offline ${fmtDur(v.offlineSecs)}`);
  }

  // Fuel
  if (entireOffline) {
    // No data at all this window — show last known fuel only
    const fuelVal = v.fuel != null ? `${v.fuel}*` : 'unknown';
    lines.push(`Fuel last known:${fuelVal}`);
  } else {
    // Build fuel line with smart start reference
    const fuelParts = [];
    if (v.wasOfflineAtStart && v.fuelStartTime) {
      fuelParts.push(`From ${v.fuelStartTime}:${v.fuelStart ?? 'N/A'}`);
    } else {
      fuelParts.push(`Start:${v.fuelStart ?? 'N/A'}`);
    }
    fuelParts.push(`Now:${v.fuel != null ? `${v.fuel}${v.fuelEstimated ? '*' : ''}` : 'N/A'}`);
    fuelParts.push(v.fuelUsed != null ? `Used:${v.fuelUsed}` : `Used:N/A`);
    lines.push(`Fuel ${fuelParts.join(' ')}`);

    // Fuel consumed while engine OFF — explicit theft alert with negative
    if (v.fuelDuringOff > 0) lines.push(`⚠ THEFT SUSPECTED: -${v.fuelDuringOff} consumed while engine OFF`);
  }

  if (!isOffline && v.speed > 0) lines.push(`Speed:${v.speed}km/h`);

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
  logger.info(`[Report] Next report in ${mins}m`);
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
