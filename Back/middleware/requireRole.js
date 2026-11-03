// Use after requireAuth. Example: router.use(requireRole("admin"))
function requireRole(...allowedRoles) {
  return function checkRole(req, res, next) {
    const role = res.locals.authUser?.role;

    if (!role) {
      return res.status(401).json({ error: "Authentication required." });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: "You do not have access to this resource." });
    }

    return next();
  };
}

module.exports = requireRole;
