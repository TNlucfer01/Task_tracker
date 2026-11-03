const express = require("express");
const supabase = require("../../../config/db");
const { HttpError, run, parseId, minutesBetween, round } = require("../../../utils/http");
const { dayRange, buildUserSummaries, indexBy, isOverdue, RANK_METRICS } = require("./shared");

const router = express.Router();

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
    run(supabase
      .from("tasks")
      .select("id, name, status, deadline, estimated_minutes, created_at, completed_at, project:projects(id, name)")
      .eq("assigned_to", userId)
      .order("created_at", { ascending: false })),
    run(supabase.from("v_task_actual_vs_estimate").select("task_id, estimated_minutes, actual_minutes").eq("assigned_to", userId)),
    run(supabase
      .from("v_daily_hours")
      .select("day, hours_clocked")
      .eq("user_id", userId)
      .gte("day", range.from)
      .lte("day", range.to)
      .order("day")),
    run(supabase
      .from("work_sessions")
      .select("id, clock_in, clock_out")
      .eq("user_id", userId)
      .order("clock_in", { ascending: false })
      .limit(20)),
    run(supabase
      .from("task_time_logs")
      .select("id, started_at, ended_at, task:tasks(id, name)")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(20)),
    run(supabase
      .from("task_reviews")
      .select("id, rating, needed_rework, comments, reviewed_at, task:tasks!inner(id, name, assigned_to)")
      .eq("task.assigned_to", userId)
      .order("reviewed_at", { ascending: false })
      .limit(20)),
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
    recent_sessions: sessions.data.map((session) => ({ ...session, minutes: round(minutesBetween(session.clock_in, session.clock_out), 0) })),
    recent_time_logs: timeLogs.data.map((log) => ({ ...log, minutes: round(minutesBetween(log.started_at, log.ended_at), 0) })),
    recent_reviews: reviews.data.map(({ task, ...review }) => ({ ...review, task: { id: task.id, name: task.name } })),
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
  const ranked = users
    .filter((user) => user.is_active)
    .sort((a, b) => {
      if (a[by] === null && b[by] === null) return 0;
      if (a[by] === null) return 1;
      if (b[by] === null) return -1;
      return direction * (a[by] - b[by]);
    })
    .map((user, i) => ({ rank: user[by] === null ? null : i + 1, ...user }));

  res.json({ by, order: RANK_METRICS[by], range, users: ranked });
});

module.exports = router;
