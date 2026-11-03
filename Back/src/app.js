// The Express app: security-minded defaults, JSON body parsing, the API, and error handling.
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const config = require("./config");
const { errorHandler } = require("./middleware/errors");

const app = express(); // Create the Express app, which is a function that can handle requests and responses.
if (config.production) app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api", require("./routes"));
if (config.production) {
  const frontendBuild = path.resolve(__dirname, "..", "..", "Front", "dist");
  app.use(express.static(frontendBuild));
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    return res.sendFile(path.join(frontendBuild, "index.html"));
  });
}
app.use(errorHandler);

module.exports = app;
