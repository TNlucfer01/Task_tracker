// Projects and their custom task fields.
const express = require("express");
const sql = require("../../db");
const v = require("../../lib/validate");
const { HttpError, found, forbid } = require("../../lib/http");
const { can } = require("../../middleware/auth");
const { projectFilter, canManageProject } = require("../../access");

const router = express.Router();
const STATUSES = ["planned", "active", "on_hold", "completed"];
const FIELD_TYPES = ["text", "number", "date", "select", "multi_select", "checkbox", "url"];

/** Project columns with owner, department and task progress. */
const projectColumns = sql`
  p.id, p.key, p.name, p.description_md, p.status, p.start_date, p.deadline, p.completed_at, p.created_at, p.updated_at,
  p.department_id, p.owner_id,
  case when d.id is null then null else json_build_object('id', d.id, 'name', d.name) end as department,
  case when o.id is null then null else json_build_object('id', o.id, 'name', o.name) end as owner,
  (select count(*) from tasks t where t.project_id = p.id) as task_count,
  (select count(*) from tasks t where t.project_id = p.id and t.status = 'done') as tasks_done,
  (select count(*) from tasks t where t.project_id = p.id and t.status <> 'done' and t.deadline < now()) as tasks_overdue,
  (select coalesce(jsonb_object_agg(s, c), '{}') from (select status as s, count(*) as c from tasks t where t.project_id = p.id group by status) x) as tasks_by_status`;

/** Fields for one project, in display order. */
async function fieldsFor(projectId) {
  return sql`select id, key, label, type, options, required, position from project_fields where project_id = ${projectId} order by position, id`;
}

/** Loads a project if `me` can see it; 404 otherwise. */
async function visibleProject(me, id) {
  const [p] = await sql`select ${projectColumns} from projects p left join departments d on d.id = p.department_id
                        left join users o on o.id = p.owner_id where p.id = ${id} and ${projectFilter(me)}`;
  return found(p, "That project");
}

/** Adds progress % and overdue flag to a project row. */
function withProgress(p) {
  return {
    ...p,
    progress_pct: p.task_count ? Math.round((100 * p.tasks_done) / p.task_count) : 0,
    overdue: p.status !== "completed" && p.deadline !== null && new Date(p.deadline) < Date.now(),
  };
}

/** Requires projects.manage for this specific project. */
function assertManage(me, project) {
  if (!canManageProject(me, project)) forbid("You can't change this project.");
}

/** GET /projects — projects you can see (?status). */
router.get("/", async (req, res) => {
  const me = res.locals.me;
  const status = req.query.status ? v.oneOf(req.query.status, STATUSES, "status") : null;
  const rows = await sql`
    select ${projectColumns} from projects p left join departments d on d.id = p.department_id left join users o on o.id = p.owner_id
    where ${projectFilter(me)} ${status ? sql`and p.status = ${status}` : sql``}
    order by case p.status when 'active' then 0 when 'planned' then 1 when 'on_hold' then 2 else 3 end, p.deadline nulls last, p.name`;
  res.json({ projects: rows.map(withProgress) });
});

/** GET /projects/:id — one project with its custom fields and what you can do with it. */
router.get("/:id", async (req, res) => {
  const me = res.locals.me;
  const project = withProgress(await visibleProject(me, v.id(req.params.id, "project id")));
  res.json({ project: { ...project, fields: await fieldsFor(project.id), can_manage: canManageProject(me, project) } });
});

/** Validates project fields from a request body (all optional on update). */
async function parseProject(b, me, partial) {
  const out = {};
  if (!partial || b.key !== undefined) {
    out.key = v.text(b.key, "Project key", { min: 2, max: 10 }).toUpperCase();
    if (!/^[A-Z][A-Z0-9]{1,9}$/.test(out.key)) throw new HttpError(400, "Project key must be 2 to 10 letters or digits, starting with a letter.");
  }
  if (!partial || b.name !== undefined) out.name = v.text(b.name, "Project name", { min: 2, max: 120 });
  if (b.description_md !== undefined) out.description_md = v.optionalText(b.description_md, "Description", { max: 20000 });
  if (b.status !== undefined) out.status = v.oneOf(b.status, STATUSES, "Status");
  if (b.start_date !== undefined) out.start_date = v.day(b.start_date, "Start date");
  if (b.deadline !== undefined) out.deadline = v.timestamp(b.deadline, "Deadline");
  if (b.owner_id !== undefined) {
    out.owner_id = v.nullableId(b.owner_id, "Owner");
    if (out.owner_id) found((await sql`select 1 from users where id = ${out.owner_id} and is_active`)[0], "That owner");
  }
  if (b.department_id !== undefined) {
    out.department_id = v.nullableId(b.department_id, "Department");
    if (out.department_id) found((await sql`select 1 from departments where id = ${out.department_id}`)[0], "That department");
  }
  // Department-scoped managers can only run projects in their own department.
  if (me.role.scope !== "all" && out.department_id !== undefined && out.department_id !== me.department_id) {
    forbid("You can only put projects in your own department.");
  }
  if (out.status === "completed") out.completed_at = new Date().toISOString();
  else if (out.status) out.completed_at = null;
  return out;
}

