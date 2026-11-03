const { HttpError } = require("./http");

const ROLES = ["admin", "user"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireString(value, label) {
  if (typeof value !== "string") {
    throw new HttpError(400, `${label} is required.`);
  }
  return value.trim();
}

// The name doubles as the login username, so it can't contain "@" (that would look like an email).
function validName(value) {
  const name = requireString(value, "Name");
  if (name.length < 2 || name.length > 60) {
    throw new HttpError(400, "Name must be 2 to 60 characters.");
  }
  if (name.includes("@")) {
    throw new HttpError(400, "Name can't contain @, because it's also used as the username.");
  }
  return name;
}

function validEmail(value) {
  const email = requireString(value, "Email").toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new HttpError(400, "Enter a valid email address.");
  }
  return email;
}

function validPassword(value) {
  if (typeof value !== "string" || value.length < 8 || value.length > 128) {
    throw new HttpError(400, "Password must be 8 to 128 characters.");
  }
  return value;
}

function validRole(value) {
  if (!ROLES.includes(value)) {
    throw new HttpError(400, "Role must be admin or user.");
  }
  return value;
}

// null clears the department; otherwise a positive integer id.
function validDepartmentId(value) {
  if (value === null || value === "") {
    return null;
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new HttpError(400, "Department must be a valid department.");
  }
  return id;
}

function validBoolean(value, label) {
  if (typeof value !== "boolean") {
    throw new HttpError(400, `${label} must be true or false.`);
  }
  return value;
}

module.exports = { validName, validEmail, validPassword, validRole, validDepartmentId, validBoolean };
