const express = require("express");
const bcrypt = require("bcryptjs");
const supabase = require("../../config/db");
const requirePermission = require("../../middleware/requirePermission");
const { HttpError, run, parseId } = require("../../utils/http");
const { roleKey, hasPermission } = require("../../utils/authorization");
const {
  validName,
  validEmail,
  validPassword,
  validDepartmentId,
  validBoolean,
} = require("../../utils/validate");

const router = express.Router();
const PUBLIC_COLUMNS = "id, name, email, role_id, title, is_active, department_id, created_at, role:roles!users_role_id_fkey(id, name, scope), department:departments!users_department_id_fkey(id, name)";
const ROLE_COLUMNS = "id, name, description, scope, is_system, role_permissions(permission)";
const BCRYPT_ROUNDS = 12;

const toPublic = (user) => ({
  ...user,
  role: user.role?.name ?? null,
  role_key: roleKey(user.role?.name),
  scope: user.role?.scope ?? null,
});

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

async function assertAvailable({ name, email }, exceptId) {
  const checks = [];
  if (name !== undefined) {
    let query = supabase.from("users").select("id").ilike("name", escapeLike(name)).limit(1);
    if (exceptId) query = query.neq("id", exceptId);
    checks.push(run(query).then(({ data }) => data.length && "That name is already taken. Choose another."));
  }
  if (email !== undefined) {
    let query = supabase.from("users").select("id").ilike("email", escapeLike(email)).limit(1);
    if (exceptId) query = query.neq("id", exceptId);
    checks.push(run(query).then(({ data }) => data.length && "A user with that email already exists."));
  }
  const conflict = (await Promise.all(checks)).find(Boolean);
  if (conflict) throw new HttpError(409, conflict);
}

async function findRole(value) {
  let query = supabase.from("roles").select("id, name, scope").limit(1);
  if (typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value))) {
    query = query.eq("id", parseId(value, "role id"));
  } else if (typeof value === "string" && value.trim()) {
    const alias = { user: "Employee", admin: "Admin" }[value.trim().toLowerCase()];
    query = query.ilike("name", escapeLike(alias ?? value.trim()));
  } else {
    throw new HttpError(400, "A valid role is required.");
  }
  const { data } = await run(query);
  if (!data[0]) throw new HttpError(400, "That role doesn't exist.");
  return data[0];
}

async function assertRoleAssignment(role, authUser) {
  if (role.scope !== "own" && !hasPermission(authUser, "roles.manage")) {
    throw new HttpError(403, "You need role-management permission to assign this role.");
  }
}

async function assertDepartmentExists(departmentId) {
  if (departmentId === null || departmentId === undefined) return;
  const { data } = await run(supabase.from("departments").select("id").eq("id", departmentId).maybeSingle());
  if (!data) throw new HttpError(400, "That department doesn't exist.");
}

async function assertNoTimeHistory(userId) {
  const [sessions, logs] = await Promise.all([
    run(supabase.from("work_sessions").select("id").eq("user_id", userId).limit(1)),
    run(supabase.from("task_time_logs").select("id").eq("user_id", userId).limit(1)),
  ]);
  if (sessions.data.length || logs.data.length) {
    throw new HttpError(
      409,
      "This person has time records, so they can't be deleted. Deactivate them instead to keep their history.",
    );
  }
}

function translateDbError(error) {
  if (error?.code === "23505") return new HttpError(409, "A user with that email or name already exists.");
  if (error?.code === "23503") return new HttpError(400, "That role or department doesn't exist.");
  return error;
}

async function findUser(id, authUser) {
  const { data } = await run(supabase.from("users").select(PUBLIC_COLUMNS).eq("id", id).maybeSingle());
  if (!data) throw new HttpError(404, "User not found.");
  if (
    authUser.scope === "own" && data.id !== authUser.id ||
    authUser.scope === "department" && data.department_id !== authUser.department_id
  ) {
    throw new HttpError(404, "User not found.");
  }
  return toPublic(data);
}

router.get("/roles", async (req, res) => {
  const { data } = await run(supabase.from("roles").select(ROLE_COLUMNS).order("id"));
  res.json({
    roles: data.map(({ role_permissions: permissions, ...role }) => ({
      ...role,
      permissions: (permissions ?? []).map((entry) => entry.permission),
    })),
  });
});

router.get("/", async (req, res) => {
  let query = supabase.from("users").select(PUBLIC_COLUMNS).order("name");
  const authUser = res.locals.authUser;
  if (authUser.scope === "own") query = query.eq("id", authUser.id);
  if (authUser.scope === "department") {
    query = authUser.department_id === null
      ? query.is("department_id", null)
      : query.eq("department_id", authUser.department_id);
  }
  if (req.query.role !== undefined) {
    const role = await findRole(req.query.role);
    query = query.eq("role_id", role.id);
  }
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
  res.json({ user: await findUser(parseId(req.params.id, "user id"), res.locals.authUser) });
});

router.post("/", requirePermission("people.manage"), async (req, res) => {
  const body = req.body ?? {};
  const role = await findRole(body.role_id ?? body.role ?? "Employee");
  await assertRoleAssignment(role, res.locals.authUser);

  const user = {
    name: validName(body.name),
    email: validEmail(body.email),
    role_id: role.id,
    department_id: body.department_id === undefined ? null : validDepartmentId(body.department_id),
    title: body.title === undefined || body.title === "" ? null : String(body.title).trim(),
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

router.patch("/:id", requirePermission("people.manage"), async (req, res) => {
  const id = parseId(req.params.id, "user id");
  const body = req.body ?? {};
  const isSelf = Number(res.locals.authUser.id) === id;
  const current = await findUser(id, res.locals.authUser);
  const changes = {};

  if (body.name !== undefined) changes.name = validName(body.name);
  if (body.email !== undefined) changes.email = validEmail(body.email);
  if (body.department_id !== undefined) changes.department_id = validDepartmentId(body.department_id);
  if (body.title !== undefined) changes.title = body.title === null ? null : String(body.title).trim();
  if (body.is_active !== undefined) changes.is_active = validBoolean(body.is_active, "is_active");

  if (body.role_id !== undefined || body.role !== undefined) {
    const role = await findRole(body.role_id ?? body.role);
    await assertRoleAssignment(role, res.locals.authUser);
    changes.role_id = role.id;
  }

  if (isSelf && changes.role_id !== undefined && changes.role_id !== current.role_id) {
    throw new HttpError(400, "You can't change your own role. Ask another admin to do it.");
  }
  if (isSelf && changes.is_active === false) {
    throw new HttpError(400, "You can't deactivate your own account.");
  }

  if (body.password !== undefined) {
    changes.password_hash = await bcrypt.hash(validPassword(body.password), BCRYPT_ROUNDS);
  }
  if (Object.keys(changes).length === 0) throw new HttpError(400, "Nothing to update.");

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

router.delete("/:id", requirePermission("people.manage"), async (req, res) => {
  const id = parseId(req.params.id, "user id");
  if (Number(res.locals.authUser.id) === id) throw new HttpError(400, "You can't delete your own account.");
  await findUser(id, res.locals.authUser);
  await assertNoTimeHistory(id);

  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error?.code === "23503") {
    throw new HttpError(
      409,
      "This person has tasks or time records, so they can't be deleted. Deactivate them instead to keep their history.",
    );
  }
  if (error) throw error;
  res.status(204).end();
});

module.exports = router;
