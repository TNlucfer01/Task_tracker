// CSV reports, limited to what the person can see.
const express = require("express");
const sql = require("../../db");
const { permit } = require("../../middleware/auth");
const { taskFilter, peopleFilter, projectFilter, departmentFilter } = require("../../access");
const { dayRange } = require("../../lib/dates");
const { sendCsv } = require("../../lib/csv");
const { peopleStats } = require("../people/stats");

const router = express.Router();
router.use(permit("reports.export"));

/** Formats a timestamp for spreadsheets in India time. */
const ist = (d) => (d ? new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour12: false }) : "");

/** GET /reports/people.csv — performance per person for the range. */
router.get("/people.csv", async (req, res) => {
  const range = dayRange(req.query, 30);
  const rows = await peopleStats(res.locals.me, range);
  sendCsv(res, `people-${range.from}-to-${range.to}.csv`,
    ["Name", "Email", "Title", "Department", "Role", "Active", "Tasks done", "On time %", "Avg rating", "Changes requested", "Open tasks", "Overdue", "Hours clocked", "Hours on tasks"],
    rows.map((p) => [p.name, p.email, p.title, p.department?.name, p.role.name, p.is_active ? "Yes" : "No", p.tasks_done, p.on_time_pct, p.avg_rating, p.changes_requested, p.open_tasks, p.overdue_tasks, p.hours_clocked, p.task_hours]));
});

/** GET /reports/tasks.csv — every task you can see. */
router.get("/tasks.csv", async (req, res) => {
  const me = res.locals.me;
  const rows = await sql`
    select p.key || '-' || t.number as key, t.title, p.name as project, t.status, t.priority, a.name as assignee, d.name as department,
           t.deadline, t.completed_at, t.estimate_minutes, t.labels,
           coalesce((select actual_minutes from v_task_time vt where vt.task_id = t.id), 0) as actual_minutes,
           (select rating from task_reviews rv where rv.task_id = t.id and rv.decision = 'approved' order by rv.created_at desc limit 1) as rating
    from tasks t join projects p on p.id = t.project_id left join users a on a.id = t.assignee_id left join departments d on d.id = a.department_id
    where ${taskFilter(me)} order by p.key, t.number`;
  sendCsv(res, "tasks.csv",
    ["Key", "Title", "Project", "Status", "Priority", "Assignee", "Department", "Deadline", "Completed", "Estimate (min)", "Actual (min)", "Rating", "Labels"],
    rows.map((t) => [t.key, t.title, t.project, t.status, t.priority, t.assignee, t.department, ist(t.deadline), ist(t.completed_at), t.estimate_minutes, t.actual_minutes, t.rating, t.labels]));
});

/** GET /reports/projects.csv — project progress. */
router.get("/projects.csv", async (req, res) => {
  const rows = await sql`
    select p.key, p.name, p.status, d.name as department, o.name as owner, p.deadline,
           (select count(*) from tasks t where t.project_id = p.id) as total,
           (select count(*) from tasks t where t.project_id = p.id and t.status = 'done') as done,
           (select count(*) from tasks t where t.project_id = p.id and t.status <> 'done' and t.deadline < now()) as overdue
    from projects p left join departments d on d.id = p.department_id left join users o on o.id = p.owner_id
    where ${projectFilter(res.locals.me)} order by p.key`;
  sendCsv(res, "projects.csv", ["Key", "Project", "Status", "Department", "Owner", "Deadline", "Tasks", "Done", "Progress %", "Overdue tasks"],
    rows.map((p) => [p.key, p.name, p.status, p.department, p.owner, ist(p.deadline), p.total, p.done, p.total ? Math.round((100 * p.done) / p.total) : 0, p.overdue]));
});

/** GET /reports/departments.csv — department totals for the range. */
router.get("/departments.csv", async (req, res) => {
  const { from, to } = dayRange(req.query, 30);
  const rows = await sql`
    select d.name,
           (select count(*) from users u where u.department_id = d.id and u.is_active) as people,
           (select count(*) from tasks t join users u on u.id = t.assignee_id where u.department_id = d.id and t.status <> 'done') as open,
           (select count(*) from tasks t join users u on u.id = t.assignee_id where u.department_id = d.id and t.status = 'done') as done,
           (select count(*) from tasks t join users u on u.id = t.assignee_id where u.department_id = d.id and t.status <> 'done' and t.deadline < now()) as overdue,
           coalesce((select sum(h.hours_clocked) from v_daily_hours h join users u on u.id = h.user_id where u.department_id = d.id and h.day between ${from} and ${to}), 0) as hours,
           (select round(avg(rv.rating), 2) from task_reviews rv join users u on u.id = rv.assignee_id where u.department_id = d.id and rv.decision = 'approved') as rating
    from departments d where ${departmentFilter(res.locals.me)} order by d.name`;
  sendCsv(res, `departments-${from}-to-${to}.csv`, ["Department", "People", "Open tasks", "Done", "Overdue", "Hours clocked", "Avg rating"],
    rows.map((d) => [d.name, d.people, d.open, d.done, d.overdue, d.hours, d.rating]));
});

/** GET /reports/time.csv — every work session in the range. */
router.get("/time.csv", async (req, res) => {
  const { from, to } = dayRange(req.query, 30);
  const rows = await sql`
    select u.name, d.name as department, s.clock_in, s.clock_out,
           round(extract(epoch from coalesce(s.clock_out, now()) - s.clock_in) / 60) as minutes,
           (select count(*) from time_corrections c where c.session_id = s.id) as corrections
    from work_sessions s join users u on u.id = s.user_id left join departments d on d.id = u.department_id
    where ${peopleFilter(res.locals.me)} and (s.clock_in at time zone 'Asia/Kolkata')::date between ${from} and ${to}
    order by u.name, s.clock_in`;
  sendCsv(res, `time-${from}-to-${to}.csv`, ["Person", "Department", "Clock in", "Clock out", "Minutes", "Corrected"],
    rows.map((r) => [r.name, r.department, ist(r.clock_in), r.clock_out ? ist(r.clock_out) : "Still clocked in", r.minutes, r.corrections > 0 ? "Yes" : "No"]));
});

module.exports = router;
