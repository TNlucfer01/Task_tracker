// The overview dashboard. Everything is limited to the viewer's scope: a department manager sees
// their department, an Admin or HR sees the whole company.
const express = require("express");
const sql = require("../../db");
const { permit } = require("../../middleware/auth");
const { taskFilter, projectFilter, peopleFilter, departmentFilter } = require("../../access");
const { todayInIndia } = require("../../lib/dates");

const router = express.Router();
const TREND_DAYS = 14;

/** GET /dashboard/summary — KPIs, attention lists, projects by department, departments, trend and activity. */
router.get("/summary", permit("dashboard.view"), async (req, res) => {
  const me = res.locals.me;
  const today = todayInIndia();
  const weekStart = todayInIndia(-6);
  const trendStart = todayInIndia(-(TREND_DAYS - 1));
  const attention = (where) => sql`
    select t.id, p.key || '-' || t.number as key, t.title, t.status, t.priority, t.deadline,
           (t.status <> 'done' and t.deadline < now()) as overdue,
           json_build_object('id', p.id, 'name', p.name) as project,
           case when a.id is null then null else json_build_object('id', a.id, 'name', a.name) end as assignee
    from tasks t join projects p on p.id = t.project_id left join users a on a.id = t.assignee_id
    where ${taskFilter(me)} and ${where}`;

  const [[counts], [people], projects, departments, review, overdue, dueSoon, clock, trend, activity] = await Promise.all([
    sql`select count(*) filter (where t.status = 'todo') as not_started,
               count(*) filter (where t.status in ('in_progress', 'in_review', 'rework')) as pending,
               count(*) filter (where t.status = 'in_progress') as in_progress,
               count(*) filter (where t.status = 'in_review') as in_review,
               count(*) filter (where t.status = 'rework') as rework,
               count(*) filter (where t.status = 'done') as completed,
               count(*) filter (where t.status = 'done' and t.completed_at > now() - interval '7 days') as completed_this_week,
               count(*) filter (where t.status <> 'done' and t.deadline < now()) as overdue,
               count(*) filter (where t.status <> 'done' and t.deadline between now() and now() + interval '7 days') as due_this_week,
               count(*) as total
        from tasks t where ${taskFilter(me)}`,
    sql`select count(*) filter (where u.is_active) as active, count(*) filter (where not u.is_active) as inactive,
               (select count(*) from work_sessions s where s.clock_out is null
                  and s.user_id in (select u.id from users u where ${peopleFilter(me)})) as clocked_in_now,
               coalesce((select sum(h.hours_clocked) from v_daily_hours h where h.day = ${today} and h.user_id in (select u.id from users u where ${peopleFilter(me)})), 0) as hours_today
        from users u where ${peopleFilter(me)}`,
    sql`select p.id, p.key, p.name, p.status, p.deadline,
               (p.status <> 'completed' and p.deadline < now()) as overdue,
               count(t.id) as task_count, count(t.id) filter (where t.status = 'done') as tasks_done,
               count(t.id) filter (where t.status <> 'done' and t.deadline < now()) as tasks_overdue,
               coalesce(json_agg(json_build_object('department_id', a.department_id, 'done', t.status = 'done')) filter (where t.id is not null), '[]') as task_departments
        from projects p left join tasks t on t.project_id = p.id left join users a on a.id = t.assignee_id
        where ${projectFilter(me)}
        group by p.id
        order by case p.status when 'active' then 0 when 'planned' then 1 when 'on_hold' then 2 else 3 end, p.deadline nulls last`,
    sql`select d.id, d.name,
               (select count(*) from users u where u.department_id = d.id and u.is_active) as members,
               (select count(*) from work_sessions s join users u on u.id = s.user_id where u.department_id = d.id and s.clock_out is null) as active_now,
               (select count(*) from tasks t join users u on u.id = t.assignee_id where u.department_id = d.id and t.status <> 'done') as open_tasks,
               (select count(*) from tasks t join users u on u.id = t.assignee_id where u.department_id = d.id and t.status <> 'done' and t.deadline < now()) as overdue_tasks,
               (select count(*) from tasks t join users u on u.id = t.assignee_id where u.department_id = d.id and t.status = 'done') as completed_tasks,
               coalesce((select sum(h.hours_clocked) from v_daily_hours h join users u on u.id = h.user_id where u.department_id = d.id and h.day >= ${weekStart}), 0) as hours_week,
               coalesce((select round(sum(extract(epoch from coalesce(l.ended_at, now()) - l.started_at)) / 3600, 1) from task_time_logs l join users u on u.id = l.user_id
                         where u.department_id = d.id and (l.started_at at time zone 'Asia/Kolkata')::date >= ${weekStart}), 0) as timer_hours_week,
               (select round(avg(rv.rating), 1) from task_reviews rv join users u on u.id = rv.assignee_id where u.department_id = d.id and rv.decision = 'approved') as avg_rating
        from departments d where ${departmentFilter(me)} order by lower(d.name)`,
    attention(sql`t.status = 'in_review'`),
    attention(sql`t.status <> 'done' and t.deadline < now()`),
    attention(sql`t.status <> 'done' and t.deadline between now() and now() + interval '7 days'`),
    sql`select s.user_id, s.clock_in, u.name, u.department_id,
               (select p.key || '-' || t.number from task_time_logs l join tasks t on t.id = l.task_id join projects p on p.id = t.project_id
                 where l.user_id = s.user_id and l.ended_at is null) as working_on
        from work_sessions s join users u on u.id = s.user_id where s.clock_out is null and ${peopleFilter(me)} order by s.clock_in`,
    sql`select h.day, u.department_id, sum(h.hours_clocked) as hours from v_daily_hours h join users u on u.id = h.user_id
        where h.day >= ${trendStart} and ${peopleFilter(me)} group by h.day, u.department_id`,
    sql`select e.id, e.type, e.data, e.created_at, t.id as task_id, p.key || '-' || t.number as task_key, t.title as task_title,
               case when a.id is null then null else json_build_object('id', a.id, 'name', a.name) end as actor
        from task_events e join tasks t on t.id = e.task_id join projects p on p.id = t.project_id left join users a on a.id = e.actor_id
        where ${taskFilter(me)} and e.type in ('created', 'status', 'review', 'comment') order by e.created_at desc limit 10`,
  ]);

  const sortByDeadline = (rows) => rows.sort((a, b) => new Date(a.deadline ?? 8.64e15) - new Date(b.deadline ?? 8.64e15));
  const list = (rows) => ({ count: rows.length, tasks: sortByDeadline(rows).slice(0, 6) });
  const days = Array.from({ length: TREND_DAYS }, (_, i) => todayInIndia(i - (TREND_DAYS - 1)));
  const deptIds = [...departments.map((d) => d.id), null];

  res.json({
    date: today,
    scope: me.role.scope,
    department: me.role.scope === "all" ? null : { id: me.department_id, name: me.department_name },
    people: { ...people, hours_today: Number(people.hours_today) },
    tasks: counts,
    attention: { waiting_review: list(review), overdue: list(overdue), due_soon: list(dueSoon) },
    on_the_clock: clock,
    projects: projects.map(({ task_departments, ...p }) => {
      const byDept = new Map();
      for (const t of task_departments) {
        const b = byDept.get(t.department_id) ?? { department_id: t.department_id, total: 0, done: 0 };
        b.total += 1;
        if (t.done) b.done += 1;
        byDept.set(t.department_id, b);
      }
      return { ...p, progress_pct: p.task_count ? Math.round((100 * p.tasks_done) / p.task_count) : 0, by_department: [...byDept.values()] };
    }),
    departments: departments.map((d) => ({
      ...d,
      hours_week: Number(d.hours_week),
      timer_hours_week: Number(d.timer_hours_week),
      utilization_pct: Number(d.hours_week) > 0 ? Math.min(100, Math.round((100 * Number(d.timer_hours_week)) / Number(d.hours_week))) : null,
    })),
    hours_trend: {
      days,
      series: deptIds.map((id) => ({
        department_id: id,
        values: days.map((day) => Number(trend.find((r) => r.day === day && r.department_id === id)?.hours ?? 0)),
      })).filter((s) => s.values.some((x) => x > 0)),
    },
    activity,
  });
});

module.exports = router;
