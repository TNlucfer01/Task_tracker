// Per-person performance numbers, shared by the People pages, the dashboard and reports.
const sql = require("../../db");
const { peopleFilter } = require("../../access");

/** One row per visible person: delivery, quality, workload and hours in the range. */
async function peopleStats(me, { from, to }, { includeInactive = true, userId = null } = {}) {
  return sql`
    select u.id, u.name, u.email, u.title, u.is_active,
           case when d.id is null then null else json_build_object('id', d.id, 'name', d.name) end as department,
           json_build_object('id', r.id, 'name', r.name) as role,
           coalesce(s.tasks_done, 0) as tasks_done,
           s.on_time_pct,
           q.avg_rating,
           coalesce(q.changes_requested, 0) as changes_requested,
           (select count(*) from tasks t where t.assignee_id = u.id and t.status <> 'done') as open_tasks,
           (select count(*) from tasks t where t.assignee_id = u.id and t.status <> 'done' and t.deadline < now()) as overdue_tasks,
           (select count(*) from tasks t where t.assignee_id = u.id and t.status = 'in_review') as in_review,
           coalesce((select sum(h.hours_clocked) from v_daily_hours h where h.user_id = u.id and h.day between ${from} and ${to}), 0) as hours_clocked,
           coalesce((select round(sum(extract(epoch from coalesce(l.ended_at, now()) - l.started_at)) / 3600, 2) from task_time_logs l
                     where l.user_id = u.id and (l.started_at at time zone 'Asia/Kolkata')::date between ${from} and ${to}), 0) as task_hours,
           (select s2.clock_in from work_sessions s2 where s2.user_id = u.id and s2.clock_out is null) as clocked_in_since
    from users u
    join roles r on r.id = u.role_id
    left join departments d on d.id = u.department_id
    left join v_user_task_stats s on s.user_id = u.id
    left join v_user_quality q on q.user_id = u.id
    where ${peopleFilter(me)}
      ${includeInactive ? sql`` : sql`and u.is_active`}
      ${userId ? sql`and u.id = ${userId}` : sql``}
    order by lower(u.name)`;
}

module.exports = { peopleStats };
