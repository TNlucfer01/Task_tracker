// Task rules shared by the task, comment and review modules: loading with visibility, who may
// edit, and validating custom-field values against the project's field definitions.
const sql = require("../../db");
const { HttpError, found } = require("../../lib/http");
const { can } = require("../../middleware/auth");
const { taskFilter } = require("../../access");

/** Columns for a task list row (no body). */
const listColumns = sql`
  t.id, t.number, p.key || '-' || t.number as key, t.title, t.status, t.priority, t.deadline, t.start_date,
  t.estimate_minutes, t.labels, t.properties, t.position, t.created_at, t.updated_at, t.completed_at,
  t.project_id, t.assignee_id, t.reporter_id,
  json_build_object('id', p.id, 'key', p.key, 'name', p.name) as project,
  case when a.id is null then null else json_build_object('id', a.id, 'name', a.name) end as assignee,
  (t.status <> 'done' and t.deadline < now()) as overdue,
  coalesce((select actual_minutes from v_task_time vt where vt.task_id = t.id), 0) as actual_minutes,
  (select count(*) from task_comments c where c.task_id = t.id) as comment_count`;

/** The FROM clause matching listColumns. */
const listFrom = sql`from tasks t join projects p on p.id = t.project_id left join users a on a.id = t.assignee_id`;

/** Loads a task `me` can see (with body), or throws 404. */
async function visibleTask(me, id, tx = sql) {
  const [task] = await tx`
    select ${listColumns}, t.body_md,
           case when r.id is null then null else json_build_object('id', r.id, 'name', r.name) end as reporter,
           p.department_id as project_department_id, p.owner_id as project_owner_id
    ${listFrom} left join users r on r.id = t.reporter_id
    where t.id = ${id} and ${taskFilter(me)}`;
  return found(task, "That task");
}

/** True when `me` may edit this task's content. */
function canEdit(me, task) {
  return task.assignee_id === me.id || task.reporter_id === me.id || can(me, "tasks.edit_any");
}

/** True when `me` may review this task (never your own work, unless you're an admin). */
function canReview(me, task) {
  return can(me, "reviews.perform") && (task.assignee_id !== me.id || me.role.is_system);
}

/** Checks custom-field values against the project's fields; returns the cleaned object. */
function validateProperties(input, fields, { requireAll = false } = {}) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new HttpError(400, "Properties must be an object.");
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    const f = byKey.get(key);
    if (!f) throw new HttpError(400, `This project has no field called "${key}".`);
    if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) continue;
    const fail = (what) => {
      throw new HttpError(400, `${f.label} must be ${what}.`);
    };
    switch (f.type) {
      case "text":
        if (typeof value !== "string" || value.length > 500) fail("text up to 500 characters");
        out[key] = value.trim();
        break;
      case "url":
        if (typeof value !== "string" || !/^https?:\/\/\S+$/.test(value)) fail("a link starting with http:// or https://");
        out[key] = value;
        break;
      case "number":
        if (typeof value !== "number" || !Number.isFinite(value)) fail("a number");
        out[key] = value;
        break;
      case "date":
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail("a date (YYYY-MM-DD)");
        out[key] = value;
        break;
      case "checkbox":
        if (typeof value !== "boolean") fail("checked or unchecked");
        out[key] = value;
        break;
      case "select":
        if (!f.options.includes(value)) fail(`one of: ${f.options.join(", ")}`);
        out[key] = value;
        break;
      case "multi_select":
        if (!Array.isArray(value) || value.some((x) => !f.options.includes(x))) fail(`any of: ${f.options.join(", ")}`);
        out[key] = [...new Set(value)];
        break;
      default:
        fail("a supported value");
    }
  }
  if (requireAll) {
    const missing = fields.filter((f) => f.required && f.type !== "checkbox" && out[f.key] === undefined);
    if (missing.length) throw new HttpError(400, `Fill in ${missing.map((f) => f.label).join(", ")} first.`);
  }
  return out;
}

module.exports = { listColumns, listFrom, visibleTask, canEdit, canReview, validateProperties };
