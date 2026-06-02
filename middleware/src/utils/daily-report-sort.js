/**
 * Daily fleet report row order (Helion):
 * 1. Main fleet — plate A→Z
 * 2. Special group (bottom-up): T972, T162, T407, T406, T245
 * 3. Device-id plates (0134000…) — very bottom
 */

function normPlate(plate) {
  return String(plate || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function isDeviceIdRow(plate, devIdno) {
  const d = String(devIdno || '');
  const p = normPlate(plate);
  return d.startsWith('0134000') || p.startsWith('0134000');
}

/** Closer to table bottom = lower sub index within tier 2. */
const SPECIAL_BOTTOM_ORDER = [
  (p) => /T245/.test(p),
  (p) => /T406/.test(p),
  (p) => /T407/.test(p),
  (p) => /T162/.test(p),
  (p) => /T972/.test(p),
];

function rowSortKey(plate, devIdno) {
  const p = normPlate(plate);
  if (isDeviceIdRow(plate, devIdno)) {
    return { tier: 3, sub: p || String(devIdno) };
  }
  for (let i = 0; i < SPECIAL_BOTTOM_ORDER.length; i++) {
    if (SPECIAL_BOTTOM_ORDER[i](p)) return { tier: 2, sub: i };
  }
  return { tier: 1, sub: p };
}

function compareRowKeys(a, b) {
  if (a.tier !== b.tier) return a.tier - b.tier;
  if (a.tier === 2) return b.sub - a.sub;
  return String(a.sub).localeCompare(String(b.sub), 'en', {
    numeric: true,
    sensitivity: 'base',
  });
}

function comparePlates(plateA, plateB, devA, devB) {
  return compareRowKeys(
    rowSortKey(plateA, devA),
    rowSortKey(plateB, devB),
  );
}

function sortDailyReportRows(rows) {
  const sorted = [...(rows || [])].sort((a, b) => {
    const plateA = a.plate || a.nm || a.devIdno || '';
    const plateB = b.plate || b.nm || b.devIdno || '';
    return comparePlates(plateA, plateB, a.devIdno, b.devIdno);
  });
  sorted.forEach((row, i) => {
    row.no = i + 1;
  });
  return sorted;
}

module.exports = { sortDailyReportRows, comparePlates, rowSortKey };
