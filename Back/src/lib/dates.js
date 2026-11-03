// Calendar-day helpers. Days are counted in India time so "today" matches the team's clock.
const TZ = "Asia/Kolkata";

/** Today (plus an offset in days) as YYYY-MM-DD in India time. */
function todayInIndia(offsetDays = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

/** Reads ?from&to (YYYY-MM-DD); defaults to the last `days` days. */
function dayRange(query, days = 30) {
  const ok = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
  const from = ok(query.from) ? query.from : todayInIndia(-(days - 1));
  const to = ok(query.to) ? query.to : todayInIndia();
  return from <= to ? { from, to } : { from: to, to: from };
}

module.exports = { TZ, todayInIndia, dayRange };
