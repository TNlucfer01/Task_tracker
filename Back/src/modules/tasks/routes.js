// Tasks: list and board, the task page (Markdown body + properties), create, edit, delete,
// submit for review, and .md import/export.
const express = require("express");
const sql = require("../../db");
const v = require("../../lib/validate");
const { HttpError, found, forbid } = require("../../lib/http");
const { can } = require("../../middleware/auth");
const { taskFilter, projectFilter, canSeeUser } = require("../../access");
const { taskToMarkdown, parseMarkdown } = require("../../lib/markdown");
const { notify, reviewersFor } = require("../notifications/service");
const { fieldsFor } = require("../projects/routes");
const { listColumns, listFrom, visibleTask, canEdit, canReview, validateProperties } = require("./service");

const router = express.Router();
const STATUSES = ["todo", "in_progress", "in_review", "rework", "done"];
const PRIORITIES = ["low", "medium", "high", "urgent"];
// Statuses you can set directly. In review goes through /submit; Done and Rework only through a review.
const SETTABLE = ["todo", "in_progress"];
const SORTS = {
  updated: sql`t.updated_at desc`,
  deadline: sql`t.deadline asc nulls last, t.id`,
  priority: sql`case t.priority when 'urgent' then 0 when 'high' then 1 when 'medium' then 2 else 3 end, t.deadline asc nulls last`,
  created: sql`t.created_at desc`,
  board: sql`t.position asc, t.id`,
};

/** GET /tasks — tasks you can see, with filters for the list and the board. */
router.get("/", async (req, res) => {
  const me = res.locals.me;
  const q = req.query;
  const project = q.project_id ? v.id(q.project_id, "project_id") : null;
  const statuses = q.status ? String(q.status).split(",").map((s) => v.oneOf(s, STATUSES, "status")) : null;
  const assignee = q.assignee === "me" ? me.id : q.assignee === "none" ? "none" : q.assignee ? v.id(q.assignee, "assignee") : null;
  const priority = q.priority ? v.oneOf(q.priority, PRIORITIES, "priority") : null;
  const label = typeof q.label === "string" && q.label ? q.label.toLowerCase() : null;
  const search = typeof q.q === "string" && q.q.trim() ? `%${q.q.trim().toLowerCase()}%` : null;
  const department = q.department_id ? v.id(q.department_id, "department_id") : null;
  const sort = SORTS[q.sort] ?? SORTS.updated;
  const limit = q.limit ? v.int(q.limit, "limit", { min: 1, max: 500 }) : 300;

  const rows = await sql`
    select ${listColumns} ${listFrom}
    where ${taskFilter(me)}
      ${project ? sql`and t.project_id = ${project}` : sql``}
      ${statuses ? sql`and t.status = any(${statuses}::task_status[])` : sql``}
      ${assignee === "none" ? sql`and t.assignee_id is null` : assignee ? sql`and t.assignee_id = ${assignee}` : sql``}
      ${priority ? sql`and t.priority = ${priority}` : sql``}
      ${label ? sql`and ${label} = any(t.labels)` : sql``}
      ${search ? sql`and (lower(t.title) like ${search} or lower(p.key || '-' || t.number) like ${search})` : sql``}
      ${department ? sql`and a.department_id = ${department}` : sql``}
      ${q.overdue === "true" ? sql`and t.status <> 'done' and t.deadline < now()` : sql``}
      ${q.due_within ? sql`and t.status <> 'done' and t.deadline between now() and now() + ${v.int(q.due_within, "due_within", { min: 1, max: 90 }) + " days"}::interval` : sql``}
    order by ${sort} limit ${limit}`;
  res.json({ tasks: rows });
});

/** GET /tasks/:id — the full task page: body, properties, fields, reviews, history and what you can do. */
router.get("/:id", async (req, res) => {
  const me = res.locals.me;
  const task = await visibleTask(me, v.id(req.params.id, "task id"));
  const [fields, reviews, events, comments, timer] = await Promise.all([
    fieldsFor(task.project_id),
    sql`select rv.id, rv.decision, rv.rating, rv.comment, rv.created_at,
               case when u.id is null then null else json_build_object('id', u.id, 'name', u.name) end as reviewer
        from task_reviews rv left join users u on u.id = rv.reviewer_id where rv.task_id = ${task.id} order by rv.created_at desc`,
    sql`select e.id, e.type, e.data, e.created_at,
               case when u.id is null then null else json_build_object('id', u.id, 'name', u.name) end as actor
        from task_events e left join users u on u.id = e.actor_id where e.task_id = ${task.id} order by e.created_at desc limit 100`,
    sql`select c.id, c.body_md, c.created_at, c.edited_at, c.author_id,
               case when u.id is null then null else json_build_object('id', u.id, 'name', u.name) end as author
        from task_comments c left join users u on u.id = c.author_id where c.task_id = ${task.id} order by c.created_at`,
    sql`select id, started_at from task_time_logs where task_id = ${task.id} and user_id = ${me.id} and ended_at is null`,
  ]);
  res.json({
    task: {
      ...task,
      fields,
      reviews,
      events,
      comments,
      my_running_timer: timer[0] ?? null,
      can: {
        edit: canEdit(me, task),
        assign: can(me, "tasks.assign"),
        delete: can(me, "tasks.delete"),
        review: canReview(me, task) && task.status === "in_review",
        submit: task.assignee_id === me.id && ["todo", "in_progress", "rework"].includes(task.status),
        comment: true,
        track_time: can(me, "time.track") && task.assignee_id === me.id && task.status !== "done",
      },
    },
  });
});

