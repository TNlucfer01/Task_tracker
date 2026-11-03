// People performance: the team table and one person's work in detail.
const express = require("express");
const sql = require("../../db");
const v = require("../../lib/validate");
const { found } = require("../../lib/http");
const { permit } = require("../../middleware/auth");
const { dayRange } = require("../../lib/dates");
const { peopleStats } = require("./stats");

const router = express.Router();
router.use(permit("people.view"));

/** GET /people — performance for everyone you can see (?from&to). */
router.get("/", async (req, res) => {
  const range = dayRange(req.query, 30);
  res.json({ range, people: await peopleStats(res.locals.me, range) });
});

/** GET /people/:id — one person: stats, tasks, daily hours, reviews and recent activity. */
router.get("/:id", async (req, res) => {
  const me = res.locals.me;
  const userId = v.id(req.params.id, "user id");
  const range = dayRange(req.query, 30);
  const [person] = await peopleStats(me, range, { userId });
  found(person, "That person");
  const [tasks, dailyHours, reviews, activity] = await Promise.all([
    sql`select t.id, p.key || '-' || t.number as key, t.title, t.status, t.priority, t.deadline, t.estimate_minutes, t.completed_at,
               json_build_object('id', p.id, 'name', p.name) as project,
               (t.status <> 'done' and t.deadline < now()) as overdue,
               coalesce((select actual_minutes from v_task_time vt where vt.task_id = t.id), 0) as actual_minutes
        from tasks t join projects p on p.id = t.project_id where t.assignee_id = ${userId}
        order by (t.status = 'done'), t.deadline nulls last limit 200`,
    sql`select day, hours_clocked from v_daily_hours where user_id = ${userId} and day between ${range.from} and ${range.to} order by day`,
    sql`select rv.id, rv.decision, rv.rating, rv.comment, rv.created_at, p.key || '-' || t.number as task_key, t.title as task_title, t.id as task_id,
               case when u.id is null then null else json_build_object('id', u.id, 'name', u.name) end as reviewer
        from task_reviews rv join tasks t on t.id = rv.task_id join projects p on p.id = t.project_id left join users u on u.id = rv.reviewer_id
        where rv.assignee_id = ${userId} order by rv.created_at desc limit 20`,
    sql`select e.id, e.type, e.data, e.created_at, t.id as task_id, p.key || '-' || t.number as task_key, t.title as task_title
        from task_events e join tasks t on t.id = e.task_id join projects p on p.id = t.project_id
        where e.actor_id = ${userId} order by e.created_at desc limit 20`,
  ]);
  res.json({ range, person, tasks, daily_hours: dailyHours, reviews, activity });
});

module.exports = router;
