// The Express app: security-minded defaults, JSON body parsing, the API, and error handling.
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const config = require("./config");
const { errorHandler } = require("./middleware/errors");

const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json({ limit: "256kb" }));
app.use(cookieParser());
app.use("/api", require("./routes"));
app.use(errorHandler);

module.exports = app;
