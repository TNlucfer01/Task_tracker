// Minimal CSV writer for reports.

/** Quotes one value for CSV, and blocks spreadsheet formula injection. */
function cell(value) {
  if (value === null || value === undefined) return "";
  let s = Array.isArray(value) ? value.join("; ") : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Builds a CSV document from a header list and row arrays. */
function toCsv(header, rows) {
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** Sends a CSV download with a safe file name. */
function sendCsv(res, name, header, rows) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/[^a-z0-9._-]/gi, "-")}"`);
  res.send("﻿" + toCsv(header, rows));
}

module.exports = { toCsv, sendCsv };
