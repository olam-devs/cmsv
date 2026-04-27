require('dotenv').config();
require('express-async-errors');

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const logger     = require('./utils/logger');
const auth       = require('./utils/auth');
const fleetRoutes = require('./routes/index');
const chatRoute   = require('./routes/chat');
const eventsRoute    = require('./routes/events');
const erp2Routes      = require('./routes/erp2');
const authRoutes      = require('./routes/auth');
const adminUsersRoutes= require('./routes/admin-users');
const monitor        = require('./services/monitor.service');
const hourlyReport   = require('./services/hourly-report.service');
const path           = require('path');
const fs             = require('fs');
const http           = require('http');
const users          = require('./services/users.service');

const net  = require('net');
const app  = express();
const PORT = process.env.PORT || 3000;

// ── Bootstrap default admin if empty user store ───────────────────────────
try { users.ensureDefaultAdmin(); } catch (_) {}

// ── Derive CMSV6 host/port for CSP (must match env, not hardcoded) ────────
const cmsVideoHost = (process.env.CMSV6_BASE_URL || 'http://13.53.215.88').replace(/^https?:\/\//, '').split(':')[0];
const cmsVideoPort = process.env.CMSV6_VIDEO_PORT || 6604;

// ── Security & middleware ──────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", 'https:', "'unsafe-inline'"],
      fontSrc:     ["'self'", 'https:', 'data:'],
      imgSrc:      ["'self'", 'data:'],
      // Allow Nominatim for reverse geocoding (location names on map)
      connectSrc:  ["'self'", 'https://nominatim.openstreetmap.org'],
      // Allow CMSV6 video player iframe — derived from env at startup
      frameSrc:    ["'self'", `http://${cmsVideoHost}`, `http://${cmsVideoHost}:${cmsVideoPort}`],
      workerSrc:   ["'self'", 'blob:'],
      objectSrc:   ["'none'"],
      // Note: upgrade-insecure-requests is intentionally omitted —
      // the CMSV6 video server is HTTP-only and must not be upgraded to HTTPS.
    },
  },
}));
app.use(cors());
// Default express.json limit is ~100kb — bulk CSV → JSON imports need more headroom
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '20mb' }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// ── Frontend dist path (static is registered after all /api routes below) ───
const distPath = path.join(__dirname, '../../frontend/dist');

// ── CMSV6 player proxy — serves the HTTP player page from our HTTPS origin ───
// Rewrites all http://cmsHost URLs inside HTML/JS responses to go through
// /api/video/static (web port) and /api/video/stream (port 6604) proxies,
// so the browser never makes direct HTTP requests from an HTTPS page.

