// Test helper: an in-memory Postgres (PGlite) with the real migration and demo data, plus the API on a free port.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const PORT = 55400 + Math.floor(Math.random() * 500);

/** Boots the database and the API; returns { base, stop }. */
async function start() {
  const { PGlite } = await import("@electric-sql/pglite");
  const { btree_gist } = await import("@electric-sql/pglite/contrib/btree_gist");
  const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");
  const db = await PGlite.create({ extensions: { btree_gist } });
  await db.exec("create role anon; create role authenticated; create role service_role; create extension btree_gist;");
  for (const file of ["db/migrations/001_rebuild.sql", "db/migrations/002_lock_helper_function.sql", "db/seed/demo.sql"]) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    if (file.includes("002") && !text.includes("rls_auto_enable")) continue;
    try { await db.exec(text); } catch (e) { if (!String(e.message).includes("rls_auto_enable")) throw e; }
  }
  await db.exec(`insert into users (name, email, password_hash, role_id)
    select 'aathi2006', 'admin@example.org', password_hash, (select id from roles where is_system limit 1) from users where name = 'ravi'`);
  const server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1" });
  await server.start();
  Object.assign(process.env, {
    DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`,
    DATABASE_SSL: "false",
    DATABASE_POOL_SIZE: "1",
    JWT_SECRET: "test-secret-that-is-at-least-32-bytes-long!!",
    NODE_ENV: "test",
  });
  const app = require("../src/app");
  const http = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const sql = require("../src/db");
  return {
    base: `http://127.0.0.1:${http.address().port}/api`,
    sql,
    async stop() { http.close(); await sql.end(); await server.stop(); await db.close(); },
  };
}

/** A tiny API client that keeps its own session cookie. */
function client(base) {
  let cookie = "";
  /** Sends a JSON request and returns { status, body }. */
  async function call(method, url, body) {
    const res = await fetch(base + url, {
      method,
      headers: { "content-type": "application/json", cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const type = res.headers.get("content-type") ?? "";
    return { status: res.status, body: type.includes("json") ? await res.json() : await res.text() };
  }
  return {
    get: (u) => call("GET", u),
    post: (u, b = {}) => call("POST", u, b),
    patch: (u, b) => call("PATCH", u, b),
    del: (u) => call("DELETE", u),
    login: (login, password = "TaskTracker@123") => call("POST", "/auth/login", { identifier: login, password }),
  };
}

module.exports = { start, client };
