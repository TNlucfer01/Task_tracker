// Admin user management. Mounted at /api/admin/users behind requireAuth + requireRole("admin").
//
//   GET    /            list users (?role=admin|user, ?active=true|false)
//   GET    /:id         one user
//   POST   /            create { name, email, password, role?, department_id? }
//   PATCH  /:id         update any of { name, email, role, department_id, is_active, password }
//   DELETE /:id         permanently delete a user who has no history; otherwise deactivate instead
//
// An admin can't change their own role, deactivate themselves or delete themselves,
// so there is always at least one admin who can sign in.

const express = require("express");
const bcrypt = require("bcryptjs");
const supabase = require("../../config/db");
const { HttpError, run, parseId } = require("../../utils/http");
const {
  validName,
  validEmail,
  validPassword,
  validRole,
  validDepartmentId,
  validBoolean,
} = require("../../utils/validate");

const router = express.Router();

// Never select password_hash here.
const PUBLIC_COLUMNS = "id, name, email, role, is_active, department_id, created_at, department:departments(id, name)";
const BCRYPT_ROUNDS = 12;

// Belt and braces: the hash is never selected, but strip it in case a select ever changes.
// eslint-disable-next-line no-unused-vars
const toPublic = ({ password_hash, ...user }) => user;

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// Names are the login username, so they must be unique ignoring case. Emails have a unique index too,
// but checking first gives a clearer message than a database error.
async function assertAvailable({ name, email }, exceptId) {
  const checks = [];
  if (name !== undefined) {
    let q = supabase.from("users").select("id").ilike("name", escapeLike(name)).limit(1);
    if (exceptId) q = q.neq("id", exceptId);
    checks.push(run(q).then(({ data }) => data.length && "That name is already taken. Choose another."));
  }
  if (email !== undefined) {
    let q = supabase.from("users").select("id").ilike("email", escapeLike(email)).limit(1);
    if (exceptId) q = q.neq("id", exceptId);
    checks.push(run(q).then(({ data }) => data.length && "A user with that email already exists."));
  }
  const conflict = (await Promise.all(checks)).find(Boolean);
  if (conflict) {
    throw new HttpError(409, conflict);
  }
}

async function assertDepartmentExists(departmentId) {
  if (departmentId === null || departmentId === undefined) return;
  const { data } = await run(supabase.from("departments").select("id").eq("id", departmentId).maybeSingle());
  if (!data) {
    throw new HttpError(400, "That department doesn't exist.");
  }
}

// Turns database constraint errors into messages an admin can act on.
function translateDbError(error) {
  if (error?.code === "23505") return new HttpError(409, "A user with that email already exists.");
  if (error?.code === "23503") return new HttpError(400, "That department doesn't exist.");
  return error;
}

async function findUser(id) {
  const { data } = await run(supabase.from("users").select(PUBLIC_COLUMNS).eq("id", id).maybeSingle());
  if (!data) {
    throw new HttpError(404, "User not found.");
  }
  return toPublic(data);
}

router.get("/", async (req, res) => {
  let query = supabase.from("users").select(PUBLIC_COLUMNS).order("name");

  if (req.query.role !== undefined) query = query.eq("role", validRole(req.query.role));
  if (req.query.active !== undefined) {
    if (!["true", "false"].includes(req.query.active)) {
      throw new HttpError(400, "active must be true or false.");
    }
    query = query.eq("is_active", req.query.active === "true");
  }

  const { data } = await run(query);
  res.json({ users: data.map(toPublic) });
});

router.get("/:id", async (req, res) => {
  res.json({ user: await findUser(parseId(req.params.id, "user id")) });
});

router.post("/", async (req, res) => {
  const body = req.body ?? {};
  const user = {
    name: validName(body.name),
    email: validEmail(body.email),
    role: body.role === undefined ? "user" : validRole(body.role),
    department_id: body.department_id === undefined ? null : validDepartmentId(body.department_id),
  };
  const password = validPassword(body.password);

  await Promise.all([assertAvailable(user), assertDepartmentExists(user.department_id)]);

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const { data, error } = await supabase
    .from("users")
    .insert({ ...user, password_hash: passwordHash, is_active: true })
    .select(PUBLIC_COLUMNS)
    .single();

  if (error) throw translateDbError(error);
  res.status(201).json({ user: toPublic(data) });
});

router.patch("/:id", async (req, res) => {
  const id = parseId(req.params.id, "user id");
  const body = req.body ?? {};
  const isSelf = Number(res.locals.authUser.id) === id;
  const changes = {};

  if (body.name !== undefined) changes.name = validName(body.name);
  if (body.email !== undefined) changes.email = validEmail(body.email);
  if (body.department_id !== undefined) changes.department_id = validDepartmentId(body.department_id);
  if (body.role !== undefined) changes.role = validRole(body.role);
  if (body.is_active !== undefined) changes.is_active = validBoolean(body.is_active, "is_active");

  const current = await findUser(id);

  if (isSelf && changes.role !== undefined && changes.role !== current.role) {
    throw new HttpError(400, "You can't change your own role. Ask another admin to do it.");
  }
  if (isSelf && changes.is_active === false) {
    throw new HttpError(400, "You can't deactivate your own account.");
  }

  if (body.password !== undefined) {
    changes.password_hash = await bcrypt.hash(validPassword(body.password), BCRYPT_ROUNDS);
  }

  if (Object.keys(changes).length === 0) {
    throw new HttpError(400, "Nothing to update.");
  }

  // Only check names and emails that actually change, so existing near-duplicates
  // (like "Aathi" and "aathi") can still be edited.
  await Promise.all([
    assertAvailable(
      {
        name: changes.name !== undefined && changes.name !== current.name ? changes.name : undefined,
        email: changes.email !== undefined && changes.email !== current.email.toLowerCase() ? changes.email : undefined,
      },
      id,
    ),
    assertDepartmentExists(changes.department_id),
  ]);

  const { data, error } = await supabase.from("users").update(changes).eq("id", id).select(PUBLIC_COLUMNS).single();
  if (error) throw translateDbError(error);
  res.json({ user: toPublic(data) });
});

router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id, "user id");
  if (Number(res.locals.authUser.id) === id) {
    throw new HttpError(400, "You can't delete your own account.");
  }
  await findUser(id);

  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error?.code === "23503") {
    // Tasks, sessions, timers or reviews still point at this user.
    throw new HttpError(
      409,
      "This person has tasks or time records, so they can't be deleted. Deactivate them instead to keep their history.",
    );
  }
  if (error) throw error;
  res.status(204).end();
});

module.exports = router;
