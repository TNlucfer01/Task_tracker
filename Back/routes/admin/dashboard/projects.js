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
    .select("id, name, description:description_md, status, deadline, created_at, completed_at, department_id, creator:users!projects_created_by_fkey(id, name)")
    .order("created_at", { ascending: false });
  if (status) projectsQuery = projectsQuery.eq("status", status);

  const [projects, tasks, users] = await Promise.all([
    run(projectsQuery),
    run(supabase.from("tasks").select("project_id, status, deadline, assignee_id")),
    run(supabase.from("users").select("id, department_id")),
  ]);

  const authUser = res.locals.authUser;
  const visibleUserIds = new Set(users.data.filter((user) =>
    authUser.scope === "all" ||
    (authUser.scope === "own" ? user.id === authUser.id : user.department_id === authUser.department_id),
  ).map((user) => user.id));
  const projectById = new Map(projects.data.map((project) => [project.id, project]));
  const visibleTasks = tasks.data.filter((task) => {
    if (authUser.scope === "all") return true;
    if (authUser.scope === "own") return task.assignee_id === authUser.id;
    return visibleUserIds.has(task.assignee_id) ||
      projectById.get(task.project_id)?.department_id === authUser.department_id;
  });
  const visibleProjectIds = new Set(visibleTasks.map((task) => task.project_id));
  const visibleProjects = projects.data.filter((project) =>
    authUser.scope === "all" ||
    visibleProjectIds.has(project.id) ||
    (authUser.scope === "department" && project.department_id === authUser.department_id),
  );
  const tasksByProject = new Map();
  for (const task of visibleTasks) {
    if (!tasksByProject.has(task.project_id)) tasksByProject.set(task.project_id, []);
    tasksByProject.get(task.project_id).push(task);
  }

  const now = Date.now();
  res.json({
    projects: visibleProjects.map((project) => {
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
