// Roles and the permission catalogue. A role bundles permissions with a data scope.
const express = require("express");
const sql = require("../../db");
const v = require("../../lib/validate");
const { HttpError, found } = require("../../lib/http");
const { permit, permitAny } = require("../../middleware/auth");

const router = express.Router();
const SCOPES = ["all", "department", "own"];

/** Loads every role with its permissions and member count. */
async function listRoles() {
  return sql`
    select r.id, r.name, r.description, r.scope, r.is_system,
           coalesce(array_agg(distinct rp.permission) filter (where rp.permission is not null), '{}') as permissions,
           (select count(*) from users u where u.role_id = r.id) as members
    from roles r left join role_permissions rp on rp.role_id = r.id
    group by r.id order by r.is_system desc, lower(r.name)`;
}

/** Validates a permission list against the catalogue. */
async function validPermissions(list) {
  if (!Array.isArray(list)) throw new HttpError(400, "Permissions must be a list.");
  const known = new Set((await sql`select key from permissions`).map((p) => p.key));
  const unknown = list.filter((p) => !known.has(p));
  if (unknown.length) throw new HttpError(400, `Unknown permissions: ${unknown.join(", ")}.`);
  return [...new Set(list)];
}

/** GET /roles/permissions — the catalogue, grouped for the role editor. */
router.get("/permissions", permitAny("roles.manage", "people.manage"), async (req, res) => {
  res.json({ permissions: await sql`select key, label, grp as "group", description from permissions order by position` });
});

/** GET /roles — all roles, for the role editor and the person form. */
router.get("/", permitAny("roles.manage", "people.manage"), async (req, res) => {
  res.json({ roles: await listRoles() });
});

/** POST /roles — creates a role. */
router.post("/", permit("roles.manage"), async (req, res) => {
  const b = req.body ?? {};
  const name = v.text(b.name, "Role name", { min: 2, max: 40 });
  const description = v.optionalText(b.description, "Description", { max: 200 }) ?? "";
  const scope = v.oneOf(b.scope ?? "own", SCOPES, "Scope");
  const permissions = await validPermissions(b.permissions ?? []);
  const id = await sql.begin(async (tx) => {
    const [role] = await tx`insert into roles (name, description, scope) values (${name}, ${description}, ${scope}) returning id`;
    if (permissions.length) await tx`insert into role_permissions ${tx(permissions.map((p) => ({ role_id: role.id, permission: p })))}`;
    return role.id;
  });
  res.status(201).json({ role: (await listRoles()).find((r) => r.id === id) });
});

/** PATCH /roles/:id — renames a role, changes its scope, or replaces its permissions. */
router.patch("/:id", permit("roles.manage"), async (req, res) => {
  const roleId = v.id(req.params.id, "role id");
  const [role] = await sql`select * from roles where id = ${roleId}`;
  found(role, "That role");
  const b = req.body ?? {};
  if (role.is_system && (b.scope !== undefined || b.permissions !== undefined)) {
    throw new HttpError(400, "The Admin role always has every permission across the whole company.");
  }
  const changes = {};
  if (b.name !== undefined) changes.name = v.text(b.name, "Role name", { min: 2, max: 40 });
  if (b.description !== undefined) changes.description = v.optionalText(b.description, "Description", { max: 200 });
  if (b.scope !== undefined) changes.scope = v.oneOf(b.scope, SCOPES, "Scope");
  const permissions = b.permissions === undefined ? undefined : await validPermissions(b.permissions);
  await sql.begin(async (tx) => {
    if (Object.keys(changes).length) await tx`update roles set ${tx(changes)} where id = ${roleId}`;
    if (permissions) {
      await tx`delete from role_permissions where role_id = ${roleId}`;
      if (permissions.length) await tx`insert into role_permissions ${tx(permissions.map((p) => ({ role_id: roleId, permission: p })))}`;
    }
  });
  res.json({ role: (await listRoles()).find((r) => r.id === roleId) });
});

/** DELETE /roles/:id — deletes an unused, non-system role. */
router.delete("/:id", permit("roles.manage"), async (req, res) => {
  const roleId = v.id(req.params.id, "role id");
  const [role] = await sql`select is_system, (select count(*) from users where role_id = ${roleId}) as members from roles where id = ${roleId}`;
  found(role, "That role");
  if (role.is_system) throw new HttpError(400, "The Admin role can't be deleted.");
  if (role.members > 0) throw new HttpError(409, `${role.members} people have this role. Give them another role first.`);
  await sql`delete from roles where id = ${roleId}`;
  res.status(204).end();
});

module.exports = router;
