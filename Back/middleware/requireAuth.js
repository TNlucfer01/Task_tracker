const jwt = require("jsonwebtoken");

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || Buffer.byteLength(jwtSecret) < 32) {
  throw new Error("JWT_SECRET must be set to a random value of at least 32 bytes.");
}

function requireAuth(req, res, next) {
  const token = req.cookies?.task_session;

  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const payload = jwt.verify(token, jwtSecret, {
      algorithms: ["HS256"],
      issuer: "task-tracker-api",
      audience: "task-tracker-web",
    });

    if (typeof payload === "string" || !payload.sub) {
      return res.status(401).json({ error: "Invalid or expired session." });
    }

    res.locals.authUser = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
    };

    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session." });
  }
}

module.exports = requireAuth;
