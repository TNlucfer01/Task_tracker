const jwt = require("jsonwebtoken");
const supabase = require("../config/db");
const { jwtSecret, jwtOptions } = require("../config/auth");

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
    .select("id, name, email, role, department_id, is_active")
    .eq("id", payload.sub)
    .maybeSingle();

  if (error) {
    console.error("Session user lookup failed:", error);
    return res.status(500).json({ error: "Unable to verify your session." });
  }

  if (!user || !user.is_active) {
    return res.status(401).json({ error: "Invalid or expired session." });
  }

  res.locals.authUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department_id: user.department_id,
  };

  return next();
}

module.exports = requireAuth;
