require("dotenv").config({ path: require("path").resolve(__dirname, "..", ".env") });

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || Buffer.byteLength(jwtSecret) < 32) {
  throw new Error("JWT_SECRET must be set to a random value of at least 32 bytes.");
}

module.exports = {
  jwtSecret,
  jwtOptions: {
    issuer: "task-tracker-api",
    audience: "task-tracker-web",
  },
};
