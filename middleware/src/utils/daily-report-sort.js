/**
 * Daily fleet report row order (Helion Excel-style):
 * 1. Main fleet — plate A→Z (numeric-aware, keeps similar plates together)
 * 2. T406 / T407 / T162 / T245 — above device-id plates
 * 3. Plates starting 0134000 — bottom
 */

function normPlate(plate) {
  return String(plate || '')
    .trim()
    .toUpperCase();
}

/** @returns {1|2|3} */
function plateSortTier(plate) {
  const p = normPlate(plate);
  if (p.startsWith('0134000')) return 3;
  if (/T406|T407|T162|T245/.test(p)) return 2;
  return 1;
}

function comparePlates(plateA, plateB) {
  const tierA = plateSortTier(plateA);
  const tierB = plateSortTier(plateB);
  if (tierA !== tierB) return tierA - tierB;
  return normPlate(plateA).localeCompare(normPlate(plateB), 'en', {
    numeric: true,
    sensitivity: 'base',
  });
}

/** Sort report rows and re-number NO column. */
function sortDailyReportRows(rows) {
  const sorted = [...(rows || [])].sort((a, b) => {
    const plateA = a.plate || a.nm || a.devIdno || '';
    const plateB = b.plate || b.nm || b.devIdno || '';
    return comparePlates(plateA, plateB);
  });
  sorted.forEach((row, i) => {
    row.no = i + 1;
  });
  return sorted;
}

module.exports = { sortDailyReportRows, plateSortTier, comparePlates };
