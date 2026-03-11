/**
 * sms.service.js — SMS notifications via messaging-service.co.tz
 *
 * Env vars required:
 *   SMS_API_TOKEN      — API token from messaging-service.co.tz
 *   SMS_SENDER_NAME    — Approved sender ID (e.g. "DARASA 360")
 *   SMS_RECIPIENTS     — Comma-separated phone numbers e.g. +255712345678,+255787654321
 *
 * Optional:
 *   SMS_ENABLED        — Set to "false" to disable (default: true)
 *   SMS_API_URL        — Override base URL (default below)
 */

require('dotenv').config();
const axios  = require('axios');
const logger = require('../utils/logger');

const API_URL   = process.env.SMS_API_URL    || 'https://messaging-service.co.tz/api/sms/v2/text/single';
const API_TOKEN = process.env.SMS_API_TOKEN;
const SENDER    = process.env.SMS_SENDER_NAME || 'DARASA 360';
const ENABLED   = process.env.SMS_ENABLED !== 'false';
const TIMEZONE  = process.env.FLEET_TIMEZONE  || 'Africa/Dar_es_Salaam';
const COMPANY   = process.env.COMPANY_NAME    || 'Star Link Fleet';

// ── Recipient list ────────────────────────────────────────────────────────────

function getRecipients() {
  const raw = process.env.SMS_RECIPIENTS || '';
  return raw.split(',').map(n => n.trim().replace(/^\+/, '')).filter(Boolean);
  // Strip leading '+' → messaging-service.co.tz expects 255XXXXXXXXX format
}

// ── Message formatter (ACC on/off events) ─────────────────────────────────────

function formatMessage(evt) {
  const time = new Date(evt.time).toLocaleString('en-TZ', {
    timeZone: TIMEZONE,
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const vehicleLine = evt.vehicleName && evt.vehicleName !== evt.plate
    ? `${evt.vehicleName} (${evt.plate})`
    : (evt.plate || 'Unknown');

  if (evt.type === 'acc_on') {
    const lines = [
      COMPANY,
      `ENGINE ON`,
      `Vehicle : ${vehicleLine}`,
      `Time    : ${time}`,
    ];
    if (evt.fuel != null)   lines.push(`Fuel    : ${evt.fuel} units`);
    if (evt.downtimeStr)    lines.push(`Parked  : ${evt.downtimeStr}`);
    if (evt.fuelConsumedDuringOff != null && evt.fuelConsumedDuringOff > 0)
      lines.push(`Off-consumption: -${evt.fuelConsumedDuringOff}L`);
    return lines.join('\n');
  }

  // acc_off
  const lines = [
    COMPANY,
    `ENGINE OFF`,
    `Vehicle : ${vehicleLine}`,
    `Time    : ${time}`,
  ];
  if (evt.fuel        != null) lines.push(`Fuel    : ${evt.fuel} units`);
  if (evt.fuelAtStart != null) lines.push(`Fuel start: ${evt.fuelAtStart} units`);
  if (evt.fuelUsed    != null) lines.push(`Consumed: ${evt.fuelUsed} units`);
  if (evt.uptimeStr)           lines.push(`Ran for : ${evt.uptimeStr}`);
  return lines.join('\n');
}

// ── Core send — messaging-service.co.tz Mobile SMS API v2 ────────────────────
// Sends the same message to all recipients in one API call.
// API docs: POST /api/mobile/v2/text/single
// Payload:  { to: "255..." | ["255...", "255..."], text: "...", reference: "..." }

async function sendToAll(recipients, message, reference = 'fleet') {
  const to      = recipients.length === 1 ? recipients[0] : recipients;
  const payload = { from: SENDER, to, text: message, reference };

  logger.info(`[SMS] POST ${API_URL} → ${recipients.join(', ')}`);

  const res = await axios.post(API_URL, payload, {
    headers: {
      Authorization:  `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
      Accept:         'application/json',
    },
    timeout: 15000,
  });

  return res.data;
}

// ── Public: send SMS for any event ───────────────────────────────────────────

async function sendAccEvent(evt) {
  if (!ENABLED) return;

  if (!API_TOKEN) {
    logger.warn('[SMS] SMS_API_TOKEN not set — skipping');
    return;
  }

  const recipients = getRecipients();
  if (!recipients.length) {
    logger.warn('[SMS] SMS_RECIPIENTS not set — no numbers to send to');
    return;
  }

  const message   = evt._smsMessage || formatMessage(evt);
  const reference = `fleet-${evt.type || 'event'}-${Date.now()}`;
  const icon      = evt.type === 'acc_on' ? '🟢' : evt.type === 'acc_off' ? '🔴' : '📊';

  logger.info(`[SMS] ${icon} Sending "${evt.type}" to ${recipients.length} recipient(s)`);
  logger.info(`[SMS] Message preview: ${message.split('\n')[0]}…`);

  try {
    const result = await sendToAll(recipients, message, reference);
    logger.info(`[SMS] ✓ Sent — ${JSON.stringify(result)}`);
  } catch (e) {
    const errData = e?.response?.data;
    const errMsg  = errData ? JSON.stringify(errData) : (e?.message || String(e));
    logger.error(`[SMS] ✗ Failed: ${errMsg}`);
    throw e;
  }
}

module.exports = { sendAccEvent };
