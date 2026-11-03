// Input validators. Each returns the cleaned value or throws a 400 that names the field.
const { HttpError } = require("./http");

const bad = (msg) => new HttpError(400, msg);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A trimmed string between min and max characters. */
function text(value, label, { min = 1, max = 200 } = {}) {
  if (typeof value !== "string") throw bad(`${label} is required.`);
  const v = value.trim();
  if (v.length < min || v.length > max) {
    throw bad(min > 1 || max < 200 ? `${label} must be ${min} to ${max} characters.` : `${label} is required.`);
  }
  return v;
}

/** Optional string: undefined stays undefined, "" becomes "", otherwise like text(). */
function optionalText(value, label, opts = {}) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return "";
  return text(value, label, { min: 0, ...opts });
}

/** A positive integer id. */
function id(value, label = "id") {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw bad(`${label} must be a positive whole number.`);
  return n;
}

/** An id or null (to clear a reference). */
function nullableId(value, label) {
  return value === null || value === "" ? null : id(value, label);
}

/** One of the allowed values. */
function oneOf(value, allowed, label) {
  if (!allowed.includes(value)) throw bad(`${label} must be one of: ${allowed.join(", ")}.`);
  return value;
}

/** true or false. */
function bool(value, label) {
  if (typeof value !== "boolean") throw bad(`${label} must be true or false.`);
  return value;
}

/** A whole number within range. */
function int(value, label, { min = -Infinity, max = Infinity } = {}) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`${label} must be a whole number from ${min} to ${max}.`);
  return n;
}

/** An ISO timestamp, or null to clear it. */
function timestamp(value, label) {
  if (value === null || value === "") return null;
  const d = new Date(value);
  if (typeof value !== "string" || Number.isNaN(d.getTime())) throw bad(`${label} must be a date and time.`);
  return d.toISOString();
}

/** A YYYY-MM-DD date, or null to clear it. */
function day(value, label) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw bad(`${label} must be a date (YYYY-MM-DD).`);
  }
  return value;
}

/** A lower-cased email address. */
function email(value) {
  const v = text(value, "Email", { max: 254 }).toLowerCase();
  if (!EMAIL.test(v)) throw bad("Enter a valid email address.");
  return v;
}

/** A person's name; it doubles as their username, so no "@". */
function personName(value) {
  const v = text(value, "Name", { min: 2, max: 60 });
  if (v.includes("@")) throw bad("Name can't contain @, because it's also used as the username.");
  return v;
}

/** A password of reasonable length. */
function password(value) {
  if (typeof value !== "string" || value.length < 8 || value.length > 128) throw bad("Password must be 8 to 128 characters.");
  return value;
}

/** A list of short labels: trimmed, lower-cased, de-duplicated. */
function labels(value) {
  if (!Array.isArray(value)) throw bad("Labels must be a list.");
  const out = [...new Set(value.map((l) => text(l, "Each label", { max: 40 }).toLowerCase()))];
  if (out.length > 20) throw bad("Use at most 20 labels.");
  return out;
}

module.exports = { text, optionalText, id, nullableId, oneOf, bool, int, timestamp, day, email, personName, password, labels };
