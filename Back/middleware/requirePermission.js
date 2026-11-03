const { hasPermission } = require("../utils/authorization");

function requirePermission(permission) {
  return function checkPermission(req, res, next) {
    const authUser = res.locals.authUser;
    if (!authUser) {
      return res.status(401).json({ error: "Authentication required." });
    }
    if (!hasPermission(authUser, permission)) {
      return res.status(403).json({ error: "You do not have access to this resource." });
    }
    return next();
  };
}

module.exports = requirePermission;