/** Checks the person can be assigned by `me`: yourself always; others need tasks.assign and visibility. */
async function validAssignee(me, value) {
  const id = v.nullableId(value, "Assignee");
  if (id === null || id === me.id) return id;
  if (!can(me, "tasks.assign")) forbid("You can only assign tasks to yourself.");
  const [u] = await sql`select is_active from users where id = ${id}`;
  if (!u?.is_active || !(await canSeeUser(me, id))) throw new HttpError(400, "You can't assign work to that person.");
  return id;
}

/** Validates the editable task fields present in a request body. */
async function parseTask(b, me, fields, { creating }) {
  const out = {};
  if (creating || b.title !== undefined) out.title = v.text(b.title, "Title", { max: 200 });
  if (b.body_md !== undefined) out.body_md = v.optionalText(b.body_md, "Description", { max: 100000 });
  if (b.priority !== undefined) out.priority = v.oneOf(b.priority, PRIORITIES, "Priority");
  if (b.deadline !== undefined) out.deadline = v.timestamp(b.deadline, "Deadline");
  if (b.start_date !== undefined) out.start_date = v.day(b.start_date, "Start date");
  if (b.estimate_minutes !== undefined) out.estimate_minutes = b.estimate_minutes === null ? null : v.int(b.estimate_minutes, "Estimate", { min: 1, max: 100000 });
  if (b.labels !== undefined) out.labels = v.labels(b.labels);
  if (b.properties !== undefined) out.properties = validateProperties(b.properties, fields);
  if (b.assignee_id !== undefined) out.assignee_id = await validAssignee(me, b.assignee_id);
  if (b.position !== undefined) {
    const n = Number(b.position);
    if (!Number.isFinite(n)) throw new HttpError(400, "Position must be a number.");
    out.position = n;
  }
  return out;
}

/** Loads a project for creating tasks in, checking it is visible. */
async function projectForNewTask(me, projectId) {
  const [project] = await sql`select p.id, p.key, p.status from projects p where p.id = ${projectId} and ${projectFilter(me)}`;
  found(project, "That project");
  if (project.status === "completed") throw new HttpError(400, "This project is completed. Reopen it to add tasks.");
  return project;
}

/** Inserts a task inside a transaction, notifying the assignee. Returns the new id. */
async function createTask(tx, me, project, row) {
  const [task] = await tx`insert into tasks ${tx({ ...row, project_id: project.id, reporter_id: me.id, updated_by: me.id })} returning id, number, assignee_id`;
  if (task.assignee_id) {
    await notify(tx, { userIds: [task.assignee_id], type: "assigned", title: `You were assigned ${project.key}-${task.number}`, body: row.title, taskId: task.id, actorId: me.id });
  }
  return task.id;
}

/** POST /tasks — creates a task (you're the assignee unless you can assign others). */
router.post("/", async (req, res) => {
  const me = res.locals.me;
  if (!can(me, "tasks.create")) forbid("You can't create tasks.");
  const b = req.body ?? {};
  const project = await projectForNewTask(me, v.id(b.project_id, "Project"));
  const fields = await fieldsFor(project.id);
  const row = await parseTask({ assignee_id: me.id, ...b }, me, fields, { creating: true });
  if (b.status !== undefined) row.status = v.oneOf(b.status, SETTABLE, "Status");
  const id = await sql.begin((tx) => createTask(tx, me, project, row));
  res.status(201).json({ task: await visibleTask(me, id) });
});

