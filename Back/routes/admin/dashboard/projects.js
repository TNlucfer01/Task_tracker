const express = require("express");
const supabase = require("../../../config/db");
const { HttpError, run, round } = require("../../../utils/http");
const { PROJECT_STATUSES, TASK_STATUSES, isOverdue, countBy } = require("./shared");

const router = express.Router();

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
      const done = projectTasks.filter((task) => task.status === "done").length;
      return {
        ...project,
        overdue: project.status !== "completed" && project.deadline !== null && new Date(project.deadline) < now,
        task_count: projectTasks.length,
        tasks_done: done,
        tasks_overdue: projectTasks.filter((task) => isOverdue(task, now)).length,
        tasks_by_status: countBy(projectTasks, "status", TASK_STATUSES),
        progress_pct: projectTasks.length ? round((100 * done) / projectTasks.length, 1) : 0,
      };
    }),
  });
});

module.exports = router;
