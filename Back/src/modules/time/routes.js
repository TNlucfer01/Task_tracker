// Time tracking: your clock and timers, work sessions, admin corrections with an audit trail,
// and attendance for managers. All times come from the database clock, never the browser.
const express = require("express");
const sql = require("../../db");
const v = require("../../lib/validate");
const { HttpError, found, forbid } = require("../../lib/http");
const { can, permit } = require("../../middleware/auth");
const { peopleFilter, canSeeUser } = require("../../access");
const { dayRange, todayInIndia } = require("../../lib/dates");
const { visibleTask } = require("../tasks/service");

const router = express.Router();

/** Your current clock state: open session, running timer and today's totals. */
async function myStatus(userId) {
  const today = todayInIndia();
  const [[session], [timer], [hours], [taskMinutes]] = await Promise.all([
    sql`select id, clock_in from work_sessions where user_id = ${userId} and clock_out is null`,
    sql`select l.id, l.started_at, l.task_id, p.key || '-' || t.number as task_key, t.title as task_title
        from task_time_logs l join tasks t on t.id = l.task_id join projects p on p.id = t.project_id
        where l.user_id = ${userId} and l.ended_at is null`,
    sql`select coalesce(sum(hours_clocked), 0) as hours from v_daily_hours where user_id = ${userId} and day = ${today}`,
    sql`select coalesce(round(sum(extract(epoch from coalesce(ended_at, now()) - started_at)) / 60), 0) as minutes
        from task_time_logs where user_id = ${userId} and (started_at at time zone 'Asia/Kolkata')::date = ${today}`,
  ]);
  return { session: session ?? null, timer: timer ?? null, hours_today: Number(hours.hours), task_minutes_today: Number(taskMinutes.minutes) };
}

/** Requires time.track for your own clock. */
function assertTracks(me) {
  if (!can(me, "time.track")) forbid("Your role doesn't track time.");
}

/** GET /time/me — your clock state. */
router.get("/me", async (req, res) => res.json(await myStatus(res.locals.me.id)));

/** POST /time/clock-in — starts your work session. */
router.post("/clock-in", async (req, res) => {
  assertTracks(res.locals.me);
  await sql`select clock_in(${res.locals.me.id})`;
  res.json(await myStatus(res.locals.me.id));
});

/** POST /time/clock-out — ends your session (and any running timer). */
router.post("/clock-out", async (req, res) => {
  assertTracks(res.locals.me);
  await sql`select clock_out(${res.locals.me.id})`;
  res.json(await myStatus(res.locals.me.id));
});

/** POST /time/timer/start — starts a timer on one of your tasks (stopping any other). */
router.post("/timer/start", async (req, res) => {
  const me = res.locals.me;
  assertTracks(me);
  const task = await visibleTask(me, v.id(req.body?.task_id, "Task"));
  if (task.assignee_id !== me.id) forbid("You can only time tasks assigned to you.");
  if (task.status === "done") throw new HttpError(400, "This task is already done.");
  await sql.begin(async (tx) => {
    await tx`select start_task_timer(${me.id}, ${task.id})`;
    if (task.status === "todo" || task.status === "rework") {
      await tx`update tasks set status = 'in_progress', updated_by = ${me.id} where id = ${task.id}`;
    }
  });
  res.json(await myStatus(me.id));
});

/** POST /time/timer/stop — stops your running timer. */
router.post("/timer/stop", async (req, res) => {
  assertTracks(res.locals.me);
  await sql`select stop_task_timer(${res.locals.me.id})`;
  res.json(await myStatus(res.locals.me.id));
});

/** GET /time/sessions — work sessions for you, or (with time.manage) someone you can see. */
router.get("/sessions", async (req, res) => {
  const me = res.locals.me;
  const userId = req.query.user_id ? v.id(req.query.user_id, "user_id") : me.id;
  if (userId !== me.id && !(can(me, "time.manage") || can(me, "people.view"))) forbid();
  if (userId !== me.id && !(await canSeeUser(me, userId))) throw new HttpError(404, "That person wasn't found.");
  const { from, to } = dayRange(req.query, 14);
  const rows = await sql`
    select s.id, s.clock_in, s.clock_out,
           round(extract(epoch from coalesce(s.clock_out, now()) - s.clock_in) / 60) as minutes,
           (select count(*) from time_corrections c where c.session_id = s.id) as corrections,
           coalesce((select round(sum(extract(epoch from coalesce(l.ended_at, now()) - l.started_at)) / 60)
                     from task_time_logs l where l.user_id = s.user_id and l.started_at >= s.clock_in
                       and l.started_at < coalesce(s.clock_out, now())), 0) as task_minutes
    from work_sessions s
    where s.user_id = ${userId} and (s.clock_in at time zone 'Asia/Kolkata')::date between ${from} and ${to}
    order by s.clock_in desc`;
  res.json({ range: { from, to }, sessions: rows, can_correct: userId !== me.id && can(me, "time.manage") });
});

