// Runs one or more .sql files against DATABASE_URL: `npm run sql -- db/migrations/001_rebuild.sql`.
const fs = require("fs");
const path = require("path");
const sql = require("../src/db");

/** Executes each file in order inside its own transaction and reports progress. */
async function main(files) {
  if (!files.length) throw new Error("Pass at least one .sql file.");
  for (const file of files) {
    const text = fs.readFileSync(path.resolve(file), "utf8");
    await sql.begin((tx) => tx.unsafe(text));
    console.log(`ran ${file}`);
  }
}

main(process.argv.slice(2))
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => sql.end());
