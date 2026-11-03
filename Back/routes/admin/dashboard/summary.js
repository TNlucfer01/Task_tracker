// GET /api/admin/dashboard/summary — everything the overview page shows, in one request.
//
// "This week" means the last 7 days including today, in India time.
// Pending = in progress + in review + rework. Not started = todo. Completed = done.

const express = require("express");
const supabase = require("../../../config/db");
const { run, todayInIndia, round } = require("../../../utils/http");
const { isOverdue } = require("./shared");

const router = express.Router();

const DAY_MS = 24 * 60 * 60 * 1000;
const PENDING = new Set(["in_progress", "in_review", "rework"]);
const PROJECT_ORDER = { active: 0, planned: 1, on_hold: 2, completed: 3 };
const ATTENTION_LIMIT = 6;
const ACTIVITY_LIMIT = 8;
const TREND_DAYS = 14;

function minutesBetween(start, end) {
  return (new Date(end ?? Date.now()) - new Date(start)) / 60000;
}

router.get("/summary", async (req, res) => {
  const now = Date.now();
  const today = todayInIndia();
  const weekStart = todayInIndia(-6);
  const trendStart = todayInIndia(-(TREND_DAYS - 1));
  const weekAgoIso = new Date(now - 7 * DAY_MS).toISOString();

  const [departments, users, projects, tasks, openSessions, dailyHours, timeLogs, reviews, activity] = await Promise.all([
    run(supabase.from("departments").select("id, name").order("name")),
    run(supabase.from("users").select("id, name, role, is_active, department_id")),
    run(supabase.from("projects").select("id, name, status, deadline, completed_at")),
    run(supabase.from("tasks").select("id, name, status, deadline, project_id, assigned_to, created_at, completed_at")),
    run(supabase.from("work_sessions").select("user_id, clock_in").is("clock_out", null).order("clock_in")),
    run(supabase.from("v_daily_hours").select("user_id, day, hours_clocked").gte("day", trendStart).lte("day", today)),
    run(supabase.from("task_time_logs").select("user_id, started_at, ended_at").gte("started_at", weekAgoIso)),
    run(supabase.from("task_reviews").select("rating, task:tasks(assigned_to)")),
    run(
      supabase
        .from("task_status_history")
        .select("id, old_status, new_status, changed_at, task:tasks(id, name), actor:users(id, name)")
        .order("changed_at", { ascending: false })
        .limit(ACTIVITY_LIMIT),
    ),
  ]);

  const userById = new Map(users.data.map((u) => [u.id, u]));
  const projectById = new Map(projects.data.map((p) => [p.id, p]));
  const deptOf = (userId) => userById.get(userId)?.department_id ?? null;
  const ref = (row) => (row ? { id: row.id, name: row.name } : null);

  // ---- People and task counts --------------------------------------------------------
  const team = users.data.filter((u) => u.role === "user");
  const activeTeam = team.filter((u) => u.is_active);
  const hoursToday = dailyHours.data.filter((r) => r.day === today).reduce((s, r) => s + Number(r.hours_clocked), 0);

  const counts = { not_started: 0, pending: 0, in_progress: 0, in_review: 0, rework: 0, completed: 0 };
  let overdue = 0;
  let completedThisWeek = 0;
  let dueThisWeek = 0;
  for (const t of tasks.data) {
    if (t.status === "todo") counts.not_started += 1;
    else if (t.status === "done") counts.completed += 1;
    else {
      counts.pending += 1;
      counts[t.status] += 1;
    }
    if (isOverdue(t, now)) overdue += 1;
    if (t.status === "done" && t.completed_at && new Date(t.completed_at) >= now - 7 * DAY_MS) completedThisWeek += 1;
    if (t.status !== "done" && t.deadline && new Date(t.deadline) >= now && new Date(t.deadline) < now + 7 * DAY_MS) {
      dueThisWeek += 1;
    }
  }

  // ---- Departments ----------------------------------------------------------------------
  // Fixed order (by name) gives each department a stable chart colour; "No department" goes last.
  const deptRows = departments.data.map((d, i) => ({ id: d.id, name: d.name, slot: Math.min(i + 1, 5) }));
  const hasUnassigned = team.some((u) => u.department_id === null);
  if (hasUnassigned) deptRows.push({ id: null, name: "No department", slot: 0 });

  const blank = () => ({
    members: 0,
    active_now: 0,
    open_tasks: 0,
    overdue_tasks: 0,
    completed_tasks: 0,
    hours_week: 0,
    timer_hours_week: 0,
    ratings: [],
  });
  const deptStats = new Map(deptRows.map((d) => [d.id, blank()]));
  const statsFor = (deptId) => deptStats.get(deptId) ?? deptStats.get(null);

  for (const u of activeTeam) {
    const stats = statsFor(u.department_id);
    if (stats) stats.members += 1;
  }
  for (const s of openSessions.data) {
    const stats = statsFor(deptOf(s.user_id));
    if (stats) stats.active_now += 1;
  }
  for (const t of tasks.data) {
    if (t.assigned_to === null) continue;
    const stats = statsFor(deptOf(t.assigned_to));
    if (!stats) continue;
    if (t.status === "done") stats.completed_tasks += 1;
    else stats.open_tasks += 1;
    if (isOverdue(t, now)) stats.overdue_tasks += 1;
  }
  for (const r of dailyHours.data) {
    if (r.day < weekStart) continue;
    const stats = statsFor(deptOf(r.user_id));
    if (stats) stats.hours_week += Number(r.hours_clocked);
  }
  for (const l of timeLogs.data) {
    const stats = statsFor(deptOf(l.user_id));
    if (stats) stats.timer_hours_week += minutesBetween(l.started_at, l.ended_at) / 60;
  }
  for (const r of reviews.data) {
    const stats = r.task?.assigned_to ? statsFor(deptOf(r.task.assigned_to)) : null;
    if (stats) stats.ratings.push(r.rating);
  }

  const departmentsOut = deptRows.map((d) => {
    const s = deptStats.get(d.id);
    return {
      id: d.id,
      name: d.name,
      slot: d.slot,
      members: s.members,
      active_now: s.active_now,
      open_tasks: s.open_tasks,
      overdue_tasks: s.overdue_tasks,
      completed_tasks: s.completed_tasks,
      hours_week: round(s.hours_week, 1),
      timer_hours_week: round(s.timer_hours_week, 1),
      // Share of clocked time spent on task timers. Over 100% would mean timers outside sessions.
      utilization_pct: s.hours_week > 0 ? round(Math.min(100, (100 * s.timer_hours_week) / s.hours_week), 0) : null,
      avg_rating: s.ratings.length ? round(s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length, 1) : null,
    };
  });

  // ---- Projects, with progress split by department ----------------------------------------
  const projectStats = new Map(projects.data.map((p) => [p.id, { total: 0, done: 0, overdue: 0, byDept: new Map() }]));
  for (const t of tasks.data) {
    const ps = projectStats.get(t.project_id);
    if (!ps) continue;
    ps.total += 1;
    if (t.status === "done") ps.done += 1;
    if (isOverdue(t, now)) ps.overdue += 1;
    const deptId = t.assigned_to === null ? "unassigned" : deptOf(t.assigned_to);
    const bucket = ps.byDept.get(deptId) ?? { total: 0, done: 0 };
    bucket.total += 1;
    if (t.status === "done") bucket.done += 1;
    ps.byDept.set(deptId, bucket);
  }

  const projectsOut = projects.data
    .map((p) => {
      const ps = projectStats.get(p.id);
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        deadline: p.deadline,
        overdue: p.status !== "completed" && p.deadline !== null && new Date(p.deadline) < now,
        task_count: ps.total,
        tasks_done: ps.done,
        tasks_overdue: ps.overdue,
        progress_pct: ps.total ? round((100 * ps.done) / ps.total, 0) : 0,
        by_department: [...ps.byDept.entries()].map(([departmentId, b]) => ({
          department_id: departmentId === "unassigned" ? null : departmentId,
          unassigned: departmentId === "unassigned",
          total: b.total,
          done: b.done,
        })),
      };
    })
    .sort(
      (a, b) =>
        PROJECT_ORDER[a.status] - PROJECT_ORDER[b.status] ||
        (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"),
    );

  // ---- Needs attention ---------------------------------------------------------------------
  const taskCard = (t) => ({
    id: t.id,
    name: t.name,
    status: t.status,
    deadline: t.deadline,
    overdue: isOverdue(t, now),
    project: ref(projectById.get(t.project_id)),
    assignee: ref(userById.get(t.assigned_to)),
  });
  const byDeadline = (a, b) => new Date(a.deadline) - new Date(b.deadline);

  const waitingReview = tasks.data.filter((t) => t.status === "in_review");
  const overdueTasks = tasks.data.filter((t) => isOverdue(t, now)).sort(byDeadline);
  const dueSoon = tasks.data
    .filter((t) => t.status !== "done" && t.deadline && new Date(t.deadline) >= now && new Date(t.deadline) < now + 7 * DAY_MS)
    .sort(byDeadline);

  // ---- Hours trend: clocked hours per day per department -----------------------------------
  const trendDays = Array.from({ length: TREND_DAYS }, (_, i) => todayInIndia(i - (TREND_DAYS - 1)));
  const dayIndex = new Map(trendDays.map((d, i) => [d, i]));
  const trend = new Map(deptRows.map((d) => [d.id, Array(TREND_DAYS).fill(0)]));
  for (const r of dailyHours.data) {
    const i = dayIndex.get(r.day);
    const series = trend.get(deptOf(r.user_id)) ?? trend.get(null);
    if (i !== undefined && series) series[i] += Number(r.hours_clocked);
  }

  res.json({
    date: today,
    people: {
      active: activeTeam.length,
      inactive: team.length - activeTeam.length,
      admins: users.data.filter((u) => u.role === "admin" && u.is_active).length,
      clocked_in_now: openSessions.data.length,
      hours_today: round(hoursToday, 1),
    },
    tasks: {
      total: tasks.data.length,
      ...counts,
      overdue,
      completed_this_week: completedThisWeek,
      due_this_week: dueThisWeek,
    },
    projects: projectsOut,
    departments: departmentsOut,
    attention: {
      waiting_review: { count: waitingReview.length, tasks: waitingReview.slice(0, ATTENTION_LIMIT).map(taskCard) },
      overdue: { count: overdueTasks.length, tasks: overdueTasks.slice(0, ATTENTION_LIMIT).map(taskCard) },
      due_soon: { count: dueSoon.length, tasks: dueSoon.slice(0, ATTENTION_LIMIT).map(taskCard) },
    },
    on_the_clock: openSessions.data.map((s) => ({
      user_id: s.user_id,
      name: userById.get(s.user_id)?.name ?? null,
      department_id: deptOf(s.user_id),
      clock_in: s.clock_in,
    })),
    hours_trend: {
      days: trendDays,
      series: deptRows.map((d) => ({ department_id: d.id, values: trend.get(d.id).map((v) => round(v, 1)) })),
    },
    activity: activity.data.map((a) => ({
      id: a.id,
      old_status: a.old_status,
      new_status: a.new_status,
      changed_at: a.changed_at,
      task: ref(a.task),
      actor: ref(a.actor),
    })),
  });
});

module.exports = router;
