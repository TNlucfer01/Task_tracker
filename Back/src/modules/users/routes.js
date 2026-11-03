// People accounts: listing, pickers, and admin management (add, edit, deactivate, delete).
const express = require("express");
const bcrypt = require("bcryptjs");
const sql = require("../../db");
const v = require("../../lib/validate");
const { HttpError, found, forbid } = require("../../lib/http");
const { permit, can } = require("../../middleware/auth");
const { peopleFilter } = require("../../access");

const router = express.Router();

/** Selects a user's public fields (never the password hash). */
const userColumns = sql`
  u.id, u.name, u.email, u.title, u.is_active, u.created_at, u.department_id, u.role_id,
  json_build_object('id', r.id, 'name', r.name, 'scope', r.scope) as role,
  case when d.id is null then null else json_build_object('id', d.id, 'name', d.name) end as department`;

/** Loads one user with role and department, or undefined. */
async function getUser(id) {
  const [u] = await sql`select ${userColumns} from users u join roles r on r.id = u.role_id
                        left join departments d on d.id = u.department_id where u.id = ${id}`;
  return u;
}

/** GET /users/options — active people you can see, for assignee and mention pickers. */
router.get("/options", async (req, res) => {
  const me = res.locals.me;
  const rows = await sql`
    select u.id, u.name, u.title, u.department_id, d.name as department_name
    from users u left join departments d on d.id = u.department_id
    where u.is_active and ${peopleFilter(me)} order by lower(u.name)`;
  res.json({ users: rows });
});

/** GET /users — everyone you can see, with filters (?q, ?department_id, ?role_id, ?active). */
router.get("/", async (req, res) => {
  const me = res.locals.me;
  if (!can(me, "people.view") && !can(me, "people.manage")) forbid();
  const q = typeof req.query.q === "string" && req.query.q.trim() ? `%${req.query.q.trim().toLowerCase()}%` : null;
  const dept = req.query.department_id ? v.id(req.query.department_id, "department_id") : null;
  const role = req.query.role_id ? v.id(req.query.role_id, "role_id") : null;
  const active = req.query.active === "true" ? true : req.query.active === "false" ? false : null;
  const rows = await sql`
    select ${userColumns} from users u join roles r on r.id = u.role_id left join departments d on d.id = u.department_id
    where ${peopleFilter(me)}
      ${q ? sql`and (lower(u.name) like ${q} or lower(u.email) like ${q} or lower(u.title) like ${q})` : sql``}
      ${dept ? sql`and u.department_id = ${dept}` : sql``}
      ${role ? sql`and u.role_id = ${role}` : sql``}
      ${active === null ? sql`` : sql`and u.is_active = ${active}`}
    order by lower(u.name)`;
  res.json({ users: rows });
});

/** GET /users/:id — one person's account details. */
router.get("/:id", async (req, res) => {
  const me = res.locals.me;
  const userId = v.id(req.params.id, "user id");
  const [visible] = await sql`select 1 from users u where u.id = ${userId} and ${peopleFilter(me)}`;
  if (!visible && userId !== me.id) throw new HttpError(404, "That person wasn't found.");
  res.json({ user: found(await getUser(userId), "That person") });
});

/** Checks that a role and department exist before using them. */
async function assertRefs(roleId, departmentId) {
  if (roleId !== undefined) found((await sql`select 1 from roles where id = ${roleId}`)[0], "That role");
  if (departmentId) found((await sql`select 1 from departments where id = ${departmentId}`)[0], "That department");
}

/** Only an Admin-role holder can hand out the Admin role. */
async function assertCanGrantRole(me, roleId) {
  const [role] = await sql`select is_system from roles where id = ${roleId}`;
  if (role?.is_system && !me.role.is_system) forbid("Only admins can give someone the Admin role.");
}

/** POST /users — adds a person with a starting password. */
router.post("/", permit("people.manage"), async (req, res) => {
  const b = req.body ?? {};
  const user = {
    name: v.personName(b.name),
    email: v.email(b.email),
    title: v.optionalText(b.title, "Job title", { max: 80 }) ?? "",
    role_id: v.id(b.role_id, "Role"),
    department_id: b.department_id === undefined ? null : v.nullableId(b.department_id, "Department"),
  };
  const password = v.password(b.password);
  await assertRefs(user.role_id, user.department_id);
  await assertCanGrantRole(res.locals.me, user.role_id);
  const [row] = await sql`insert into users ${sql({ ...user, password_hash: await bcrypt.hash(password, 12) })} returning id`;
  res.status(201).json({ user: await getUser(row.id) });
});

/** PATCH /users/:id — edits a person; you can't change your own role or deactivate yourself. */
router.patch("/:id", permit("people.manage"), async (req, res) => {
  const me = res.locals.me;
  const userId = v.id(req.params.id, "user id");
  const current = found(await getUser(userId), "That person");
  const b = req.body ?? {};
  const changes = {};
  if (b.name !== undefined) changes.name = v.personName(b.name);
  if (b.email !== undefined) changes.email = v.email(b.email);
  if (b.title !== undefined) changes.title = v.optionalText(b.title, "Job title", { max: 80 });
  if (b.department_id !== undefined) changes.department_id = v.nullableId(b.department_id, "Department");
  if (b.role_id !== undefined) changes.role_id = v.id(b.role_id, "Role");
  if (b.is_active !== undefined) changes.is_active = v.bool(b.is_active, "Active");
  if (b.password !== undefined) changes.password_hash = await bcrypt.hash(v.password(b.password), 12);
  if (!Object.keys(changes).length) throw new HttpError(400, "Nothing to change.");

  if (userId === me.id && changes.role_id !== undefined && changes.role_id !== current.role_id) {
    throw new HttpError(400, "You can't change your own role. Ask another admin.");
  }
  if (userId === me.id && changes.is_active === false) throw new HttpError(400, "You can't deactivate your own account.");
  const [target] = await sql`select r.is_system from users u join roles r on r.id = u.role_id where u.id = ${userId}`;
  if (target.is_system && !me.role.is_system) forbid("Only admins can edit an admin's account.");
  await assertRefs(changes.role_id, changes.department_id);
  if (changes.role_id !== undefined) await assertCanGrantRole(me, changes.role_id);

  await sql`update users set ${sql(changes)} where id = ${userId}`;
  res.json({ user: await getUser(userId) });
});

/** DELETE /users/:id — deletes someone with no history; anyone with history must be deactivated. */
router.delete("/:id", permit("people.manage"), async (req, res) => {
  const me = res.locals.me;
  const userId = v.id(req.params.id, "user id");
  if (userId === me.id) throw new HttpError(400, "You can't delete your own account.");
  found(await getUser(userId), "That person");
  const [history] = await sql`
    select (select count(*) from tasks where assignee_id = ${userId} or reporter_id = ${userId})
         + (select count(*) from work_sessions where user_id = ${userId})
         + (select count(*) from task_reviews where reviewer_id = ${userId} or assignee_id = ${userId})
         + (select count(*) from task_comments where author_id = ${userId}) as n`;
  if (history.n > 0) {
    throw new HttpError(409, "This person has tasks, time or reviews, so they can't be deleted. Deactivate them instead to keep their history.");
  }
  await sql`delete from users where id = ${userId}`;
  res.status(204).end();
});

module.exports = router;
