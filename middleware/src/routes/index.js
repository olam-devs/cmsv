/**
 * routes/index.js  —  All fleet API routes
 * 
 * Mounts:
 *   /api/fleet/...       Fleet overview & management
 *   /api/vehicles/...    Per-vehicle operations
 *   /api/reports/...     Historical data & exports
 *   /api/cameras/...     Live feeds & recordings
 *   /api/fuel/...        Fuel sensor data
 *   /api/chat            AI chatbot
 */

const express = require('express');
const router  = express.Router();
const cms     = require('../services/cmsv6.service');
const hourlyReport = require('../services/hourly-report.service');
const { getLastNonZeroFuel } = require('../services/monitor.service');
const logger  = require('../utils/logger');

// ── Helpers ────────────────────────────────────────────────────────────────

const ok  = (res, data, meta = {}) => res.json({ success: true, ...meta, data });
const err = (res, msg, status = 400) => res.status(status).json({ success: false, message: msg });

function dateRange(req) {
  const { begintime, endtime, date } = req.query;
  if (date) {
    return { begintime: `${date} 00:00:00`, endtime: `${date} 23:59:59` };
  }
  if (!begintime || !endtime) {
    throw new Error('Provide begintime & endtime (YYYY-MM-DD HH:mm:ss) or date (YYYY-MM-DD)');
  }
  return { begintime, endtime };
}

// ══════════════════════════════════════════════════════════════════════════
//  FLEET OVERVIEW
// ══════════════════════════════════════════════════════════════════════════

/** GET /api/fleet/snapshot — Real-time fleet status (primary dashboard feed) */
router.get('/fleet/snapshot', async (req, res) => {
  const data = await cms.getFleetSnapshot();
  ok(res, data);
});

/** GET /api/fleet/summary?date=YYYY-MM-DD — Daily operations summary */
router.get('/fleet/summary', async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const data = await cms.getDailySummary(date);
  ok(res, data);
});

/** POST /api/fleet/report/trigger — Manually trigger the hourly report */
router.post('/fleet/report/trigger', async (req, res) => {
  const { sendSms = false } = req.body;
  hourlyReport.sendReport(sendSms, true); // manual=true marks it as on-demand
  ok(res, { message: 'Report generation triggered' });
});

/** GET /api/fleet/vehicles — All vehicles with live status merged */
router.get('/fleet/vehicles', async (req, res) => {
  const [vehicles, statuses] = await Promise.all([
    cms.getVehicles(),
    cms.getAllGPS().catch(() => []),
  ]);
  // CMSV6 device status uses 'devIdno' field (not 'id') as the device identifier
  const statusMap = {};
  for (const s of statuses) {
    if (s.devIdno) statusMap[s.devIdno] = s;  // primary key: devIdno
    if (s.id)     statusMap[s.id]     = s;   // fallback: id field
  }
  const lastFuelMap = getLastNonZeroFuel();
  const enriched = vehicles.map(v => {
    const s      = statusMap[v.devIdno] || null;
    const rawFuel = s?.fuel ?? null;
    // Use last known non-zero fuel as fallback when sensor reports 0 or null
    const fuel    = (rawFuel != null && rawFuel > 0) ? rawFuel
                  : (lastFuelMap[v.devIdno] ?? (rawFuel === 0 ? 0 : null));
    const fuelEstimated = (rawFuel == null || rawFuel === 0) && lastFuelMap[v.devIdno] != null;
    return {
      devIdno:  v.devIdno,
      plate:    v.plate || v.nm || '—',
      nm:       v.nm,
      online:   s?.ol      ?? 0,
      speed:    s?.speed   ?? 0,
      fuel,
      fuelEstimated,
      lat:      s?.lat     ?? null,
      lng:      s?.lng     ?? null,
      todayKm:  s?.todayKm ?? null,
      // Extra live fields
      gpsTime:  s?.gpsTime ?? null,
      accOn:    s?.accOn   ?? false,   // boolean from scaleStatus
      signal:   s?.signal  ?? null,
      satellites: s?.satellites ?? null,
      alarm:    s?.alarm   ?? 0,
    };
  });
  ok(res, enriched, { count: enriched.length });
});

/** GET /api/fleet/live — Live GPS for all vehicles */
router.get('/fleet/live', async (req, res) => {
  const data = await cms.getAllGPS();
  ok(res, data, { count: data.length });
});

/** GET /api/fleet/alarms/active — Vehicles currently in alarm state */
router.get('/fleet/alarms/active', async (req, res) => {
  const data = await cms.getActiveAlarms();
  ok(res, data, { count: data.length });
});

// ══════════════════════════════════════════════════════════════════════════
//  INDIVIDUAL VEHICLE
// ══════════════════════════════════════════════════════════════════════════

/** GET /api/vehicles/:id — Vehicle details */
router.get('/vehicles/:id', async (req, res) => {
  const data = await cms.getVehicle(req.params.id);
  ok(res, data);
});

/** GET /api/vehicles/:id/gps — Live GPS position */
router.get('/vehicles/:id/gps', async (req, res) => {
  const data = await cms.getVehicleGPS(req.params.id);
  if (!data) return err(res, 'No GPS data — vehicle may be offline', 404);
  ok(res, data);
});

/** GET /api/vehicles/:id/track?begintime=...&endtime=... — Route history */
router.get('/vehicles/:id/track', async (req, res) => {
  const { begintime, endtime } = dateRange(req);
  const data = await cms.getGPSHistory(req.params.id, begintime, endtime);
  ok(res, data, { count: data.length, period: { begintime, endtime } });
});

