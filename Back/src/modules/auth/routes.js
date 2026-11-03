// Sign in, sign out, the current user, and changing your own password.
const express = require("express");
const bcrypt = require("bcryptjs");
const { rateLimit } = require("express-rate-limit");
const sql = require("../../db");
const v = require("../../lib/validate");
const { HttpError } = require("../../lib/http");
const { startSession, endSession, loadUser, publicMe, requireAuth } = require("../../middleware/auth");

const router = express.Router();

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skip: () => process.env.NODE_ENV === "test",
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Wait 15 minutes and try again." },
});

/** POST /auth/login — signs in with a username or email and a password. */
router.post("/login", loginLimit, async (req, res) => {
  const identifier = v.text(req.body?.identifier, "Username or email", { max: 254 });
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const [user] = await sql`
    select id, password_hash, is_active from users
    where lower(email) = ${identifier.toLowerCase()} or lower(name) = ${identifier.toLowerCase()}
    limit 1`;
  const ok = user && password && (await bcrypt.compare(password, user.password_hash));
  if (!ok) throw new HttpError(401, "That username, email or password isn't right.");
  if (!user.is_active) throw new HttpError(403, "This account has been deactivated. Contact your admin.");
  startSession(res, user.id);
  res.json({ user: publicMe(await loadUser(user.id)) });
});

/** POST /auth/logout — ends the session. */
router.post("/logout", (req, res) => {
  endSession(res);
  res.status(204).end();
});

/** GET /auth/me — the signed-in user, role and permissions. */
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicMe(res.locals.me) });
});

/** POST /auth/password — changes your own password after checking the current one. */
router.post("/password", requireAuth, async (req, res) => {
  const next = v.password(req.body?.new_password);
  const [row] = await sql`select password_hash from users where id = ${res.locals.me.id}`;
  if (!(await bcrypt.compare(String(req.body?.current_password ?? ""), row.password_hash))) {
    throw new HttpError(400, "Your current password isn't right.");
  }
  await sql`update users set password_hash = ${await bcrypt.hash(next, 12)} where id = ${res.locals.me.id}`;
  res.status(204).end();
});

module.exports = router;
