// Session handling: signs the login cookie, and on every request re-loads the user with their
// role, scope and permissions, so role changes and deactivation apply immediately.
const jwt = require("jsonwebtoken");
const config = require("../config");
const sql = require("../db");
const { forbid } = require("../lib/http");

const COOKIE = "task_session";
const SESSION_MS = 8 * 60 * 60 * 1000;
const cookieOptions = { httpOnly: true, secure: config.production, sameSite: "lax", path: "/" };

/** Issues the session cookie for a user id. */
function startSession(res, userId) {
  const token = jwt.sign({}, config.jwtSecret, { algorithm: "HS256", subject: String(userId), expiresIn: "8h", ...config.jwtOptions });
  res.cookie(COOKIE, token, { ...cookieOptions, maxAge: SESSION_MS });
}

/** Clears the session cookie. */
function endSession(res) {
  res.clearCookie(COOKIE, cookieOptions);
}

/** Loads a user with role and permissions, in the shape every module uses as `me`. */
async function loadUser(userId) {
  const [row] = await sql`
    select u.id, u.name, u.email, u.title, u.department_id, u.is_active,
           r.id as role_id, r.name as role_name, r.scope, r.is_system,
           d.name as department_name,
           coalesce(array_agg(rp.permission) filter (where rp.permission is not null), '{}') as permissions
    from users u
    join roles r on r.id = u.role_id
    left join departments d on d.id = u.department_id
    left join role_permissions rp on rp.role_id = r.id
    where u.id = ${userId}
    group by u.id, r.id, d.name`;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    title: row.title,
    department_id: row.department_id,
    department_name: row.department_name,
    is_active: row.is_active,
    role: { id: row.role_id, name: row.role_name, scope: row.scope, is_system: row.is_system },
    permissions: new Set(row.permissions),
  };
}

/** Converts `me` to JSON for the browser (permissions as a sorted list). */
function publicMe(me) {
  return { ...me, permissions: [...me.permissions].sort() };
}

/** Rejects requests without a valid session; puts the current user on res.locals.me. */
async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: "Sign in to continue." });
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"], ...config.jwtOptions });
  } catch {
    return res.status(401).json({ error: "Your session has expired. Sign in again." });
  }
  const me = await loadUser(Number(payload.sub));
  if (!me || !me.is_active) return res.status(401).json({ error: "Your session has expired. Sign in again." });
  res.locals.me = me;
  return next();
}

/** True when the user has the permission. */
function can(me, permission) {
  return me.permissions.has(permission);
}

/** Middleware: requires every listed permission. */
function permit(...permissions) {
  return (req, res, next) => {
    const me = res.locals.me;
    if (!permissions.every((p) => can(me, p))) forbid();
    next();
  };
}

/** Middleware: requires at least one of the listed permissions. */
function permitAny(...permissions) {
  return (req, res, next) => {
    const me = res.locals.me;
    if (!permissions.some((p) => can(me, p))) forbid();
    next();
  };
}

module.exports = { startSession, endSession, loadUser, publicMe, requireAuth, can, permit, permitAny };
