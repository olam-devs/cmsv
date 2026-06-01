/**
 * Vehicle list: CMSV6 HTTP API (primary), helion-middleware fleet API (fallback).
 * Daily report rows still use CMS for GPS/fuel/track per vehicle.
 */
const path = require('path');
const axios = require('axios');

const cms = require(path.join(__dirname, '../../../middleware/src/services/cmsv6.service'));

async function fromMiddlewareFleet() {
  const base = String(process.env.HELION_API_BASE || 'http://127.0.0.1:3000/api').replace(/\/$/, '');
  const key = process.env.MIDDLEWARE_API_KEY || process.env.API_KEY || '';
  const res = await axios.get(`${base}/fleet/vehicles`, {
    headers: key ? { 'x-api-key': key } : {},
    timeout: 60000,
  });
  const list = res.data?.data ?? res.data ?? [];
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