/** PATCH /time/sessions/:id — corrects someone's session with a reason (recorded). */
router.patch("/sessions/:id", permit("time.manage"), async (req, res) => {
  const me = res.locals.me;
  const sessionId = v.id(req.params.id, "session id");
  const [s] = await sql`select * from work_sessions where id = ${sessionId}`;
  found(s, "That work session");
  if (!(await canSeeUser(me, s.user_id))) throw new HttpError(404, "That work session wasn't found.");
  if (s.user_id === me.id && !me.role.is_system) forbid("Ask someone else to correct your own time.");
  const clockIn = v.timestamp(req.body?.clock_in, "Clock in") ?? s.clock_in.toISOString();
  const clockOut = req.body?.clock_out === undefined ? s.clock_out?.toISOString() ?? null : v.timestamp(req.body.clock_out, "Clock out");
  if (clockOut && new Date(clockOut) <= new Date(clockIn)) throw new HttpError(400, "Clock out must be after clock in.");
  if (new Date(clockIn) > new Date() || (clockOut && new Date(clockOut) > new Date())) throw new HttpError(400, "Times can't be in the future.");
  const reason = v.text(req.body?.reason, "Reason", { min: 3, max: 500 });
  await sql`select correct_session(${sessionId}, ${me.id}, ${clockIn}, ${clockOut}, ${reason})`;
  res.json({ ok: true });
});

/** GET /time/sessions/:id/corrections — the audit trail for one session. */
router.get("/sessions/:id/corrections", async (req, res) => {
  const me = res.locals.me;
  const sessionId = v.id(req.params.id, "session id");
  const [s] = await sql`select user_id from work_sessions where id = ${sessionId}`;
  found(s, "That work session");
  if (s.user_id !== me.id && !(await canSeeUser(me, s.user_id))) throw new HttpError(404, "That work session wasn't found.");
  const rows = await sql`
    select c.id, c.old_clock_in, c.old_clock_out, c.new_clock_in, c.new_clock_out, c.reason, c.created_at,
           case when u.id is null then null else json_build_object('id', u.id, 'name', u.name) end as editor
    from time_corrections c left join users u on u.id = c.editor_id where c.session_id = ${sessionId} order by c.created_at desc`;
  res.json({ corrections: rows });
});

/** GET /time/attendance — who's clocked in now and hours per person per day, for people you can see. */
router.get("/attendance", async (req, res) => {
  const me = res.locals.me;
  if (!(can(me, "people.view") || can(me, "time.manage") || can(me, "dashboard.view"))) forbid();
  const { from, to } = dayRange(req.query, 7);
  const [people, now, hours] = await Promise.all([
    sql`select u.id, u.name, u.title, d.name as department_name from users u left join departments d on d.id = u.department_id
        join roles r on r.id = u.role_id
        where u.is_active and ${peopleFilter(me)} and exists (select 1 from role_permissions rp where rp.role_id = r.id and rp.permission = 'time.track')
        order by lower(u.name)`,
    sql`select s.id as session_id, s.user_id, s.clock_in, u.name,
               (select json_build_object('key', p.key || '-' || t.number, 'title', t.title)
                  from task_time_logs l join tasks t on t.id = l.task_id join projects p on p.id = t.project_id
                 where l.user_id = s.user_id and l.ended_at is null) as working_on
        from work_sessions s join users u on u.id = s.user_id
        where s.clock_out is null and ${peopleFilter(me)} order by s.clock_in`,
    sql`select h.user_id, h.day, h.hours_clocked from v_daily_hours h join users u on u.id = h.user_id
        where h.day between ${from} and ${to} and ${peopleFilter(me)}`,
  ]);
  res.json({ range: { from, to }, people, clocked_in_now: now, daily_hours: hours });
});

module.exports = router;
