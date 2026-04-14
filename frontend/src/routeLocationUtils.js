/**
 * CSV template + parsing for Route Tracker locations (Excel-friendly).
 * Template is circle-only: name, lat, lng, radius, optional contact fields.
 * Imported rows use default colour and icon; change those via bulk edit in the UI.
 */

export function parseCSV(text) {
  const rows = [];
  let cur = "";
  let row = [];
  let inQ = false;
  const s = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += c;
    } else if (c === '"') {
      inQ = true;
    } else if (c === ",") {
      row.push(cur.trim());
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cur.trim());
      cur = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur.trim());
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

function colIndex(header, aliases) {
  const h = header.map((x) => String(x).trim().toLowerCase());
  for (const a of aliases) {
    const i = h.indexOf(a.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

function cell(row, idx) {
  if (idx < 0) return "";
  return row[idx] != null ? String(row[idx]).trim() : "";
}

/** Stable key: same name + position = duplicate (file or vs existing list). */
export function locationImportFingerprint(name, lat, lng) {
  const n = String(name ?? "").trim().toLowerCase();
  if (!n || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
  return `${n}|${Number(lat).toFixed(5)}|${Number(lng).toFixed(5)}`;
}

/**
 * Optional phone (digits). Empty OK. Incomplete/invalid → omit phone, return issue text for reporting.
 */
export function normalizePhoneForImport(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return { phone: "", issue: null };

  let t = s.replace(/\s/g, "");
  if (/^[\d.]+[eE][+-]?\d+$/.test(t)) {
    const n = Number(t);
    if (Number.isFinite(n) && n >= 0) {
      t = String(Math.round(n));
    }
  }
  const only = t.replace(/\D/g, "");
  if (!only) return { phone: "", issue: "no digits in phone field" };
  if (only.length >= 9 && only.length <= 15) return { phone: only, issue: null };
  return { phone: "", issue: `invalid length (${only.length} digits; use 9–15)` };
}

/** Default styling for CSV imports (bulk edit can change later). */
export const CSV_IMPORT_DEFAULT_COLOR = "#4318d1";
export const CSV_IMPORT_DEFAULT_ICON_KEY = "pin";

/**
 * Parse circle-only location rows.
 * @param {any[][]} rows
 * @param {number} defaultMinRadius
 * @param {{ existingLocations?: Array<{ name: string, lat?: number, lng?: number, type?: string }> }} [options]
 * @returns {{
 *   items: object[],
 *   report: { fatalErrors: string[], skippedDuplicates: string[], rowWarnings: string[] },
 *   stats: null | {
 *     nonEmptyDataRows: number,
 *     rowsQueuedForImport: number,
 *     duplicateInFileSkipped: number,
 *     duplicateExistingSkipped: number,
 *     invalidRowsSkipped: number,
 *     phoneNotesCount: number,
 *   }
 * }}
 */
export function csvRowsToLocationItems(rows, defaultMinRadius = 200, options = {}) {
  const { existingLocations = [] } = options;
  const fatalErrors = [];
  const skippedDuplicates = [];
  const rowWarnings = [];
  let duplicateInFileSkipped = 0;
  let duplicateExistingSkipped = 0;

  if (!rows || rows.length < 2) {
    return {
      items: [],
      report: {
        fatalErrors: ["Need a header row and at least one data row"],
        skippedDuplicates: [],
        rowWarnings: [],
      },
      stats: null,
    };
  }
  const header = rows[0];
  const n = colIndex(header, ["name"]);
  const la = colIndex(header, ["lat"]);
  const ln = colIndex(header, ["lng", "lon", "long"]);
  const r = colIndex(header, ["radius_m", "radius", "radius meters"]);
  const phoneCol = colIndex(header, ["phone_integer", "phone", "tel", "mobile"]);
  const contact = colIndex(header, ["contact_person", "contact", "contact name"]);
  const role = colIndex(header, ["role"]);
  const addr = colIndex(header, ["place_address", "address", "place"]);

  if (n < 0) {
    return {
      items: [],
      report: {
        fatalErrors: ["Missing required column: name"],
        skippedDuplicates: [],
        rowWarnings: [],
      },
      stats: null,
    };
  }

  const existingKeys = new Set();
  for (const loc of existingLocations) {
    if (loc?.type === "polygon") continue;
    const fp = locationImportFingerprint(loc.name, loc.lat, loc.lng);
    if (fp) existingKeys.add(fp);
  }

  const seenInFile = new Set();
  const items = [];

  for (let ri = 1; ri < rows.length; ri++) {
    const row = rows[ri];
    if (!row || !row.some((x) => String(x || "").trim())) continue;
    const name = cell(row, n);
    const rowLabel = `Row ${ri + 1}`;
    if (!name) {
      fatalErrors.push(`${rowLabel}: name is required — row skipped`);
      continue;
    }
    const lat = parseFloat(cell(row, la));
    const lng = parseFloat(cell(row, ln));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      fatalErrors.push(`${rowLabel} · "${name}": lat and lng required — row skipped`);
      continue;
    }
    let rad = parseFloat(cell(row, r));
    if (!Number.isFinite(rad) || rad < defaultMinRadius) rad = defaultMinRadius;

    const fp = locationImportFingerprint(name, lat, lng);
    if (fp && seenInFile.has(fp)) {
      duplicateInFileSkipped += 1;
      skippedDuplicates.push(
        `${rowLabel} · "${name}" — skipped (duplicate of an earlier row in this file, same name + coordinates)`,
      );
      continue;
    }
    if (fp && existingKeys.has(fp)) {
      duplicateExistingSkipped += 1;
      skippedDuplicates.push(
        `${rowLabel} · "${name}" — skipped (already exists in your locations with same name + coordinates)`,
      );
      continue;
    }
    if (fp) seenInFile.add(fp);

    const rawPhone = cell(row, phoneCol);
    const { phone, issue: phoneIssue } = normalizePhoneForImport(rawPhone);
    if (phoneIssue) {
      rowWarnings.push(
        `${rowLabel} · "${name}" — location will be imported without phone (${phoneIssue}; value was: ${JSON.stringify(rawPhone)})`,
      );
    }

    items.push({
      name,
      type: "circle",
      lat,
      lng,
      radius: rad,
      phone,
      contactPerson: cell(row, contact),
      role: cell(row, role),
      placeAddress: cell(row, addr),
      iconKey: CSV_IMPORT_DEFAULT_ICON_KEY,
      color: CSV_IMPORT_DEFAULT_COLOR,
      _csvRow: ri + 1,
    });
  }

  const nonEmptyDataRows = fatalErrors.length + skippedDuplicates.length + items.length;
  return {
    items,
    report: { fatalErrors, skippedDuplicates, rowWarnings },
    stats: {
      nonEmptyDataRows,
      rowsQueuedForImport: items.length,
      duplicateInFileSkipped,
      duplicateExistingSkipped,
      invalidRowsSkipped: fatalErrors.length,
      phoneNotesCount: rowWarnings.length,
    },
  };
}

export function buildLocationTemplateCSV({ defaultMinRadius = 200, roles = [] }) {
  const headers = [
    "name",
    "lat",
    "lng",
    "radius_m",
    "phone_integer",
    "contact_person",
    "role",
    "place_address",
  ];
  const roleHint = roles[0] || "Distributor";
  const row1 = [
    "Example depot",
    "-6.7924",
    "39.2083",
    String(defaultMinRadius),
    "255700000000",
    "Juma M.",
    roleHint,
    "Dar es Salaam",
  ];
  return [headers.join(","), row1.join(",")].join("\r\n");
}
