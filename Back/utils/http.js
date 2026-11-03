// Small helpers shared by route handlers.

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Unwraps a Supabase response, throwing on error so Express 5 hands it to the error handler.
async function run(query) {
  const { data, error, count } = await query;
  if (error) {
    throw error;
  }
  return { data, count };
}

function parseId(value, label = "id") {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new HttpError(400, `${label} must be a positive integer.`);
  }
  return id;
}

// Accepts YYYY-MM-DD (a calendar day in India time, matching v_daily_hours.day).
function parseDay(value, label) {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new HttpError(400, `${label} must be a date in YYYY-MM-DD format.`);
  }
  return value;
}

// Today's date in Asia/Kolkata as YYYY-MM-DD.
function todayInIndia(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);
}

function minutesBetween(start, end) {
  return (new Date(end ?? Date.now()) - new Date(start)) / 60000;
}

function round(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

module.exports = { HttpError, run, parseId, parseDay, todayInIndia, minutesBetween, round };
