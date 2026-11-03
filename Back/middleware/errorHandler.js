const { HttpError } = require("../utils/http");

// Express 5 forwards errors thrown in async handlers here.
// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body must be valid JSON." });
  }
  console.error(`${req.method} ${req.originalUrl} failed:`, error);
  return res.status(500).json({ error: "Something went wrong on the server." });
}

module.exports = errorHandler;
