// HTTP helpers shared by every module.

/** An error that becomes a JSON response with this status and message. */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Throws a 404 unless the value exists; returns the value otherwise. */
function found(value, what = "That item") {
  if (value === undefined || value === null) throw new HttpError(404, `${what} wasn't found.`);
  return value;
}

/** Throws a 403 with a reason the user can act on. */
function forbid(message = "You don't have permission to do that.") {
  throw new HttpError(403, message);
}

module.exports = { HttpError, found, forbid };