/** GET /api/vehicles/:id/today — Full today's report (location + mileage + alarms + fuel) */
router.get('/vehicles/:id/today', async (req, res) => {
  const id = req.params.id;
  const today = new Date().toISOString().slice(0, 10);
  const begintime = `${today} 00:00:00`;
  const endtime   = `${today} 23:59:59`;

  const [gps, mileage, alarms, fuel] = await Promise.allSettled([
    cms.getVehicleGPS(id),
    cms.getMileageReport(id, begintime, endtime),
    cms.getAlarms({ devIdno: id, begintime, endtime, pageSize: 100 }),
    cms.getFuelLevel(id),
  ]);

  ok(res, {
    devIdno: id,
    date: today,
    gps:     gps.status     === 'fulfilled' ? gps.value     : null,
    mileage: mileage.status === 'fulfilled' ? mileage.value : null,
    alarms:  alarms.status  === 'fulfilled' ? alarms.value  : { alarms: [], total: 0 },
    fuel:    fuel.status    === 'fulfilled' ? fuel.value    : null,
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  FUEL SENSOR
// ══════════════════════════════════════════════════════════════════════════

/** GET /api/fuel/fleet — Fleet-wide fuel status (live GPS with fuel field) */
router.get('/fuel/fleet', async (req, res) => {
  const statuses = await cms.getAllGPS();
  const withFuel = statuses
    .filter(s => s.fuel != null)
    .map(s => ({ devIdno: s.id, fuel: s.fuel, speed: s.speed, lat: s.lat, lng: s.lng, online: s.ol }));
  ok(res, withFuel, { count: withFuel.length });
});

/** GET /api/fuel/:id/live — Live fuel level for one vehicle */
router.get('/fuel/:id/live', async (req, res) => {
  const data = await cms.getFuelLevel(req.params.id);
  if (!data) return err(res, 'No fuel data — check sensor is configured', 404);
  ok(res, data);
});

/**
 * GET /api/fuel/:id/report?begintime=...&endtime=...
 * Fuel consumption chart data — GPS track points with yl (fuel) field.
 * id may be a plate number or devIdno; we resolve devIdno automatically.
 */
router.get('/fuel/:id/report', async (req, res) => {
  const { begintime, endtime } = dateRange(req);
  // Resolve devIdno from plate or direct devIdno
  const vehicles = await cms.getVehicles();
  const veh = vehicles.find(v =>
    v.plate === req.params.id || v.nm === req.params.id || v.devIdno === req.params.id
  );
  const devIdno = veh?.devIdno || req.params.id;
  // queryTrackDetail returns GPS track points with yl (fuel), sp (speed), lc (mileage)
  const tracks = await cms.getGPSHistory(devIdno, begintime, endtime);
  // Wrap in { infos: [...] } so normalizeFuelData in frontend recognises it
  ok(res, { infos: tracks }, { period: { begintime, endtime }, points: tracks.length });
});

// ══════════════════════════════════════════════════════════════════════════
//  CAMERAS & MEDIA
// ══════════════════════════════════════════════════════════════════════════

/** GET /api/cameras/:id/stream?channel=1&streamType=sub — Get live stream URL */
router.get('/cameras/:id/stream', async (req, res) => {
  const channel    = parseInt(req.query.channel) || 1;
  const streamType = req.query.streamType || 'sub';
  const data = await cms.getCameraStreamUrl(req.params.id, channel, streamType);
  ok(res, data);
});

/** POST /api/cameras/:id/snapshot?channel=1 — Trigger camera snapshot */
router.post('/cameras/:id/snapshot', async (req, res) => {
  const channel = parseInt(req.query.channel) || 1;
  const data = await cms.takeSnapshot(req.params.id, channel);
  ok(res, data);
});

/**
 * GET /api/cameras/:id/videos?begintime=...&endtime=...&videoType=all|alarm|regular
 */
router.get('/cameras/:id/videos', async (req, res) => {
  const { begintime, endtime } = dateRange(req);
  const videoType = req.query.videoType || 'all';
  const data = await cms.getRecordedVideos(req.params.id, begintime, endtime, videoType);
  ok(res, data, { count: data.length });
});

/** POST /api/cameras/:id/record?channel=0&sec=30 — Trigger real-time video recording */
router.post('/cameras/:id/record', async (req, res) => {
  const channel = req.query.channel ?? req.body?.channel ?? '0';
  const sec     = parseInt(req.query.sec || req.body?.sec || 30);
  const label   = req.query.label || req.body?.label || '';
  const data = await cms.requestRealtimeVideo(req.params.id, String(channel), sec, label);
  ok(res, data);
});

/** GET /api/cameras/:id/files?date=YYYY-MM-DD&channel=-1&rectype=-1 — Video files for a day */
router.get('/cameras/:id/files', async (req, res) => {
  const { channel = '-1', date, rectype = '-1', beg = 0, end = 86399, loc = 2 } = req.query;
  const [YEAR, MON, DAY] = (date || new Date().toISOString().slice(0, 10)).split('-');
  const data = await cms.getVideoFileInfo(req.params.id, {
    LOC: parseInt(loc), CHN: parseInt(channel), YEAR, MON, DAY,
    RECTYPE: parseInt(rectype), BEG: parseInt(beg), END: parseInt(end),
  });
  ok(res, data, { count: data.length });
});

/** GET /api/cameras/:id/history?beginDate=YYYY-MM-DD&endDate=YYYY-MM-DD&channel=-1 — Cross-day video */
router.get('/cameras/:id/history', async (req, res) => {
  const { beginDate, endDate, channel = '-1', loc = 2 } = req.query;
  if (!beginDate) return err(res, 'beginDate is required (YYYY-MM-DD)');
  const [YEAR, MON, DAY]    = beginDate.split('-');
  const [YEARE, MONE, DAYE] = (endDate || beginDate).split('-');
  const data = await cms.getVideoHistoryFile(req.params.id, {
    LOC: parseInt(loc), CHN: parseInt(channel), YEAR, MON, DAY, YEARE, MONE, DAYE,
  });
  ok(res, data, { count: data.length });
});

/** POST /api/cameras/:id/capture?channel=0&resolution=1 — Capture still image */
router.post('/cameras/:id/capture', async (req, res) => {
  const channel    = parseInt(req.query.channel    ?? req.body?.channel    ?? 0);
  const resolution = parseInt(req.query.resolution ?? req.body?.resolution ?? 1);
  const data = await cms.capturePicture(req.params.id, channel, resolution);
  ok(res, data);
});

/** GET /api/cameras/:id/downloads?begintime=...&endtime=... — Download task list */
router.get('/cameras/:id/downloads', async (req, res) => {
  const { begintime, endtime, status, page = 1, pageSize = 20 } = req.query;
  const data = await cms.getDownloadTasklist(req.params.id, {
    begintime, endtime,
    status: status != null ? parseInt(status) : undefined,
    page: parseInt(page), pageSize: parseInt(pageSize),
  });
  ok(res, data.infos || [], { pagination: data.pagination });
});

/** DELETE /api/cameras/:id/downloads?taskTag=... — Delete a download task */
router.delete('/cameras/:id/downloads', async (req, res) => {
  const { taskTag } = req.query;
  if (!taskTag) return err(res, 'taskTag is required');
  const data = await cms.deleteDownloadTask(req.params.id, taskTag);
  ok(res, data);
});

/**
 * POST /api/cameras/:id/download-task — Add a segment download task for a video file
 * Body: { fbtm, fetm, sbtm, setm, fph, len, chn, vtp?, lab?, dtp? }
 * (these fields come directly from the file info returned by /cameras/:id/files)
 */
router.post('/cameras/:id/download-task', async (req, res) => {
  const data = await cms.addDownloadTask(req.params.id, req.body);
  ok(res, data);
});

/**
 * GET /api/cameras/:id/snap-image?path=...&offset=...&length=...
 * Proxies a snap image download from the CMSV6 video server (port 6604).
 * path/offset/length come from the capturePicture response (FPATH, FOFFSET, FLENGTH).
 */
router.get('/cameras/:id/snap-image', async (req, res) => {
  const { path: fpath, offset = 0, length } = req.query;
  if (!fpath || !length) return err(res, 'path and length are required');

  const { jsession, cookie } = await cms.getSession();
  const videoBase = `${process.env.CMSV6_BASE_URL}:${process.env.CMSV6_VIDEO_PORT || 6604}`;
  const url = `${videoBase}/3/5?Type=3&FLENGTH=${length}&FOFFSET=${offset}&FPATH=${encodeURIComponent(fpath)}&MTYPE=1&DevIDNO=${req.params.id}&jsession=${jsession}`;

  const axios = require('axios');
  const response = await axios.get(url, {
    responseType: 'stream',
    headers: { Cookie: `JSESSIONID=${cookie}` },
  });
  res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
  res.setHeader('Content-Disposition', `inline; filename="${fpath}"`);
  response.data.pipe(res);
});

// ══════════════════════════════════════════════════════════════════════════
//  FTP UPLOAD MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/cameras/:id/ftp-upload — Trigger FTP upload from device
 * Body: { CHN, BEGYEAR, BEGMON, BEGDAY, BEGSEC, ENDYEAR, ENDMON, ENDDAY, ENDSEC, NETMASK }
 */
router.post('/cameras/:id/ftp-upload', async (req, res) => {
  const data = await cms.ftpUpload(req.params.id, req.body);
  ok(res, data);
});

/** GET /api/cameras/:id/ftp-status?seq=... — Check FTP task status */
router.get('/cameras/:id/ftp-status', async (req, res) => {
  const { seq } = req.query;
  if (!seq) return err(res, 'seq (task sequence number) is required');
  const data = await cms.getFtpStatus(parseInt(seq), req.params.id);
  ok(res, data.info || data);
});

/**
 * GET /api/cameras/:id/ftp-tasks?begintime=...&endtime=...&status=&page=1
 * List FTP upload tasks for a device
 */
router.get('/cameras/:id/ftp-tasks', async (req, res) => {
  const { begintime, endtime, status, page = 1, pageSize = 20 } = req.query;
  const data = await cms.getFtpTaskList(req.params.id, {
    begintime, endtime,
    status: status != null ? parseInt(status) : undefined,
    page: parseInt(page), pageSize: parseInt(pageSize),
  });
  ok(res, data.infos || [], { pagination: data.pagination });
});

/** POST /api/cameras/:id/ftp-control — Pause/resume/cancel an FTP task */
router.post('/cameras/:id/ftp-control', async (req, res) => {
  const seq      = parseInt(req.query.seq || req.body?.seq);
  const taskType = parseInt(req.query.taskType ?? req.body?.taskType ?? 2);
  if (!seq) return err(res, 'seq is required');
  const data = await cms.controlFtpTask(seq, req.params.id, taskType);
  ok(res, data);
});

// ══════════════════════════════════════════════════════════════════════════
//  ALARM EVIDENCE
// ══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/alarms/:id/evidence?begintime=...&alarmType=...&guid=...
 * Images + videos attached to a specific alarm event
 */
router.get('/alarms/:id/evidence', async (req, res) => {
  const { begintime, alarmType, guid } = req.query;
  if (!begintime || !alarmType || !guid) return err(res, 'begintime, alarmType and guid are required');
  const data = await cms.getAlarmEvidence(req.params.id, { begintime, alarmType, guid });
  ok(res, data);
});

/**
 * GET /api/alarms/security-evidence?vehiIdno=...&begintime=...&endtime=...&alarmType=...
 * Safety alarm photo/video evidence list
 */
router.get('/alarms/security-evidence', async (req, res) => {
  const { vehiIdno, begintime, endtime, alarmType, mediaType, page = 1, pageSize = 20 } = req.query;
  if (!vehiIdno || !begintime || !endtime || !alarmType) return err(res, 'vehiIdno, begintime, endtime and alarmType are required');
  const data = await cms.getSecurityEvidence({
    vehiIdno, begintime, endtime, alarmType,
    mediaType: mediaType != null ? parseInt(mediaType) : undefined,
    page: parseInt(page), pageSize: parseInt(pageSize),
  });
  ok(res, data.infos || [], { pagination: data.pagination });
});

// ══════════════════════════════════════════════════════════════════════════
//  MEDIA LIBRARY (server-stored photos & videos)
// ══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/media/photos?devIdno=&begintime=&endtime=&filetype=&alarmType=
 */
router.get('/media/photos', async (req, res) => {
  const { devIdno, begintime, endtime, filetype, alarmType, page = 1, pageSize = 20 } = req.query;
  if (!begintime || !endtime) return err(res, 'begintime and endtime are required');
  const data = await cms.queryPhotos({
    devIdno, begintime, endtime,
    filetype: filetype != null ? parseInt(filetype) : undefined,
    alarmType, page: parseInt(page), pageSize: parseInt(pageSize),
  });
  ok(res, data.infos || [], { pagination: data.pagination });
});

/**
 * GET /api/media/videos?devIdno=&begintime=&endtime=&type=1&filetype=
 */
router.get('/media/videos', async (req, res) => {
  const { devIdno, begintime, endtime, type = 1, filetype, alarmType, page = 1, pageSize = 20 } = req.query;
  if (!devIdno || !begintime || !endtime) return err(res, 'devIdno, begintime and endtime are required');
  const data = await cms.queryAudioOrVideo(devIdno, {
    begintime, endtime, type: parseInt(type),
    filetype: filetype != null ? parseInt(filetype) : undefined,
    alarmType, page: parseInt(page), pageSize: parseInt(pageSize),
  });
  ok(res, data.infos || [], { pagination: data.pagination });
});

// ══════════════════════════════════════════════════════════════════════════
//  ALARMS
// ══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/alarms?devIdno=&begintime=&endtime=&alarmType=&page=1&pageSize=100
 */
router.get('/alarms', async (req, res) => {
  const { begintime, endtime } = dateRange(req);
  const { devIdno = '', alarmType = '', page = 1, pageSize = 100 } = req.query;
  const data = await cms.getAlarms({
    devIdno, begintime, endtime, alarmType,
    page: parseInt(page), pageSize: parseInt(pageSize),
  });
  ok(res, data.alarms || [], { total: data.total || 0 });
});

/** GET /api/alarms/types — List all alarm type codes */
router.get('/alarms/types', (req, res) => {
  const types = Object.entries(cms.ALARM_TYPES).map(([code, name]) => ({
    code: parseInt(code), name,
  }));
  ok(res, types);
});

// ══════════════════════════════════════════════════════════════════════════
//  REPORTS
// ══════════════════════════════════════════════════════════════════════════

/** POST /api/fleet/report/trigger — Manually trigger the hourly report (sends SMS) */
router.post('/fleet/report/trigger', async (req, res) => {
  const { sendSms = false } = req.body;
  hourlyReport.sendReport(sendSms, true); // sendSms from body, manual=true
  ok(res, { message: 'Manual report dispatch triggered' });
});

/** GET /api/fleet/report/trigger — Documentation alias/test */
router.get('/fleet/report/trigger', async (req, res) => {
  ok(res, { message: 'To trigger a report, use POST to this endpoint' });
});

/** GET /api/reports/mileage/:id?begintime=...&endtime=... */
router.get('/reports/mileage/:id', async (req, res) => {
  const { begintime, endtime } = dateRange(req);
  const data = await cms.getMileageReport(req.params.id, begintime, endtime);
  ok(res, data, { period: { begintime, endtime } });
});

/**
 * GET /api/reports/trips/:id?begintime=...&endtime=...&byOil=0
 * Trip-by-trip mileage + fuel details (getOilTrackDetail)
 * byOil=1 → fuel volume details report, byOil=0 → mileage details report
 */
router.get('/reports/trips/:id', async (req, res) => {
  const { begintime, endtime } = dateRange(req);
  const byOil    = parseInt(req.query.byOil) || 0;
  const page     = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 50;
  const data = await cms.getMileageDetails(req.params.id, begintime, endtime, { page, pageSize, byOil });
  ok(res, data.infos || [], { period: { begintime, endtime }, pagination: data.pagination });
});

/** GET /api/reports/uptime/:id?begintime=...&endtime=... */
router.get('/reports/uptime/:id', async (req, res) => {
  const { begintime, endtime } = dateRange(req);
  const data = await cms.getUptimeReport(req.params.id, begintime, endtime);
  ok(res, data, { count: data.length });
});

/** GET /api/reports/behaviour/:id?begintime=...&endtime=... */
router.get('/reports/behaviour/:id', async (req, res) => {
  const { begintime, endtime } = dateRange(req);
  const data = await cms.getDrivingBehaviour(req.params.id, begintime, endtime);
  ok(res, data);
});

/**
 * GET /api/reports/parking/:id?begintime=...&endtime=...&parkTime=60
 * All parking events for a vehicle. parkTime = minimum seconds to count as a stop.
 */
router.get('/reports/parking/:id', async (req, res) => {
  const { begintime, endtime } = dateRange(req);
  const parkTime = parseInt(req.query.parkTime) || 60;
  const page     = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 50;
  const data = await cms.getParkingDetail(req.params.id, begintime, endtime, { page, pageSize, parkTime });
  ok(res, data.infos || [], { period: { begintime, endtime }, pagination: data.pagination });
});

// ══════════════════════════════════════════════════════════════════════════
//  GEOFENCE / ACCESS AREA
// ══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/geofence/access?vehiIdno=PLATE&begintime=...&endtime=...
 * Returns vehicle entry/exit events for custom geofence areas.
 * passType: 1 = entered area, 2 = exited area
 */
router.get('/geofence/access', async (req, res) => {
  const { vehiIdno } = req.query;
  if (!vehiIdno) return err(res, 'vehiIdno (plate number) is required');
  const { begintime, endtime } = dateRange(req);
  const page     = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 50;
  const data = await cms.getAccessAreaInfo(vehiIdno, begintime, endtime, { page, pageSize });
  ok(res, data.infos || [], { period: { begintime, endtime }, pagination: data.pagination });
});

// ══════════════════════════════════════════════════════════════════════════
//  LINKAGE RULES
// ══════════════════════════════════════════════════════════════════════════

/** GET /api/rules — List linkage alarm rules */
router.get('/rules', async (req, res) => {
  const { name, alarmType, page = 1, pageSize = 50 } = req.query;
  const data = await cms.getLinkageRules({ name, alarmType, page: parseInt(page), pageSize: parseInt(pageSize) });
  ok(res, data.infos || [], { pagination: data.pagination });
});

/** POST /api/rules — Create a linkage alarm rule */
router.post('/rules', async (req, res) => {
  const data = await cms.createLinkageRule(req.body);
  ok(res, data);
});

/** PUT /api/rules/:id — Edit a linkage alarm rule */
router.put('/rules/:id', async (req, res) => {
  const data = await cms.editLinkageRule(parseInt(req.params.id), req.body);
  ok(res, data);
});

/** DELETE /api/rules/:id — Delete a linkage alarm rule */
router.delete('/rules/:id', async (req, res) => {
  const data = await cms.deleteLinkageRule(parseInt(req.params.id));
  ok(res, data);
});

/** GET /api/rules/:id/devices — Devices associated with a rule */
router.get('/rules/:id/devices', async (req, res) => {
  const data = await cms.getRuleDevices(parseInt(req.params.id));
  ok(res, data.infos || [], { pagination: data.pagination });
});

/** POST /api/rules/:id/devices — Assign rule to device(s) */
router.post('/rules/:id/devices', async (req, res) => {
  const { devIdno } = req.body;
  if (!devIdno) return err(res, 'devIdno is required');
  const data = await cms.assignRuleToDevice(parseInt(req.params.id), devIdno);
  ok(res, data);
});

/** DELETE /api/rules/:id/devices — Remove device from rule */
router.delete('/rules/:id/devices', async (req, res) => {
  const { devIdno } = req.query;
  if (!devIdno) return err(res, 'devIdno is required');
  const data = await cms.deleteRuleDevice(devIdno, { ruleId: parseInt(req.params.id) });
  ok(res, data);
});

// ══════════════════════════════════════════════════════════════════════════
//  VEHICLE CONTROL
// ══════════════════════════════════════════════════════════════════════════

/** POST /api/vehicles/:id/control — Send control command to vehicle */
router.post('/vehicles/:id/control', async (req, res) => {
  const { ctrlType } = req.body;
  if (ctrlType == null) return err(res, 'ctrlType is required');
  const data = await cms.vehicleControl(req.params.id, parseInt(ctrlType));
  ok(res, data);
});

/** POST /api/vehicles/:id/tts — Send TTS voice message */
router.post('/vehicles/:id/tts', async (req, res) => {
  const { text, flag = 4 } = req.body;
  if (!text) return err(res, 'text is required');
  const data = await cms.sendTTS(req.params.id, text, parseInt(flag));
  ok(res, data);
});

/** POST /api/vehicles/:id/ptz — PTZ camera control */
router.post('/vehicles/:id/ptz', async (req, res) => {
  const { channel = 0, command = 19, speed = 1, param = 0 } = req.body;
  const data = await cms.sendPTZControl(req.params.id, parseInt(channel), parseInt(command), parseInt(speed), parseInt(param));
  ok(res, data);
});

/** POST /api/vehicles/:id/gps-interval — Set GPS reporting interval */
router.post('/vehicles/:id/gps-interval', async (req, res) => {
  const { time = 5 } = req.body;
  const data = await cms.setGPSInterval(req.params.id, parseInt(time));
  ok(res, data);
});

// ══════════════════════════════════════════════════════════════════════════
//  DEVICE MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════

/** GET /api/devices/:id/info — Device hardware info (online only) */
router.get('/devices/:id/info', async (req, res) => {
  const data = await cms.getDeviceInfo(req.params.id);
  if (!data) return err(res, 'Device offline or not found', 404);
  ok(res, data);
});

/** POST /api/devices — Add a new device */
router.post('/devices', async (req, res) => {
  const data = await cms.addDevice(req.body);
  ok(res, data);
});

/** PUT /api/devices/:id — Edit device */
router.put('/devices/:id', async (req, res) => {
  const data = await cms.editDevice(req.params.id, req.body);
  ok(res, data);
});

/** DELETE /api/devices/:id — Delete device */
router.delete('/devices/:id', async (req, res) => {
  const data = await cms.deleteDevice(req.params.id);
  ok(res, data);
});

/** POST /api/vehicles — Add a new vehicle */
router.post('/vehicles', async (req, res) => {
  const data = await cms.addVehicle(req.body);
  ok(res, data);
});

/** DELETE /api/vehicles/:id — Delete vehicle */
router.delete('/vehicles/:id', async (req, res) => {
  const { delDevice = 0 } = req.query;
  const data = await cms.deleteVehicle(req.params.id, parseInt(delDevice));
  ok(res, data);
});

/** POST /api/vehicles/:id/install — Install device to vehicle */
router.post('/vehicles/:id/install', async (req, res) => {
  const { devIdno } = req.body;
  if (!devIdno) return err(res, 'devIdno is required');
  const data = await cms.installDevice(req.params.id, devIdno);
  ok(res, data);
});

/** POST /api/vehicles/:id/uninstall — Uninstall device from vehicle */
router.post('/vehicles/:id/uninstall', async (req, res) => {
  const { devIdno } = req.body;
  if (!devIdno) return err(res, 'devIdno is required');
  const data = await cms.uninstallDevice(req.params.id, devIdno);
  ok(res, data);
});

// ── Traffic Card Management ──────────────────────────────────────────────

/** GET /api/traffic/:devIdno — Traffic flow info for a device */
router.get('/traffic/:devIdno', async (req, res) => {
  const data = await cms.getFlowInfo(req.params.devIdno);
  ok(res, data);
});

/** POST /api/traffic/:devIdno — Save traffic flow config */
router.post('/traffic/:devIdno', async (req, res) => {
  const data = await cms.saveFlowConfig(req.params.devIdno, req.body);
  ok(res, data);
});

// ── Area / Marker Management ─────────────────────────────────────────────

/** GET /api/markers — Get all user map markers (graceful — returns empty list if endpoint unavailable) */
router.get('/markers', async (req, res) => {
  try {
    const data = await cms.getUserMarkers();
    // CMSV6 may return result != 0 if the marker endpoint is not available for this account
    if (data?.result === 0 || Array.isArray(data?.list) || Array.isArray(data)) {
      ok(res, data);
    } else {
      // Endpoint exists but returned an error — return empty gracefully
      ok(res, { list: [], total: 0 });
    }
  } catch (e) {
    logger.warn('[Markers] getUserMarkers failed (non-fatal): ' + e.message);
    ok(res, { list: [], total: 0 });
  }
});

/** POST /api/markers — Add a new map marker */
router.post('/markers', async (req, res) => {
  const data = await cms.addMark(req.body);
  ok(res, data);
});

/** PUT /api/markers/:id — Edit a map marker */
router.put('/markers/:id', async (req, res) => {
  const data = await cms.editMark({ markId: req.params.id, ...req.body });
  ok(res, data);
});

/** GET /api/markers/:id — Get single marker */
router.get('/markers/:id', async (req, res) => {
  const data = await cms.findMark(req.params.id);
  ok(res, data);
});

/** DELETE /api/markers/:id — Delete a map marker */
router.delete('/markers/:id', async (req, res) => {
  const data = await cms.deleteMark(req.params.id);
  ok(res, data);
});

// ── Organization Management ──────────────────────────────────────────────

/** GET /api/orgs — List organizations */
router.get('/orgs', async (req, res) => {
  const data = await cms.findCompany(req.query);
  // CMSV6 returns infos[{id, name, code, linkMan, linkPhone, address}]
  const list = Array.isArray(data?.infos) ? data.infos.map(c => ({
    companyId:    c.id,
    companyName:  c.name,
    companyCode:  c.code   || '',
    contactName:  c.linkMan   || '',
    contactPhone: c.linkPhone || '',
    address:      c.address   || '',
    level:        c.level,
  })) : [];
  ok(res, list);
});

/** POST /api/orgs — Create organization */
router.post('/orgs', async (req, res) => {
  const data = await cms.mergeCompany(req.body);
  ok(res, data);
});

/** PUT /api/orgs/:id — Edit organization */
router.put('/orgs/:id', async (req, res) => {
  const data = await cms.mergeCompany({ companyId: req.params.id, ...req.body });
  ok(res, data);
});

/** DELETE /api/orgs/:id — Delete organization */
router.delete('/orgs/:id', async (req, res) => {
  const data = await cms.deleteCompany(req.params.id);
  ok(res, data);
});

// ── Role Management ──────────────────────────────────────────────────────

/** GET /api/roles — List roles */
router.get('/roles', async (req, res) => {
  const data = await cms.findUserRole(req.query);
  // CMSV6 returns role[{id, name}] — note: array key is "role" not "infos"
  const list = Array.isArray(data?.role) ? data.role.map(r => ({
    roleId:   r.id,
    roleName: r.name,
  })) : [];
  ok(res, list);
});

/** POST /api/roles — Create role */
router.post('/roles', async (req, res) => {
  const data = await cms.mergeUserRole(req.body);
  ok(res, data);
});

/** PUT /api/roles/:id — Edit role */
router.put('/roles/:id', async (req, res) => {
  const data = await cms.mergeUserRole({ roleId: req.params.id, ...req.body });
  ok(res, data);
});

/** DELETE /api/roles/:id — Delete role */
router.delete('/roles/:id', async (req, res) => {
  const data = await cms.deleteUserRole(req.params.id);
  ok(res, data);
});

// ── User Management ──────────────────────────────────────────────────────

/** GET /api/users — List user accounts */
router.get('/users', async (req, res) => {
  const data = await cms.findUserAccount(req.query);
  // CMSV6 returns infos[{id, nm, act, vld, pid, pnm}]
  const list = Array.isArray(data?.infos) ? data.infos.map(u => ({
    userId:      u.id,
    loginName:   u.act,   // act = login/account name
    userName:    u.nm,    // nm  = display name
    companyId:   u.pid,
    companyName: u.pnm,
    valid:       u.vld,
  })) : [];
  ok(res, list, { pagination: data?.pagination });
});

/** POST /api/users — Create user account */
router.post('/users', async (req, res) => {
  const data = await cms.mergeUserAccount(req.body);
  ok(res, data);
});

/** PUT /api/users/:id — Edit user account */
router.put('/users/:id', async (req, res) => {
  const data = await cms.mergeUserAccount({ userId: req.params.id, ...req.body });
  ok(res, data);
});

/** DELETE /api/users/:id — Delete user account */
router.delete('/users/:id', async (req, res) => {
  const data = await cms.deleteUserAccount(req.params.id);
  ok(res, data);
});

/** GET /api/users/:id/devices — Get device auth list for a user */
router.get('/users/:id/devices', async (req, res) => {
  const data = await cms.getUserDeviceAuth(req.params.id);
  ok(res, data);
});

/** POST /api/users/:id/devices — Authorize device for user */
router.post('/users/:id/devices', async (req, res) => {
  const { devIdno, authType = 1 } = req.body;
  if (!devIdno) return err(res, 'devIdno is required');
  const data = await cms.setUserDeviceAuth(req.params.id, devIdno, authType);
  ok(res, data);
});

// ── Driver Management ────────────────────────────────────────────────────

/** GET /api/drivers/device/:devIdno — Driver info by device */
router.get('/drivers/device/:devIdno', async (req, res) => {
  const data = await cms.findDriverInfoByDeviceId(req.params.devIdno);
  ok(res, data);
});

/** GET /api/drivers/vehicle/:devIdno — Vehicle info by device */
router.get('/drivers/vehicle/:devIdno', async (req, res) => {
  const data = await cms.findVehicleInfoByDeviceId(req.params.devIdno);
  ok(res, data);
});

/** GET /api/drivers/punchcard/:devIdno — Punch card records */
router.get('/drivers/punchcard/:devIdno', async (req, res) => {
  const data = await cms.queryPunchCardRecord(req.params.devIdno, req.query);
  ok(res, data);
});

/** GET /api/drivers/alarms/:devIdno — Identity alarm records */
router.get('/drivers/alarms/:devIdno', async (req, res) => {
  const data = await cms.queryIdentifyAlarm(req.params.devIdno, req.query);
  ok(res, data);
});

// ── Driver CRUD ──────────────────────────────────────────────────────────

/** GET /api/drivers — Query driver list. ?dName=search */
router.get('/drivers', async (req, res) => {
  const data = await cms.queryDriverList(req.query);
  ok(res, Array.isArray(data?.infos) ? data.infos : data);
});

/** POST /api/drivers — Add a new driver */
router.post('/drivers', async (req, res) => {
  const data = await cms.mergeDriver(req.body);
  ok(res, data);
});

/** GET /api/drivers/:id — Load single driver */
router.get('/drivers/:id', async (req, res) => {
  const data = await cms.loadDriver(req.params.id);
  ok(res, data?.driver || data);
});

/** PUT /api/drivers/:id — Edit driver */
router.put('/drivers/:id', async (req, res) => {
  const data = await cms.mergeDriver({ id: req.params.id, ...req.body });
  ok(res, data);
});

/** DELETE /api/drivers/:id — Delete driver(s). id can be comma-separated */
router.delete('/drivers/:id', async (req, res) => {
  const data = await cms.deleteDriver(req.params.id);
  ok(res, data);
});

// ── SIM Management ───────────────────────────────────────────────────────

/** GET /api/sims — Query SIM list */
router.get('/sims', async (req, res) => {
  const data = await cms.loadSIMInfos(req.query);
  ok(res, data);
});

/** POST /api/sims — Add a SIM */
router.post('/sims', async (req, res) => {
  const data = await cms.mergeSIMInfo(req.body);
  ok(res, data);
});

/** GET /api/sims/:id — Find single SIM */
router.get('/sims/:id', async (req, res) => {
  const data = await cms.findSIMInfo(req.params.id);
  ok(res, data?.sim || data);
});

/** PUT /api/sims/:id — Edit SIM */
router.put('/sims/:id', async (req, res) => {
  const data = await cms.mergeSIMInfo({ id: req.params.id, ...req.body });
  ok(res, data);
});

/** DELETE /api/sims/:id — Delete SIM */
router.delete('/sims/:id', async (req, res) => {
  const data = await cms.deleteSIMInfo(req.params.id);
  ok(res, data);
});

/** POST /api/sims/:id/unbind — Unbind SIM from device */
router.post('/sims/:id/unbind', async (req, res) => {
  const { flag = 0 } = req.body;
  const data = await cms.unbindingSIM(req.params.id, flag);
  ok(res, data);
});

// ── Geofence Area Management ──────────────────────────────────────────────

/** GET /api/areas — List geofence areas (graceful if CMSV6 endpoint unavailable) */
router.get('/areas', async (req, res) => {
  try {
    const data = await cms.queryArea(req.query);
    const list = Array.isArray(data?.infos) ? data.infos
               : Array.isArray(data?.list)  ? data.list
               : Array.isArray(data)        ? data : [];
    ok(res, list, { count: list.length });
  } catch (e) {
    logger.warn('[Areas] queryArea not supported on this CMSV6 version: ' + e.message);
    ok(res, [], { count: 0, note: 'Area management not available on this server' });
  }
});

/** POST /api/areas — Create a geofence area
 *  Body: { name, type:1|2, lat?, lng?, radius?, points?:[{lat,lng}], speed?, alertIn?, alertOut? } */
router.post('/areas', async (req, res) => {
  const { name, type = 1, lat, lng, radius, points, speed = 0, alertIn = 1, alertOut = 1 } = req.body;
  if (!name) return err(res, 'name is required');
  try {
    const data = await cms.mergeArea({ areaName: name, areaType: type, lat, lng, radius, points, speed, alertIn, alertOut });
    ok(res, data);
  } catch (e) { err(res, `CMSV6 area create failed: ${e.message}`); }
});

/** PUT /api/areas/:id — Update a geofence area */
router.put('/areas/:id', async (req, res) => {
  const { name, type = 1, lat, lng, radius, points, speed = 0 } = req.body;
  const data = await cms.mergeArea({ areaId: parseInt(req.params.id), areaName: name, areaType: type, lat, lng, radius, points, speed });
  ok(res, data);
});

/** DELETE /api/areas/:id — Delete area(s) */
router.delete('/areas/:id', async (req, res) => {
  const data = await cms.deleteArea(req.params.id);
  ok(res, data);
});

/** POST /api/areas/:id/bind — Bind area to vehicle */
router.post('/areas/:id/bind', async (req, res) => {
  const { devIdno, alertIn = 1, alertOut = 1, speedIn = 0 } = req.body;
  if (!devIdno) return err(res, 'devIdno is required');
  const data = await cms.bindAreaToVehicle({ areaId: parseInt(req.params.id), devIdno, alertIn, alertOut, speedIn });
  ok(res, data);
});

/** GET /api/areas/:id/vehicles — Vehicles bound to an area */
router.get('/areas/:id/vehicles', async (req, res) => {
  const data = await cms.queryAreaVehicles(parseInt(req.params.id));
  const list = Array.isArray(data?.infos) ? data.infos : Array.isArray(data?.list) ? data.list : [];
  ok(res, list);
});

// ── Route Management ──────────────────────────────────────────────────────

/** GET /api/routes — List planned routes (graceful if CMSV6 endpoint unavailable) */
router.get('/routes', async (req, res) => {
  try {
    const data = await cms.queryRoute(req.query);
    const list = Array.isArray(data?.infos) ? data.infos
               : Array.isArray(data?.list)  ? data.list
               : Array.isArray(data)        ? data : [];
    ok(res, list, { count: list.length });
  } catch (e) {
    logger.warn('[Routes] queryRoute not supported on this CMSV6 version: ' + e.message);
    ok(res, [], { count: 0, note: 'Route management not available on this server' });
  }
});

/** POST /api/routes — Create a route
 *  Body: { name, points:[{lat,lng,radius?,minTime?,maxTime?}] } */
router.post('/routes', async (req, res) => {
  const { name, points = [] } = req.body;
  if (!name) return err(res, 'name is required');
  if (points.length < 2) return err(res, 'At least 2 waypoints required');
  try {
    const data = await cms.mergeRoute({ routeName: name, points });
    ok(res, data);
  } catch (e) { err(res, `CMSV6 route create failed: ${e.message}`); }
});

/** PUT /api/routes/:id — Update route */
router.put('/routes/:id', async (req, res) => {
  const { name, points } = req.body;
  const data = await cms.mergeRoute({ routeId: parseInt(req.params.id), routeName: name, points });
  ok(res, data);
});

/** DELETE /api/routes/:id — Delete route */
router.delete('/routes/:id', async (req, res) => {
  const data = await cms.deleteRoute(parseInt(req.params.id));
  ok(res, data);
});

/** POST /api/routes/:id/bind — Assign route to vehicle */
router.post('/routes/:id/bind', async (req, res) => {
  const { devIdno, alertDeviation = 1 } = req.body;
  if (!devIdno) return err(res, 'devIdno is required');
  const data = await cms.bindRoute({ routeId: parseInt(req.params.id), devIdno, alertDeviation });
  ok(res, data);
});

// ── Passenger Reports ────────────────────────────────────────────────────

/** GET /api/reports/passengers/summary — Passenger summary
 *  ?begintime=2024-01-01 00:00:00&endtime=2024-01-01 23:59:59&vehiIdnos=plate1,plate2
 */
router.get('/reports/passengers/summary', async (req, res) => {
  if (!req.query.begintime || !req.query.endtime) return err(res, 'begintime and endtime required');
  const data = await cms.getPassengerSummary(req.query);
  ok(res, data);
});

/** GET /api/reports/passengers/detail — Passenger detail */
router.get('/reports/passengers/detail', async (req, res) => {
  if (!req.query.begintime || !req.query.endtime) return err(res, 'begintime and endtime required');
  const data = await cms.getPassengerDetail(req.query);
  ok(res, data);
});

module.exports = router;
