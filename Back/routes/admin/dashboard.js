// Admin dashboard (read-only). Mounted at /api/admin/dashboard behind requireAuth + requireRole("admin").
//
//   GET /overview                  headline counts for the whole platform
//   GET /users?role&from&to        one row of performance stats per user
//   GET /users/:id?from&to         everything about one user's work
//   GET /projects?status           progress of every project
//   GET /tasks?status&project_id&assigned_to&overdue&limit
//   GET /rank?by&from&to           users ordered by one metric
//   GET /attendance?from&to        who is clocked in now + hours per day
//
// from/to are calendar days (YYYY-MM-DD) in India time; the default range is the last 30 days.

const express = require("express");
const supabase = require("../../config/db");
const { HttpError, run, parseId, parseDay, todayInIndia, minutesBetween, round } = require("../../utils/http");

const router = express.Router();

const TASK_STATUSES = ["todo", "in_progress", "in_review", "done", "rework"];
const PROJECT_STATUSES = ["planned", "active", "completed", "on_hold"];
const RANK_METRICS = {
  tasks_done: "desc",
  on_time_pct: "desc",
  avg_rating: "desc",
  hours_clocked: "desc",
  rework_bounces: "asc",
};

function dayRange(query) {
  const from = parseDay(query.from, "from") ?? todayInIndia(-29);
  const to = parseDay(query.to, "to") ?? todayInIndia();
  if (from > to) {
    throw new HttpError(400, "from must be on or before to.");
  }
  return { from, to };
}

function isOverdue(task, now = Date.now()) {
  return task.status !== "done" && task.deadline !== null && new Date(task.deadline) < now;
}

function countBy(rows, key, keys) {
  const counts = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const row of rows) {
    counts[row[key]] = (counts[row[key]] ?? 0) + 1;
  }
  return counts;
}

function indexBy(rows, key) {
  return new Map(rows.map((row) => [row[key], row]));
}

// Builds one summary row per user by merging the performance views with live task and session data.
async function buildUserSummaries({ role, from, to, userId }) {
  let usersQuery = supabase
    .from("users")
    .select("id, name, email, role, is_active, department:departments(id, name)")
    .order("name");
  if (role && role !== "all") usersQuery = usersQuery.eq("role", role);
  if (userId) usersQuery = usersQuery.eq("id", userId);

  const scope = (query, column = "user_id") => (userId ? query.eq(column, userId) : query);

  const [users, taskStats, quality, rework, tasks, hours, openSessions] = await Promise.all([
    run(usersQuery),
    run(scope(supabase.from("v_user_task_stats").select("user_id, tasks_done, on_time_pct"))),
    run(scope(supabase.from("v_user_quality").select("user_id, avg_rating, reviews_needing_rework"))),
    run(scope(supabase.from("v_user_rework").select("user_id, rework_bounces"))),
    run(scope(supabase.from("tasks").select("assigned_to, status, deadline").not("assigned_to", "is", null), "assigned_to")),
    run(scope(supabase.from("v_daily_hours").select("user_id, day, hours_clocked").gte("day", from).lte("day", to))),
    run(scope(supabase.from("work_sessions").select("user_id, clock_in").is("clock_out", null))),
  ]);

  const statsByUser = indexBy(taskStats.data, "user_id");
  const qualityByUser = indexBy(quality.data, "user_id");
  const reworkByUser = indexBy(rework.data, "user_id");
  const sessionByUser = indexBy(openSessions.data, "user_id");

  const hoursByUser = new Map();
  for (const row of hours.data) {
    hoursByUser.set(row.user_id, (hoursByUser.get(row.user_id) ?? 0) + Number(row.hours_clocked));
  }

  const now = Date.now();
  const openByUser = new Map();
  const overdueByUser = new Map();
  for (const task of tasks.data) {
    if (task.status !== "done") openByUser.set(task.assigned_to, (openByUser.get(task.assigned_to) ?? 0) + 1);
    if (isOverdue(task, now)) overdueByUser.set(task.assigned_to, (overdueByUser.get(task.assigned_to) ?? 0) + 1);
  }

  return users.data.map((user) => {
    const stats = statsByUser.get(user.id);
    const q = qualityByUser.get(user.id);
    const session = sessionByUser.get(user.id);
    return {
      ...user,
      tasks_done: Number(stats?.tasks_done ?? 0),
      open_tasks: openByUser.get(user.id) ?? 0,
      overdue_tasks: overdueByUser.get(user.id) ?? 0,
      on_time_pct: stats?.on_time_pct === null || stats?.on_time_pct === undefined ? null : Number(stats.on_time_pct),
      avg_rating: q?.avg_rating === null || q?.avg_rating === undefined ? null : Number(q.avg_rating),
      reviews_needing_rework: Number(q?.reviews_needing_rework ?? 0),
      rework_bounces: Number(reworkByUser.get(user.id)?.rework_bounces ?? 0),
      hours_clocked: round(hoursByUser.get(user.id) ?? 0, 2),
      clocked_in: Boolean(session),
      clocked_in_since: session?.clock_in ?? null,
    };
  });
}

