// Creates (or resets the password of) an Admin account: `npm run create-admin -- <name> <email> <password>`.
const bcrypt = require("bcryptjs");
const sql = require("../src/db");
const v = require("../src/lib/validate");

/** Inserts the admin, or updates the password and role if the email already exists. */
async function main([name, email, password]) {
  const clean = { name: v.personName(name), email: v.email(email), password: v.password(password) };
  const [role] = await sql`select id from roles where is_system order by id limit 1`;
  if (!role) throw new Error("Run the migration first: no Admin role found.");
  const hash = await bcrypt.hash(clean.password, 10);
  const [user] = await sql`
    insert into users (name, email, password_hash, role_id) values (${clean.name}, ${clean.email}, ${hash}, ${role.id})
    on conflict (lower(email)) do update set password_hash = excluded.password_hash, role_id = excluded.role_id, is_active = true
    returning id, name, email`;
  console.log(`Admin ready: ${user.name} <${user.email}> (id ${user.id})`);
}

main(process.argv.slice(2))
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => sql.end());