// Returns just the hostname from CMSV6_BASE_URL (strips scheme and port).
function getCmsHost() {
  return (process.env.CMSV6_BASE_URL || 'http://13.53.215.88')
    .replace(/^https?:\/\//, '').split(':')[0];
}

// Returns the web port from CMSV6_BASE_URL (e.g. 8080 for http://127.0.0.1:8080).
function getCmsWebPort() {
  const base = process.env.CMSV6_BASE_URL || 'http://13.53.215.88';
  const m = base.match(/:(\d+)(?:\/|$)/);
  return m ? parseInt(m[1]) : 80;
}

function rewriteCmsUrls(body, cmsHost) {
  const escaped = cmsHost.replace(/\./g, '\\.');
  return body
    // Port 6604: match any host — CMSV6 embeds public IP in player HTML regardless of request host
    .replace(/(?:https?|wss?|ws):\/\/[^/"'\s:]+:6604/gi, '/api/video/stream')
    // Absolute CMSV6 resource paths — <base href> only rewrites relative paths, not these
    .replace(/(["'(=\s])\/808gps\//g, '$1/api/video/static/808gps/')
    .replace(/(["'(=\s])\/js\//g, '$1/api/video/static/js/')
    // Full http://host URLs to CMSV6
    .replace(new RegExp(`https?://${escaped}(?::\\d+)?(?=[/:])`, 'gi'), '/api/video/static');
}

function cmsHttpProxy(port, pathPrefix, { streamMode = false } = {}) {
  return (req, res) => {
    const cmsHost = getCmsHost();
    const urlPath = req.url.replace(pathPrefix, '') || '/';
    const opts = {
      hostname: cmsHost, port,
      path: urlPath, method: 'GET',
      headers: { 'User-Agent': 'StarLink-Fleet/1.0', host: cmsHost },
      // No timeout for live video streams — FLV is a long-running HTTP response
      ...(streamMode ? {} : { timeout: 15000 }),
    };
    const pr = http.request(opts, proxyRes => {
      const ct = proxyRes.headers['content-type'] || '';
      const isText = /text|javascript|json/.test(ct);
      const h = { ...proxyRes.headers };
      // Strip headers that block iframe embedding
      delete h['x-frame-options']; delete h['content-security-policy'];
      delete h['x-xss-protection']; delete h['strict-transport-security'];
      if (isText) {
        const chunks = [];
        proxyRes.on('data', c => chunks.push(c));
        proxyRes.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          // Only rewrite URLs in HTML — JS/JSON already load via /api/video/static and
          // rewriting them causes double-rewrite bugs in dynamically-loaded scripts
          const body = /text\/html/.test(ct) ? rewriteCmsUrls(raw, cmsHost) : raw;
          delete h['content-length'];
          res.writeHead(proxyRes.statusCode || 200, h);
          res.end(body);
        });
      } else {
        res.writeHead(proxyRes.statusCode || 200, h);
        proxyRes.pipe(res);
      }
    });
    pr.on('error', () => { if (!res.headersSent) res.status(502).end(); });
    pr.end();
  };
}

/** GET /api/video/player — Proxy CMSV6 channel=6 player page at same origin */
app.get('/api/video/player', (req, res) => {
  const { devIdno, channel = 6, stream = 1, jsession } = req.query;
  const cmsHost = getCmsHost();
  const playerPath = `/808gps/open/player/video.html?lang=en&devIdno=${devIdno}&channel=${channel}&stream=${stream}&jsession=${jsession}`;
  const opts = {
    hostname: cmsHost, port: getCmsWebPort(),
    path: playerPath, method: 'GET',
    headers: { 'User-Agent': 'StarLink-Fleet/1.0', host: cmsHost },
    timeout: 10000,
  };
  const pr = http.request(opts, proxyRes => {
    const chunks = [];
    proxyRes.on('data', c => chunks.push(c));
    proxyRes.on('end', () => {
      let body = Buffer.concat(chunks).toString('utf8');
      body = rewriteCmsUrls(body, cmsHost);
      // Intercept dynamic WebSocket/fetch/XHR calls that Jessibuca builds at runtime.
      // Matches any host on port 6604 — CMSV6 may embed the public IP, not 127.0.0.1.
      const intercept = `<script>
(function(){
  var _wsRe   = /wss?:\/\/[^/"'\s:]+:6604/g;
  var _httpRe = /https?:\/\/[^/"'\s:]+:6604/g;
  var _wsBase   = (location.protocol==='https:'?'wss':'ws')+'://'+location.host+'/api/video/stream';
  var _httpBase = location.origin+'/api/video/stream';
  var _WS = window.WebSocket;
  window.WebSocket = function(u,p){
    if(typeof u==='string'){ u=u.replace(_wsRe,_wsBase).replace(_httpRe,_wsBase); }
    return new _WS(u,p);
  };
  window.WebSocket.prototype = _WS.prototype;
  var _fetch = window.fetch;
  window.fetch = function(u,o){ if(typeof u==='string') u=u.replace(_httpRe,_httpBase); return _fetch(u,o); };
  var _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m,u){ if(typeof u==='string') u=u.replace(_httpRe,_httpBase); return _open.call(this,m,u); };
})();
</script>`;
      // Inject base + intercept before any other scripts so Jessibuca picks it up
      body = body.replace(/<head>/i, `<head><base href="/api/video/static/808gps/open/player/">${intercept}`);
      res.set('Content-Type', 'text/html');
      // Permissive CSP for this iframe — Jessibuca's asm.js decoder requires unsafe-eval
      res.set('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:");
      res.send(body);
    });
  });
  pr.on('error', e => res.status(502).send(`<!-- proxy error: ${e.message} -->`));
  pr.end();
});

/** /api/video/static/* — Proxy CMSV6 web port resources (JS, CSS, images) */
app.use('/api/video/static', cmsHttpProxy(getCmsWebPort(), '/api/video/static'));

/** /api/video/stream/* — Proxy port-6604 video streams (FLV/HLS); streamMode disables timeout */
app.use('/api/video/stream', cmsHttpProxy(6604, '/api/video/stream', { streamMode: true }));

// ── HLS video stream proxy (before auth/rate-limiter — jsession in query param) ──
// Proxies CMSV6 HTTP video streams so they work on the HTTPS production site.
app.get('/api/video/hls', async (req, res) => {
  try {
    const { devIdno, channel, stream, jsession } = req.query;
    const host = getCmsHost();
    const port = process.env.CMSV6_VIDEO_PORT || 6604;
    // CMSV6 HLS uses 0-based channel index in the stream filename
    const ch0 = Math.max(0, parseInt(channel || 1) - 1);
    const m3u8Url = `http://${host}:${port}/hls/1_${devIdno}_${ch0}_${stream}.m3u8?jsession=${jsession}`;
    const r = await fetch(m3u8Url);
    if (!r.ok) return res.status(r.status).end();
    const text = await r.text();
    const baseUrl = `http://${host}:${port}/hls/`;
    // Rewrite segment paths to go through our segment proxy
    const rewritten = text.split('\n').map(line => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return line;
      const segUrl = t.startsWith('http') ? t : baseUrl + t;
      return `/api/video/segment?url=${encodeURIComponent(segUrl)}`;
    }).join('\n');
    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.set('Cache-Control', 'no-cache');
    res.send(rewritten);
  } catch (e) { res.status(502).end(); }
});

app.get('/api/video/segment', async (req, res) => {
  try {
    const url = decodeURIComponent(req.query.url || '');
    const host = getCmsHost();
    if (!url.includes(host)) return res.status(403).end();
    const r = await fetch(url);
    if (!r.ok) return res.status(r.status).end();
    res.set('Content-Type', 'video/mp2t');
    res.set('Cache-Control', 'no-cache');
    const buf = await r.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (e) { res.status(502).end(); }
});

// ── CMSV6 internal API proxy (before auth — player iframe calls these from our origin) ──
// The CMSV6 player page makes requests to /api/config/... and similar paths.
// Since the player loads from heliontracking.com, those hit our server — proxy them to CMSV6.
app.use('/api/config', (req, res) => {
  const cmsHost = getCmsHost();
  const pr = http.request({
    hostname: cmsHost, port: getCmsWebPort(),
    path: '/api/config' + req.url, method: req.method,
    headers: { ...req.headers, host: cmsHost },
    timeout: 10000,
  }, proxyRes => {
    const h = { ...proxyRes.headers };
    delete h['x-frame-options']; delete h['content-security-policy'];
    res.writeHead(proxyRes.statusCode || 200, h);
    proxyRes.pipe(res);
  });
  pr.on('error', () => { if (!res.headersSent) res.status(502).end(); });
  req.pipe(pr);
});

// ── Map tile proxy (before rate limiter — tiles are high-volume image requests) ──
app.get('/api/tiles/:z/:x/:y', async (req, res) => {
  try {
    const { z, x, y } = req.params;
    const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'StarLink-Fleet/1.0 (fleet.olamtec.co.tz)' },
    });
    if (!response.ok) return res.status(response.status).end();
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    const buf = await response.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (e) {
    res.status(502).end();
  }
});

// Vehicle map icons (PNG/SVG in repo /ICONS — manifest for picker UI)
const ICONS_ROOT = path.join(__dirname, '../../ICONS');
app.get('/api/icons/manifest', (req, res) => {
  try {
    if (!fs.existsSync(ICONS_ROOT)) return res.json({ success: true, data: [] });
    const files = fs.readdirSync(ICONS_ROOT).filter(f => /\.(png|jpe?g|svg|webp|gif)$/i.test(f));
    return res.json({ success: true, data: files.sort((a, b) => a.localeCompare(b)) });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});
app.use('/api/icons', express.static(ICONS_ROOT));

// Rate limiter (API routes only — tiles are excluded above)
app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 2000,
  message: { success: false, message: 'Too many requests' },
}));

// ── Debug: test CMSV6 connectivity (no auth — for diagnostics only) ──
app.get('/debug/cmsv6', async (req, res) => {
  const axios = require('axios');
  const BASE  = process.env.CMSV6_BASE_URL || 'http://13.53.215.88';
  const USER  = process.env.CMSV6_USERNAME  || 'helion';
  const PASS  = process.env.CMSV6_PASSWORD  || 'Starlink@2026';
  try {
    const loginRes = await axios.get(`${BASE}/StandardApiAction_login.action`, {
      params: { account: USER, password: PASS },
      maxRedirects: 0, validateStatus: s => s < 400, timeout: 15000,
    });
    const loginData = loginRes.data;
    if (loginData.result !== 0 || !loginData.jsession) {
      return res.json({ step: 'login', ok: false, raw: loginData });
    }
    const jsession = loginData.jsession;
    const [vRes, sRes] = await Promise.all([
      axios.get(`${BASE}/StandardApiAction_queryUserVehicle.action`, { params: { jsession }, timeout: 15000 }),
      axios.get(`${BASE}/StandardApiAction_getDeviceStatus.action`,  { params: { jsession }, timeout: 15000 }),
    ]);
    res.json({
      ok: true,
      login: { result: loginData.result, jsession: jsession.substring(0, 10) + '...' },
      vehicleCount: (vRes.data.vehicles || []).length,
      statusCount:  (sRes.data.status   || []).length,
      statusSample: (sRes.data.status || [])[0] || null,
      vehicleSample: (vRes.data.vehicles || [])[0] || null,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, code: e.code });
  }
});

// ── Health check (no auth) ────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: `${process.env.COMPANY_NAME || 'FleetVu'} Middleware`,
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    cmsv6: process.env.CMSV6_BASE_URL,
    chatbot: !!process.env.ANTHROPIC_API_KEY,
  });
});

