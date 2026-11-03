const supabase = require("../../../config/db");
const { HttpError, run, parseDay, todayInIndia, round } = require("../../../utils/http");
const { roleKey } = require("../../../utils/authorization");

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

async function buildUserSummaries({ role, from, to, userId, authUser }) {
  let usersQuery = supabase
    .from("users")
    .select("id, name, email, role_id, department_id, title, is_active, role:roles!users_role_id_fkey(id, name, scope), department:departments!users_department_id_fkey(id, name)")
    .order("name");
  if (authUser?.scope === "department") {
    usersQuery = authUser.department_id === null
      ? usersQuery.is("department_id", null)
      : usersQuery.eq("department_id", authUser.department_id);
  } else if (authUser?.scope === "own") {
    usersQuery = usersQuery.eq("id", authUser.id);
  }
  if (userId) usersQuery = usersQuery.eq("id", userId);

  const users = await run(usersQuery);
  const visibleIds = users.data.map((user) => user.id);
  if (userId && !visibleIds.includes(userId)) return [];
  const scope = (query, column = "user_id") => {
    if (authUser?.scope === "all" || !authUser?.scope) return userId ? query.eq(column, userId) : query;
    const ids = userId ? [userId] : visibleIds;
    return ids.length ? query.in(column, ids) : query.eq(column, -1);
  };
  const [taskStats, quality, reviews, tasks, hours, openSessions] = await Promise.all([
    run(scope(supabase.from("v_user_task_stats").select("user_id, tasks_done, on_time_pct"))),
    run(scope(supabase.from("v_user_quality").select("user_id, avg_rating, changes_requested"))),
    run(scope(supabase.from("task_reviews").select("assignee_id, decision").not("assignee_id", "is", null), "assignee_id")),
    run(scope(supabase.from("tasks").select("assignee_id, status, deadline").not("assignee_id", "is", null), "assignee_id")),
    run(scope(supabase.from("v_daily_hours").select("user_id, day, hours_clocked").gte("day", from).lte("day", to))),
    run(scope(supabase.from("work_sessions").select("user_id, clock_in").is("clock_out", null))),
  ]);

  const statsByUser = indexBy(taskStats.data, "user_id");
  const qualityByUser = indexBy(quality.data, "user_id");
  const sessionByUser = indexBy(openSessions.data, "user_id");
  const reworkByUser = new Map();
  for (const review of reviews.data) {
    if (review.decision === "changes_requested") {
      reworkByUser.set(review.assignee_id, (reworkByUser.get(review.assignee_id) ?? 0) + 1);
    }
  }
  const hoursByUser = new Map();
  for (const row of hours.data) {
    hoursByUser.set(row.user_id, (hoursByUser.get(row.user_id) ?? 0) + Number(row.hours_clocked));
  }

  const now = Date.now();
  const openByUser = new Map();
  const overdueByUser = new Map();
  for (const task of tasks.data) {
    if (task.status !== "done") openByUser.set(task.assignee_id, (openByUser.get(task.assignee_id) ?? 0) + 1);
    if (isOverdue(task, now)) overdueByUser.set(task.assignee_id, (overdueByUser.get(task.assignee_id) ?? 0) + 1);
  }

  return users.data.map((user) => {
    const stats = statsByUser.get(user.id);
    const qualityStats = qualityByUser.get(user.id);
    const session = sessionByUser.get(user.id);
    return {
      ...user,
      role: roleKey(user.role?.name),
      role_name: user.role?.name ?? "Unknown",
      scope: user.role?.scope ?? "own",
      tasks_done: Number(stats?.tasks_done ?? 0),
      open_tasks: openByUser.get(user.id) ?? 0,
      overdue_tasks: overdueByUser.get(user.id) ?? 0,
      on_time_pct: stats?.on_time_pct === null || stats?.on_time_pct === undefined ? null : Number(stats.on_time_pct),
      avg_rating: qualityStats?.avg_rating === null || qualityStats?.avg_rating === undefined ? null : Number(qualityStats.avg_rating),
      reviews_needing_rework: Number(qualityStats?.changes_requested ?? 0),
      rework_bounces: Number(reworkByUser.get(user.id) ?? 0),
      hours_clocked: round(hoursByUser.get(user.id) ?? 0, 2),
      clocked_in: Boolean(session),
      clocked_in_since: session?.clock_in ?? null,
    };
  }).filter((user) => {
    if (!role || role === "all") return true;
    if (role === "admin") return user.role === "admin";
    return user.role !== "admin";
  });
}

module.exports = {
  TASK_STATUSES,
  PROJECT_STATUSES,
  RANK_METRICS,
  dayRange,
  isOverdue,
  countBy,
  indexBy,
  buildUserSummaries,
};
