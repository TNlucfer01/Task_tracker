// Turns thrown errors into JSON responses. Database constraint errors become messages a person
// can act on; anything unexpected is logged and hidden behind a generic 500.
const { HttpError } = require("../lib/http");

// Friendly messages for named constraints from db/migrations.
const CONSTRAINTS = {
  users_email_uq: [409, "Someone already uses that email."],
  users_name_uq: [409, "That name is taken. Choose another."],
  roles_name_uq: [409, "A role with that name already exists."],
  departments_name_uq: [409, "A department with that name already exists."],
  projects_key_uq: [409, "Another project already uses that key."],
  project_fields_project_id_key_key: [409, "This project already has a field with that key."],
  work_sessions_one_open: [409, "You're already clocked in."],
  work_sessions_user_id_tstzrange_excl: [409, "That time overlaps another work session."],
  task_time_logs_one_running: [409, "A timer is already running."],
};

/** Maps a Postgres error to [status, message], or null when it isn't one we expect. */
function fromPostgres(error) {
  if (CONSTRAINTS[error.constraint_name]) return CONSTRAINTS[error.constraint_name];
  if (error.code === "P0001") return [400, error.message];
  if (error.code === "P0002") return [409, error.message];
  if (error.code === "23505") return [409, "That already exists."];
  if (error.code === "23503") return [400, "That refers to something that doesn't exist, or something still depends on it."];
  if (error.code === "23514") return [400, "Some of the values aren't allowed."];
  if (error.code === "23P01") return [409, "That overlaps something that already exists."];
  if (error.code === "22P02") return [400, "Some of the values aren't in the right format."];
  return null;
}

/** Express error handler (registered last). */
// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
  if (error?.type === "entity.parse.failed") return res.status(400).json({ error: "The request body must be valid JSON." });
  if (error?.type === "entity.too.large") return res.status(413).json({ error: "That's too large to save." });
  const mapped = error?.code ? fromPostgres(error) : null;
  if (mapped) return res.status(mapped[0]).json({ error: mapped[1] });
  console.error(`${req.method} ${req.originalUrl} failed:`, error);
  return res.status(500).json({ error: "Something went wrong on the server. Try again." });
}

module.exports = { errorHandler, fromPostgres };