// ── Auth (JWT) (no API key required) ───────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/admin/users', adminUsersRoutes);

// ── Events SSE (auth via ?api_key= query param — EventSource can't set headers) ──
app.use('/api/events', auth, eventsRoute);

// ── API routes (all require API key) ─────────────────────────────────────
app.use('/api', auth);
app.use('/api', fleetRoutes);
app.use('/api/erp2', erp2Routes);
app.use('/api/chat', chatRoute);

// ── Static assets + SPA (after all /api handlers) ──────────────────────────
// Login background: explicit route so we never return index.html as "image" (breaks CSS url())
app.get('/login.png', (req, res) => {
  const p = path.join(distPath, 'login.png');
  if (!fs.existsSync(p)) {
    return res.status(404).type('text/plain').send('Add login.png to frontend/public then run npm run build');
  }
  res.type('image/png');
  res.sendFile(p);
});
app.use(express.static(distPath));

// ── SPA Fallback (serve index.html for unknown routes) ────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ── Error handler ─────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error(`[Error] ${err.message}`);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// ── Start ─────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  monitor.start();
  hourlyReport.start();
  logger.info(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logger.info(` 🚌 ${process.env.COMPANY_NAME || 'FleetVu'} Middleware — v2.0.0`);
  logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logger.info(` Port:        ${PORT}`);
  logger.info(` CMSV6:       ${process.env.CMSV6_BASE_URL}`);
  logger.info(` Chatbot:     ${process.env.ANTHROPIC_API_KEY ? '✅ enabled' : '⚠️  disabled (no API key)'}`);
  logger.info(` Health:      http://localhost:${PORT}/health`);
  logger.info(` Fleet:       http://localhost:${PORT}/api/fleet/snapshot`);
  logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});