router.get("/overview", async (req, res) => {
  const today = todayInIndia();
  const [users, projects, tasks, openSessions, hoursToday] = await Promise.all([
    run(supabase.from("users").select("id, role, is_active")),
    run(supabase.from("projects").select("id, status")),
    run(supabase.from("tasks").select("id, status, deadline")),
    run(supabase.from("work_sessions").select("user_id").is("clock_out", null)),
    run(supabase.from("v_daily_hours").select("hours_clocked").eq("day", today)),
  ]);

  const now = Date.now();
  res.json({
    date: today,
    users: {
      total: users.data.length,
      active: users.data.filter((u) => u.is_active).length,
      admins: users.data.filter((u) => u.role === "admin").length,
    },
    projects: {
      total: projects.data.length,
      by_status: countBy(projects.data, "status", PROJECT_STATUSES),
    },
    tasks: {
      total: tasks.data.length,
      by_status: countBy(tasks.data, "status", TASK_STATUSES),
      overdue: tasks.data.filter((t) => isOverdue(t, now)).length,
    },
    attendance: {
      clocked_in_now: openSessions.data.length,
      hours_today: round(hoursToday.data.reduce((sum, r) => sum + Number(r.hours_clocked), 0), 2),
    },
  });
});

router.get("/users", async (req, res) => {
  const role = req.query.role ?? "user";
  if (!["user", "admin", "all"].includes(role)) {
    throw new HttpError(400, "role must be user, admin or all.");
  }
  const range = dayRange(req.query);
  const users = await buildUserSummaries({ role, ...range });
  res.json({ range, users });
});

router.get("/users/:id", async (req, res) => {
  const userId = parseId(req.params.id, "user id");
  const range = dayRange(req.query);

  const [summary] = await buildUserSummaries({ role: "all", userId, ...range });
  if (!summary) {
    throw new HttpError(404, "User not found.");
  }

  const [tasks, estimates, dailyHours, sessions, timeLogs, reviews] = await Promise.all([
    run(
      supabase
        .from("tasks")
        .select("id, name, status, deadline, estimated_minutes, created_at, completed_at, project:projects(id, name)")
        .eq("assigned_to", userId)
        .order("created_at", { ascending: false }),
    ),
    run(supabase.from("v_task_actual_vs_estimate").select("task_id, estimated_minutes, actual_minutes").eq("assigned_to", userId)),
    run(
      supabase
        .from("v_daily_hours")
        .select("day, hours_clocked")
        .eq("user_id", userId)
        .gte("day", range.from)
        .lte("day", range.to)
        .order("day"),
    ),
    run(
      supabase
        .from("work_sessions")
        .select("id, clock_in, clock_out")
        .eq("user_id", userId)
        .order("clock_in", { ascending: false })
        .limit(20),
    ),
    run(
      supabase
        .from("task_time_logs")
        .select("id, started_at, ended_at, task:tasks(id, name)")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(20),
    ),
    run(
      supabase
        .from("task_reviews")
        .select("id, rating, needed_rework, comments, reviewed_at, task:tasks!inner(id, name, assigned_to)")
        .eq("task.assigned_to", userId)
        .order("reviewed_at", { ascending: false })
        .limit(20),
    ),
  ]);

  const actualByTask = indexBy(estimates.data, "task_id");
  const now = Date.now();

  res.json({
    range,
    user: summary,
    tasks: tasks.data.map((task) => ({
      ...task,
      overdue: isOverdue(task, now),
      actual_minutes: actualByTask.has(task.id) ? Number(actualByTask.get(task.id).actual_minutes) : 0,
    })),
    daily_hours: dailyHours.data.map((row) => ({ day: row.day, hours_clocked: Number(row.hours_clocked) })),
    recent_sessions: sessions.data.map((s) => ({ ...s, minutes: round(minutesBetween(s.clock_in, s.clock_out), 0) })),
    recent_time_logs: timeLogs.data.map((l) => ({ ...l, minutes: round(minutesBetween(l.started_at, l.ended_at), 0) })),
    recent_reviews: reviews.data.map(({ task, ...review }) => ({ ...review, task: { id: task.id, name: task.name } })),
  });
});

