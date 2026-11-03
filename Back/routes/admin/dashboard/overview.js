const express = require("express");
const supabase = require("../../../config/db");
const { run, todayInIndia, round } = require("../../../utils/http");
const { TASK_STATUSES, PROJECT_STATUSES, isOverdue, countBy } = require("./shared");
const { roleKey } = require("../../../utils/authorization");

const router = express.Router();

router.get("/overview", async (req, res) => {
  const today = todayInIndia();
  const [users, projects, tasks, openSessions, hoursToday] = await Promise.all([
    run(supabase.from("users").select("id, role:roles!users_role_id_fkey(name), department_id, is_active")),
    run(supabase.from("projects").select("id, status, department_id")),
    run(supabase.from("tasks").select("id, status, deadline, project_id, assignee_id")),
    run(supabase.from("work_sessions").select("user_id").is("clock_out", null)),
    run(supabase.from("v_daily_hours").select("user_id, hours_clocked").eq("day", today)),
  ]);

  const authUser = res.locals.authUser;
  const visibleUsers = users.data.filter((user) =>
    authUser.scope === "all" ||
    (authUser.scope === "own" ? user.id === authUser.id : user.department_id === authUser.department_id),
  );
  const visibleUserIds = new Set(visibleUsers.map((user) => user.id));
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
  const visibleSessions = openSessions.data.filter((session) => visibleUserIds.has(session.user_id));
  const visibleHours = hoursToday.data.filter((row) => visibleUserIds.has(row.user_id));
  const now = Date.now();
  res.json({
    date: today,
    users: {
      total: visibleUsers.length,
      active: visibleUsers.filter((u) => u.is_active).length,
      admins: visibleUsers.filter((u) => roleKey(u.role?.name) === "admin").length,
    },
    projects: {
      total: visibleProjects.length,
      by_status: countBy(visibleProjects, "status", PROJECT_STATUSES),
    },
    tasks: {
      total: visibleTasks.length,
      by_status: countBy(visibleTasks, "status", TASK_STATUSES),
      overdue: visibleTasks.filter((t) => isOverdue(t, now)).length,
    },
    attendance: {
      clocked_in_now: visibleSessions.length,
      hours_today: round(visibleHours.reduce((sum, r) => sum + Number(r.hours_clocked), 0), 2),
    },
  });
});

module.exports = router;
