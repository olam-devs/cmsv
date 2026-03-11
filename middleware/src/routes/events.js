/**
 * routes/events.js — Server-Sent Events endpoint
 *
 * GET /api/events
 *   Streams real-time ACC on/off events to connected dashboard clients.
 *   Sends the last 50 events immediately on connect (as a 'history' event),
 *   then pushes new events as they happen.
 *
 * GET /api/events/history?limit=50
 *   REST fallback — returns stored event history as JSON.
 */

const express = require('express');
const router  = express.Router();
const { monitor, getHistory } = require('../services/monitor.service');
const logger  = require('../utils/logger');

// ── SSE stream ────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  res.setHeader('Content-Type',       'text/event-stream');
  res.setHeader('Cache-Control',      'no-cache');
  res.setHeader('Connection',         'keep-alive');
  res.setHeader('X-Accel-Buffering',  'no'); // disable nginx proxy buffering
  res.flushHeaders();

  // Send existing history immediately so the client has context on connect
  const history = getHistory(50);
  res.write(`event: history\ndata: ${JSON.stringify(history)}\n\n`);

  // Relay new events to this client
  const onEvent = (evt) => {
    res.write(`data: ${JSON.stringify(evt)}\n\n`);
  };
  monitor.on('event', onEvent);

  // Heartbeat comment every 25 s — keeps the connection alive through proxies
  const hb = setInterval(() => {
    res.write(': ping\n\n');
  }, 25000);

  req.on('close', () => {
    monitor.removeListener('event', onEvent);
    clearInterval(hb);
    logger.debug('[Events] SSE client disconnected');
  });

  logger.debug(`[Events] SSE client connected from ${req.ip}`);
});

// ── REST history fallback ─────────────────────────────────────────────────────
router.get('/history', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const data  = getHistory(limit);
  res.json({ success: true, data, count: data.length });
});

module.exports = router;
