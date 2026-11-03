// The shared Postgres connection. Use the tagged template `sql` for every query: values are
// always sent as parameters, never spliced into the SQL text.
const postgres = require("postgres");
const config = require("./config");

const sql = postgres(config.databaseUrl, {
  ssl: config.databaseSsl ? "require" : false,
  max: Number(process.env.DATABASE_POOL_SIZE) || 10,
  idle_timeout: 30,
  prepare: false, // required by Supabase's transaction pooler
  types: {
    // bigint ids and counts as plain numbers (safe below 2^53), dates as YYYY-MM-DD strings.
    bigint: { to: 20, from: [20], serialize: (x) => String(x), parse: (x) => Number(x) },
    date: { to: 1082, from: [1082], serialize: (x) => x, parse: (x) => x },
    numeric: { to: 1700, from: [1700], serialize: (x) => String(x), parse: (x) => Number(x) },
  },
});

module.exports = sql;
