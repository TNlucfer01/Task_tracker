// Seeds a few dummy users into the Supabase `users` table for local development.
// Usage (from Back/):  npm run seed
// Safe to run more than once: users whose email or name already exists are skipped.
// Override the shared dev password with SEED_PASSWORD=... npm run seed

const bcrypt = require("bcryptjs");
const supabase = require("../config/db");

const password = process.env.SEED_PASSWORD || "TaskTracker@123";

const dummyUsers = [
  { name: "aathi", email: "aathi@example.com" },
  { name: "priya", email: "priya@example.com" },
  { name: "karthik", email: "karthik@example.com" },
];

async function exists(column, value) {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq(column, value)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);
  let created = 0;

  for (const user of dummyUsers) {
    const email = user.email.toLowerCase();

    if ((await exists("email", email)) || (await exists("name", user.name))) {
      console.log(`skip    ${user.name} <${email}> (already exists)`);
      continue;
    }

    const { data, error } = await supabase
      .from("users")
      .insert({ name: user.name, email, password_hash: passwordHash })
      .select("id, name, email")
      .single();

    if (error) throw error;

    created += 1;
    console.log(`created ${data.name} <${data.email}> id=${data.id}`);
  }

  console.log(`\nDone: ${created} created. Log in with any of them using the seed password.`);
}

main().catch((error) => {
  console.error("Seeding failed:", error.message ?? error);
  process.exit(1);
});