/** PATCH /tasks/:id — edits a task. Status can only move between Not started and In progress here. */
router.patch("/:id", async (req, res) => {
  const me = res.locals.me;
  const task = await visibleTask(me, v.id(req.params.id, "task id"));
  const b = req.body ?? {};
  const onlyBoardMove = Object.keys(b).every((k) => ["status", "position"].includes(k));
  if (!canEdit(me, task) && !(onlyBoardMove && task.assignee_id === me.id)) forbid("You can't edit this task.");
  const fields = await fieldsFor(task.project_id);
  const changes = await parseTask(b, me, fields, { creating: false });
  if (b.status !== undefined && b.status !== task.status) {
    if (b.status === "in_review") throw new HttpError(400, "Use Submit for review, so a reviewer is notified.");
    if (b.status === "done" || b.status === "rework") throw new HttpError(400, "Only a reviewer can mark work done or send it back.");
    if (task.status === "done") throw new HttpError(400, "Finished work can't be reopened here. Ask a reviewer.");
    changes.status = v.oneOf(b.status, SETTABLE, "Status");
  }
  if (!Object.keys(changes).length) throw new HttpError(400, "Nothing to change.");

  await sql.begin(async (tx) => {
    await tx`update tasks set ${tx({ ...changes, updated_by: me.id })} where id = ${task.id}`;
    const edited = Object.keys(changes).filter((k) => !["status", "assignee_id", "position"].includes(k));
    if (edited.length) await tx`insert into task_events (task_id, actor_id, type, data) values (${task.id}, ${me.id}, 'updated', ${tx.json({ fields: edited })})`;
    if (changes.assignee_id && changes.assignee_id !== task.assignee_id) {
      await notify(tx, { userIds: [changes.assignee_id], type: "assigned", title: `You were assigned ${task.key}`, body: changes.title ?? task.title, taskId: task.id, actorId: me.id });
    }
  });
  res.json({ task: await visibleTask(me, task.id) });
});

/** DELETE /tasks/:id — deletes a task and everything attached to it. */
router.delete("/:id", async (req, res) => {
  const me = res.locals.me;
  if (!can(me, "tasks.delete")) forbid("You can't delete tasks.");
  const task = await visibleTask(me, v.id(req.params.id, "task id"));
  await sql`delete from tasks where id = ${task.id}`;
  res.status(204).end();
});

/** POST /tasks/:id/submit — the assignee hands work in for review; reviewers are notified. */
router.post("/:id/submit", async (req, res) => {
  const me = res.locals.me;
  const task = await visibleTask(me, v.id(req.params.id, "task id"));
  if (task.assignee_id !== me.id) forbid("Only the person assigned can submit this for review.");
  if (!["todo", "in_progress", "rework"].includes(task.status)) throw new HttpError(400, "This task can't be submitted right now.");
  validateProperties(task.properties, await fieldsFor(task.project_id), { requireAll: true });
  await sql.begin(async (tx) => {
    await tx`update tasks set status = 'in_review', updated_by = ${me.id} where id = ${task.id}`;
    await tx`update task_time_logs set ended_at = now() where user_id = ${me.id} and task_id = ${task.id} and ended_at is null`;
    await notify(tx, { userIds: await reviewersFor(tx, task), type: "review_requested", title: `${task.key} is ready for review`, body: task.title, taskId: task.id, actorId: me.id });
  });
  res.json({ task: await visibleTask(me, task.id) });
});

/** GET /tasks/:id/markdown — downloads the task as a .md file with its properties. */
router.get("/:id/markdown", async (req, res) => {
  const task = await visibleTask(res.locals.me, v.id(req.params.id, "task id"));
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${task.key}.md"`);
  res.send(taskToMarkdown(task));
});

/** POST /tasks/import — creates a task from a .md file ({ project_id, markdown }). */
router.post("/import", async (req, res) => {
  const me = res.locals.me;
  if (!can(me, "tasks.create")) forbid("You can't create tasks.");
  const project = await projectForNewTask(me, v.id(req.body?.project_id, "Project"));
  const { front, body } = parseMarkdown(req.body?.markdown);
  let assignee = me.id;
  if (typeof front.assignee === "string" && front.assignee.trim()) {
    const [u] = await sql`select id from users where lower(name) = ${front.assignee.trim().toLowerCase()} and is_active`;
    if (!u) throw new HttpError(400, `Nobody called "${front.assignee}" was found.`);
    assignee = u.id;
  }
  const fields = await fieldsFor(project.id);
  const row = await parseTask(
    {
      title: front.title,
      body_md: body,
      priority: front.priority ?? undefined,
      deadline: front.deadline ? new Date(front.deadline).toISOString() : undefined,
      start_date: front.start_date ? String(front.start_date).slice(0, 10) : undefined,
      estimate_minutes: front.estimate_minutes ?? undefined,
      labels: Array.isArray(front.labels) ? front.labels.map(String) : undefined,
      properties: front.properties ?? undefined,
      assignee_id: assignee,
    },
    me,
    fields,
    { creating: true },
  );
  if (front.status && SETTABLE.includes(front.status)) row.status = front.status;
  const id = await sql.begin((tx) => createTask(tx, me, project, row));
  res.status(201).json({ task: await visibleTask(me, id) });
});

module.exports = router;
