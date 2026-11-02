const express = require("express");
const bcrypt = require("bcryptjs");
const { rateLimit } = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const supabase = require("../config/db");
const requireAuth = require("../middleware/requireAuth");
const { jwtSecret, jwtOptions } = require("../config/auth");

const router = express.Router();
const sessionDurationMs = 8 * 60 * 60 * 1000;
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Try again later." },
});

router.post("/login", loginRateLimit, async (req, res) => {
  const { identifier, password } = req.body ?? {};

  if (
    typeof identifier !== "string" ||
    typeof password !== "string" ||
    !identifier.trim() ||
    !password ||
    identifier.length > 320 ||
    password.length > 1024
  ) {
    return res.status(400).json({ error: "Enter a valid username or email and password." });
  }

  const login = identifier.trim();
  let user;

  try {
    const emailResult = await supabase
      .from("users")
      .select("id, name, email, password_hash")
      .eq("email", login.toLowerCase())
      .maybeSingle();

    if (emailResult.error) {
      throw emailResult.error;
    }

    user = emailResult.data;

    if (!user) {
      const nameResult = await supabase
        .from("users")
        .select("id, name, email, password_hash")
        .eq("name", login)
        .maybeSingle();

      if (nameResult.error) {
        throw nameResult.error;
      }

      user = nameResult.data;
    }
  } catch (error) {
    console.error("Login user lookup failed:", error);
    return res.status(500).json({ error: "Unable to sign in right now." });
  }

  if (!user || typeof user.password_hash !== "string") {
    return res.status(401).json({ error: "Invalid username/email or password." });
  }

  let passwordMatches;
  try {
    passwordMatches = await bcrypt.compare(password, user.password_hash);
  } catch (error) {
    console.error("Password hash verification failed:", error);
    return res.status(500).json({ error: "Unable to sign in right now." });
  }

  if (!passwordMatches) {
    return res.status(401).json({ error: "Invalid username/email or password." });
  }

  const token = jwt.sign(
    { name: user.name, email: user.email },
    jwtSecret,
    {
      algorithm: "HS256",
      subject: String(user.id),
      ...jwtOptions,
      expiresIn: "8h",
    },
  );

  res.cookie("task_session", token, {
    ...cookieOptions,
    maxAge: sessionDurationMs,
  });

  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
});

router.get("/me", requireAuth, (req, res) => {
  return res.json({ user: res.locals.authUser });
});

router.post("/logout", (req, res) => {
  res.clearCookie("task_session", cookieOptions);
  return res.status(204).end();
});

module.exports = router;
