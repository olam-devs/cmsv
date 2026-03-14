/**
 * calibration.service.js
 *
 * Per-vehicle fuel sensor calibration.
 * Stores calibration points { sensorValue, actualLiters } per devIdno,
 * computes linear regression (y = slope * x + intercept), and exposes
 * applyCalibration() for use in API route handlers.
 *
 * NOTE: calibration is applied only at the HTTP response layer — never
 * inside monitor.service.js — so internal theft-detection thresholds
 * (which work in sensor units) remain unaffected.
 */

const fs   = require('fs');
const path = require('path');

const CAL_FILE = path.join(__dirname, '../../../data/calibrations.json');

// In-memory store: { [devIdno]: { points, slope, intercept, r2, updatedAt } }
let store = {};

// ── Persistence ───────────────────────────────────────────────────────────────

function load() {
  try {
    if (fs.existsSync(CAL_FILE)) {
      store = JSON.parse(fs.readFileSync(CAL_FILE, 'utf8'));
    }
  } catch (e) {
    store = {};
  }
}

function save() {
  try {
    const dir = path.dirname(CAL_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = CAL_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
    fs.renameSync(tmp, CAL_FILE);
  } catch (e) {
    // non-fatal
  }
}

load(); // load on startup

// ── Math ──────────────────────────────────────────────────────────────────────

function linearRegression(points) {
  // points: [{ x: sensorValue, y: actualLiters }, ...]
  const n = points.length;
  if (n < 2) throw new Error('At least 2 calibration points required');

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (const { x, y } of points) {
    sumX  += x;
    sumY  += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) throw new Error('All sensor values are identical — cannot calibrate');

  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R² (coefficient of determination)
  const yMean = sumY / n;
  let ssTot = 0, ssRes = 0;
  for (const { x, y } of points) {
    const predicted = slope * x + intercept;
    ssTot += (y - yMean) ** 2;
    ssRes += (y - predicted) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  return {
    slope:     Math.round(slope     * 1e6) / 1e6,
    intercept: Math.round(intercept * 1e4) / 1e4,
    r2:        Math.round(r2        * 1e4) / 1e4,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

function getCalibration(devIdno) {
  return store[devIdno] || null;
}

function getAllCalibrations() {
  return { ...store };
}

/**
 * Set (or replace) calibration for a vehicle.
 * points: [{ sensorValue: number, actualLiters: number }, ...]
 * Returns { slope, intercept, r2 }
 */
function setCalibration(devIdno, points) {
  if (!Array.isArray(points) || points.length < 2) {
    throw new Error('At least 2 calibration points required');
  }
  for (const p of points) {
    if (typeof p.sensorValue !== 'number' || typeof p.actualLiters !== 'number') {
      throw new Error('Each point must have numeric sensorValue and actualLiters');
    }
    if (isNaN(p.sensorValue) || isNaN(p.actualLiters)) {
      throw new Error('sensorValue and actualLiters must not be NaN');
    }
  }

  const regrPoints = points.map(p => ({ x: p.sensorValue, y: p.actualLiters }));
  const { slope, intercept, r2 } = linearRegression(regrPoints);

  store[devIdno] = { points, slope, intercept, r2, updatedAt: new Date().toISOString() };
  save();
  return { slope, intercept, r2 };
}

/**
 * Delete calibration for a vehicle.
 */
function deleteCalibration(devIdno) {
  delete store[devIdno];
  save();
}

/**
 * Apply calibration to a raw sensor value (yl/100 already scaled).
 * Returns liters (number) or null if no calibration exists for this vehicle.
 */
function applyCalibration(devIdno, sensorValue) {
  if (sensorValue == null) return null;
  const cal = store[devIdno];
  if (!cal) return null;
  const liters = cal.slope * sensorValue + cal.intercept;
  return Math.max(0, Math.round(liters * 10) / 10);
}

module.exports = { getCalibration, getAllCalibrations, setCalibration, deleteCalibration, applyCalibration };