/** POST /projects — creates a project. */
router.post("/", async (req, res) => {
  const me = res.locals.me;
  if (!can(me, "projects.manage")) forbid();
  const body = { department_id: me.role.scope === "all" ? null : me.department_id, owner_id: me.id, ...(req.body ?? {}) };
  const row = await parseProject(body, me, false);
  const [p] = await sql`insert into projects ${sql({ ...row, created_by: me.id })} returning id`;
  res.status(201).json({ project: withProgress(await visibleProject(me, p.id)) });
});

/** PATCH /projects/:id — edits a project. */
router.patch("/:id", async (req, res) => {
  const me = res.locals.me;
  const project = await visibleProject(me, v.id(req.params.id, "project id"));
  assertManage(me, project);
  const changes = await parseProject(req.body ?? {}, me, true);
  if (!Object.keys(changes).length) throw new HttpError(400, "Nothing to change.");
  await sql`update projects set ${sql(changes)} where id = ${project.id}`;
  res.json({ project: withProgress(await visibleProject(me, project.id)) });
});

/** DELETE /projects/:id — deletes a project that has no tasks yet. */
router.delete("/:id", async (req, res) => {
  const me = res.locals.me;
  const project = await visibleProject(me, v.id(req.params.id, "project id"));
  assertManage(me, project);
  if (project.task_count > 0) throw new HttpError(409, "This project has tasks. Mark it Completed instead, so its history is kept.");
  await sql`delete from projects where id = ${project.id}`;
  res.status(204).end();
});

/** Validates a custom field definition. */
function parseField(b, partial) {
  const out = {};
  if (!partial || b.label !== undefined) out.label = v.text(b.label, "Field name", { max: 60 });
  if (!partial) {
    out.key = (typeof b.key === "string" && b.key ? b.key : out.label).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(out.key)) throw new HttpError(400, "Field name must start with a letter.");
    out.type = v.oneOf(b.type, FIELD_TYPES, "Field type");
  }
  if (b.options !== undefined) {
    if (!Array.isArray(b.options)) throw new HttpError(400, "Options must be a list.");
    out.options = [...new Set(b.options.map((o) => v.text(o, "Each option", { max: 60 })))];
  }
  if (b.required !== undefined) out.required = v.bool(b.required, "Required");
  if (b.position !== undefined) out.position = v.int(b.position, "Position", { min: 0, max: 1000 });
  return out;
}

/** POST /projects/:id/fields — adds a custom field. */
router.post("/:id/fields", async (req, res) => {
  const me = res.locals.me;
  const project = await visibleProject(me, v.id(req.params.id, "project id"));
  assertManage(me, project);
  const field = parseField(req.body ?? {}, false);
  if (["select", "multi_select"].includes(field.type) && !field.options?.length) throw new HttpError(400, "Add at least one option.");
  await sql`insert into project_fields ${sql({ ...field, project_id: project.id })}`;
  res.status(201).json({ fields: await fieldsFor(project.id) });
});

/** PATCH /projects/:id/fields/:fieldId — renames a field or changes its options. */
router.patch("/:id/fields/:fieldId", async (req, res) => {
  const me = res.locals.me;
  const project = await visibleProject(me, v.id(req.params.id, "project id"));
  assertManage(me, project);
  const changes = parseField(req.body ?? {}, true);
  if (!Object.keys(changes).length) throw new HttpError(400, "Nothing to change.");
  const [row] = await sql`update project_fields set ${sql(changes)} where id = ${v.id(req.params.fieldId, "field id")} and project_id = ${project.id} returning id`;
  found(row, "That field");
  res.json({ fields: await fieldsFor(project.id) });
});

/** DELETE /projects/:id/fields/:fieldId — removes a field and its values from every task. */
router.delete("/:id/fields/:fieldId", async (req, res) => {
  const me = res.locals.me;
  const project = await visibleProject(me, v.id(req.params.id, "project id"));
  assertManage(me, project);
  await sql.begin(async (tx) => {
    const [field] = await tx`delete from project_fields where id = ${v.id(req.params.fieldId, "field id")} and project_id = ${project.id} returning key`;
    found(field, "That field");
    await tx`update tasks set properties = properties - ${field.key} where project_id = ${project.id}`;
  });
  res.json({ fields: await fieldsFor(project.id) });
});

module.exports = { router, fieldsFor, visibleProject, withProgress };