router.get("/projects", async (req, res) => {
  const { status } = req.query;
  if (status !== undefined && !PROJECT_STATUSES.includes(status)) {
    throw new HttpError(400, `status must be one of: ${PROJECT_STATUSES.join(", ")}.`);
  }

  let projectsQuery = supabase
    .from("projects")
    .select("id, name, description, status, deadline, created_at, completed_at, creator:users(id, name)")
    .order("created_at", { ascending: false });
  if (status) projectsQuery = projectsQuery.eq("status", status);

  const [projects, tasks] = await Promise.all([
    run(projectsQuery),
    run(supabase.from("tasks").select("project_id, status, deadline")),
  ]);

  const tasksByProject = new Map();
  for (const task of tasks.data) {
    if (!tasksByProject.has(task.project_id)) tasksByProject.set(task.project_id, []);
    tasksByProject.get(task.project_id).push(task);
  }

  const now = Date.now();
  res.json({
    projects: projects.data.map((project) => {
      const projectTasks = tasksByProject.get(project.id) ?? [];
      const done = projectTasks.filter((t) => t.status === "done").length;
      return {
        ...project,
        overdue: project.status !== "completed" && project.deadline !== null && new Date(project.deadline) < now,
        task_count: projectTasks.length,
        tasks_done: done,
        tasks_overdue: projectTasks.filter((t) => isOverdue(t, now)).length,
        tasks_by_status: countBy(projectTasks, "status", TASK_STATUSES),
        progress_pct: projectTasks.length ? round((100 * done) / projectTasks.length, 1) : 0,
      };
    }),
  });
});

router.get("/tasks", async (req, res) => {
  const { status, overdue } = req.query;
  if (status !== undefined && !TASK_STATUSES.includes(status)) {
    throw new HttpError(400, `status must be one of: ${TASK_STATUSES.join(", ")}.`);
  }
  if (overdue !== undefined && !["true", "false"].includes(overdue)) {
    throw new HttpError(400, "overdue must be true or false.");
  }
  const limit = req.query.limit === undefined ? 100 : parseId(req.query.limit, "limit");
  if (limit > 500) {
    throw new HttpError(400, "limit must be 500 or less.");
  }

  let query = supabase
    .from("tasks")
    .select(
      "id, name, description, status, deadline, estimated_minutes, created_at, completed_at, " +
        "project:projects(id, name), assignee:users!tasks_assigned_to_fkey(id, name), " +
        "completer:users!tasks_completed_by_fkey(id, name)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);
  if (req.query.project_id !== undefined) query = query.eq("project_id", parseId(req.query.project_id, "project_id"));
  if (req.query.assigned_to !== undefined) query = query.eq("assigned_to", parseId(req.query.assigned_to, "assigned_to"));
  if (overdue === "true") query = query.neq("status", "done").lt("deadline", new Date().toISOString());

  const tasks = await run(query);
  const ids = tasks.data.map((t) => t.id);
  const estimates = ids.length
    ? await run(supabase.from("v_task_actual_vs_estimate").select("task_id, actual_minutes").in("task_id", ids))
    : { data: [] };
  const actualByTask = indexBy(estimates.data, "task_id");

  const now = Date.now();
  res.json({
    tasks: tasks.data.map((task) => ({
      ...task,
      overdue: isOverdue(task, now),
      actual_minutes: actualByTask.has(task.id) ? Number(actualByTask.get(task.id).actual_minutes) : 0,
    })),
  });
});

router.get("/rank", async (req, res) => {
  const by = req.query.by ?? "tasks_done";
  if (!(by in RANK_METRICS)) {
    throw new HttpError(400, `by must be one of: ${Object.keys(RANK_METRICS).join(", ")}.`);
  }
  const range = dayRange(req.query);
  const users = await buildUserSummaries({ role: "user", ...range });
  const direction = RANK_METRICS[by] === "asc" ? 1 : -1;

  // Users with no value for the metric (e.g. no reviews yet) go last and are not ranked.
  const ranked = users
    .filter((u) => u.is_active)
    .sort((a, b) => {
      if (a[by] === null && b[by] === null) return 0;
      if (a[by] === null) return 1;
      if (b[by] === null) return -1;
      return direction * (a[by] - b[by]);
    })
    .map((user, i) => ({ rank: user[by] === null ? null : i + 1, ...user }));

  res.json({ by, order: RANK_METRICS[by], range, users: ranked });
});

router.get("/attendance", async (req, res) => {
  const range = dayRange(req.query);
  const [users, openSessions, hours] = await Promise.all([
    run(supabase.from("users").select("id, name")),
    run(supabase.from("work_sessions").select("user_id, clock_in").is("clock_out", null).order("clock_in")),
    run(
      supabase
        .from("v_daily_hours")
        .select("user_id, day, hours_clocked")
        .gte("day", range.from)
        .lte("day", range.to)
        .order("day"),
    ),
  ]);

  const nameById = new Map(users.data.map((u) => [u.id, u.name]));
  res.json({
    range,
    clocked_in_now: openSessions.data.map((s) => ({
      user_id: s.user_id,
      name: nameById.get(s.user_id) ?? null,
      clock_in: s.clock_in,
      minutes_so_far: round(minutesBetween(s.clock_in), 0),
    })),
    daily_hours: hours.data.map((row) => ({
      user_id: row.user_id,
      name: nameById.get(row.user_id) ?? null,
      day: row.day,
      hours_clocked: Number(row.hours_clocked),
    })),
  });
});

module.exports = router;
