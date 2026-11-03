const jwt = require("jsonwebtoken");
const supabase = require("../config/db");
const { jwtSecret, jwtOptions } = require("../config/auth");
const { roleKey } = require("../utils/authorization");

// Verifies the session cookie, then re-reads the user from the database so that
// role changes and deactivations take effect immediately, not when the token expires.
async function requireAuth(req, res, next) {
  const token = req.cookies?.task_session;

  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret, {
      algorithms: ["HS256"],
      ...jwtOptions,
    });
  } catch {
    return res.status(401).json({ error: "Invalid or expired session." });
  }

  if (typeof payload === "string" || !payload.sub) {
    return res.status(401).json({ error: "Invalid or expired session." });
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("id, name, email, role_id, department_id, title, is_active, role:roles!users_role_id_fkey(id, name, scope, permissions:role_permissions!role_permissions_role_id_fkey(permission))")
    .eq("id", payload.sub)
    .maybeSingle();

  if (error) {
    console.error("Session user lookup failed:", error);
    return res.status(500).json({ error: "Unable to verify your session." });
  }

  if (!user || !user.is_active || !user.role) {
    return res.status(401).json({ error: "Invalid or expired session." });
  }

  const permissions = (user.role.permissions ?? []).map((entry) => entry.permission);
  res.locals.authUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role_id: user.role_id,
    role: roleKey(user.role.name),
    role_name: user.role.name,
    scope: user.role.scope,
    permissions,
    department_id: user.department_id,
    title: user.title,
  };

  return next();
}

module.exports = requireAuth;
