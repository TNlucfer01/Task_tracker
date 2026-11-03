// Departments: the list everyone sees, and management for people with departments.manage.
const express = require("express");
const sql = require("../../db");
const v = require("../../lib/validate");
const { HttpError, found } = require("../../lib/http");
const { permit } = require("../../middleware/auth");

const router = express.Router();

/** Loads departments with head, member and project counts. */
async function listDepartments(id) {
  return sql`
    select d.id, d.name, d.description, d.head_id,
           case when h.id is null then null else json_build_object('id', h.id, 'name', h.name) end as head,
           (select count(*) from users u where u.department_id = d.id and u.is_active) as members,
           (select count(*) from projects p where p.department_id = d.id) as projects
    from departments d left join users h on h.id = d.head_id
    ${id ? sql`where d.id = ${id}` : sql``}
    order by lower(d.name)`;
}

/** GET /departments — every department (names are not sensitive). */
router.get("/", async (req, res) => {
  res.json({ departments: await listDepartments() });
});

/** Validates the head: must be an existing person. */
async function validHead(value) {
  if (value === undefined) return undefined;
  const headId = v.nullableId(value, "Department head");
  if (headId) found((await sql`select 1 from users where id = ${headId}`)[0], "That person");
  return headId;
}

/** POST /departments — creates a department. */
router.post("/", permit("departments.manage"), async (req, res) => {
  const b = req.body ?? {};
  const row = {
    name: v.text(b.name, "Department name", { min: 2, max: 60 }),
    description: v.optionalText(b.description, "Description", { max: 300 }) ?? "",
    head_id: (await validHead(b.head_id)) ?? null,
  };
  const [d] = await sql`insert into departments ${sql(row)} returning id`;
  res.status(201).json({ department: (await listDepartments(d.id))[0] });
});

/** PATCH /departments/:id — renames, re-describes or changes the head. */
router.patch("/:id", permit("departments.manage"), async (req, res) => {
  const id = v.id(req.params.id, "department id");
  found((await listDepartments(id))[0], "That department");
  const b = req.body ?? {};
  const changes = {};
  if (b.name !== undefined) changes.name = v.text(b.name, "Department name", { min: 2, max: 60 });
  if (b.description !== undefined) changes.description = v.optionalText(b.description, "Description", { max: 300 });
  if (b.head_id !== undefined) changes.head_id = await validHead(b.head_id);
  if (!Object.keys(changes).length) throw new HttpError(400, "Nothing to change.");
  await sql`update departments set ${sql(changes)} where id = ${id}`;
  res.json({ department: (await listDepartments(id))[0] });
});

/** DELETE /departments/:id — deletes an empty department. */
router.delete("/:id", permit("departments.manage"), async (req, res) => {
  const id = v.id(req.params.id, "department id");
  const d = found((await listDepartments(id))[0], "That department");
  if (d.members > 0 || d.projects > 0) {
    throw new HttpError(409, `Move this department's ${d.members} people and ${d.projects} projects elsewhere before deleting it.`);
  }
  await sql`delete from departments where id = ${id}`;
  res.status(204).end();
});

module.exports = router;
