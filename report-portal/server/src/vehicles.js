/**
 * Vehicle list: CMSV6 HTTP API (primary), helion-middleware fleet API (fallback).
 * Uses Node fetch (no axios) so VPS deploy does not need an extra package.
 */
const path = require('path');

const cms = require(path.join(__dirname, '../../../middleware/src/services/cmsv6.service'));

async function fetchJson(url, headers = {}, timeoutMs = 60000) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    const text = await res.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Invalid JSON from ${url}`);
    }
    if (!res.ok) {
      throw new Error(json.message || `HTTP ${res.status}`);
    }
    return json;
  } finally {
    clearTimeout(tid);
  }
}

async function fromMiddlewareFleet() {
  const base = String(process.env.HELION_API_BASE || 'http://127.0.0.1:3000/api').replace(/\/$/, '');
  const key = process.env.MIDDLEWARE_API_KEY || process.env.API_KEY || '';
  const headers = key ? { 'x-api-key': key } : {};
  const json = await fetchJson(`${base}/fleet/vehicles`, headers);
  const list = json.data ?? json ?? [];
  if (!Array.isArray(list)) throw new Error('Invalid fleet/vehicles response from middleware');
  return list
    .map((v) => ({
      devIdno: v.devIdno || v.id,
      plate: v.plate || v.nm,
      nm: v.nm,
      sim: v.sim,
    }))
    .filter((v) => v.devIdno);
}

/** @returns {Promise<object[]>} */
async function loadFleetVehicles() {
  let cmsErr = null;
  try {
    const fromCms = await cms.getVehicles();
    const withDev = (fromCms || []).filter((v) => v.devIdno);
    if (withDev.length > 0) return withDev;
    cmsErr = new Error('CMS returned 0 vehicles with a device id');
  } catch (e) {
    cmsErr = e;
  }

  try {
    const fromMw = await fromMiddlewareFleet();
    if (fromMw.length > 0) {
      return fromMw;
    }
  } catch (mwErr) {
    throw new Error(
      `CMS: ${cmsErr?.message || cmsErr}. Middleware fallback: ${mwErr.message}. ` +
        'Ensure Tomcat :8080 is up and C:\\helion\\middleware\\.env has correct CMSV6_* (or helion-middleware is online on :3000).',
    );
  }

  throw cmsErr || new Error('No vehicles from CMS or middleware');
}

module.exports = { loadFleetVehicles, fromMiddlewareFleet };
