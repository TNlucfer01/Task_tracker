const express = require("express");
const supabase = require("../../../config/db");
const { HttpError, run, parseId } = require("../../../utils/http");
const { TASK_STATUSES, isOverdue, indexBy } = require("./shared");

const router = express.Router();

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
  const ids = tasks.data.map((task) => task.id);
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

module.exports = router;
