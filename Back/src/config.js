// Reads and validates environment settings once, so the rest of the app can trust them.
require("dotenv").config({ path: require("path").resolve(__dirname, "..", ".env") });

/** Returns a required environment variable or stops the app with a clear message. */
function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} in Back/.env (see Back/.env.example).`);
  return value;
}

const jwtSecret = required("JWT_SECRET");
if (Buffer.byteLength(jwtSecret) < 32) throw new Error("JWT_SECRET must be at least 32 bytes.");

module.exports = {
  databaseUrl: required("DATABASE_URL"),
  databaseSsl: process.env.DATABASE_SSL !== "false",
  jwtSecret,
  jwtOptions: { issuer: "task-tracker-api", audience: "task-tracker-web" },
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  port: Number(process.env.PORT) || 3000,
  production: process.env.NODE_ENV === "production",
};