// ── WebSocket proxy for CMSV6 video stream (port 6604) ───────────────────
// CMSV6's Jessibuca player connects via ws:// to port 6604 for FLV streams.
// We rewrite those URLs to /api/video/stream in the HTML, then tunnel the
// WebSocket upgrade here as raw TCP to 13.53.215.88:6604.
server.on('upgrade', (req, socket, head) => {
  if (!req.url.startsWith('/api/video/stream')) {
    socket.destroy();
    return;
  }
  const cmsHost   = getCmsHost();
  const targetPath = req.url.replace('/api/video/stream', '') || '/';

  const upstream = net.connect({ host: cmsHost, port: 6604 }, () => {
    // Re-send the HTTP Upgrade handshake to CMSV6 with the correct host
    const lines = [`${req.method} ${targetPath} HTTP/1.1`];
    for (const [k, v] of Object.entries(req.headers)) {
      lines.push(k.toLowerCase() === 'host' ? `host: ${cmsHost}:6604` : `${k}: ${v}`);
    }
    lines.push('', '');
    upstream.write(lines.join('\r\n'));
    if (head && head.length) upstream.write(head);
    // Bidirectional pipe — raw WebSocket frames flow through unchanged
    upstream.pipe(socket);
    socket.pipe(upstream);
  });

  upstream.on('error', () => { try { socket.destroy(); } catch (_) {} });
  socket.on('error', () => { try { upstream.destroy(); } catch (_) {} });
});

module.exports = app;
