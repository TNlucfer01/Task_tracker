const express = require("express");
const supabase = require("../../../config/db");
const { run, todayInIndia, round } = require("../../../utils/http");
const { TASK_STATUSES, PROJECT_STATUSES, isOverdue, countBy } = require("./shared");

const router = express.Router();

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
    users: { // no of users, 
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

module.exports = router;
