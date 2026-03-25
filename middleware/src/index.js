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
const monitor        = require('./services/monitor.service');
const hourlyReport   = require('./services/hourly-report.service');
const path           = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security & middleware ──────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// ── Serve Frontend ────────────────────────────────────────────────────────
const distPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(distPath));

// Rate limiter
app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 500,
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

// ── Map tile proxy (no auth — Leaflet fetches images without headers) ────────
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

// ── Events SSE (auth via ?api_key= query param — EventSource can't set headers) ──
app.use('/api/events', auth, eventsRoute);

// ── API routes (all require API key) ─────────────────────────────────────
app.use('/api', auth);
app.use('/api', fleetRoutes);
app.use('/api/chat', chatRoute);

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
app.listen(PORT, () => {
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

module.exports = app;
