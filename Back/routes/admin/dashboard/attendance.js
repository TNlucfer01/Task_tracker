const express = require("express");
const supabase = require("../../../config/db");
const { run, minutesBetween, round } = require("../../../utils/http");
const { dayRange } = require("./shared");

const router = express.Router();

router.get("/attendance", async (req, res) => {
  const range = dayRange(req.query);
  const [users, openSessions, hours] = await Promise.all([
    run(supabase.from("users").select("id, name")),
    run(supabase.from("work_sessions").select("user_id, clock_in").is("clock_out", null).order("clock_in")),
    run(supabase
      .from("v_daily_hours")
      .select("user_id, day, hours_clocked")
      .gte("day", range.from)
      .lte("day", range.to)
      .order("day")),
  ]);

  const nameById = new Map(users.data.map((user) => [user.id, user.name]));
  res.json({
    range,
    clocked_in_now: openSessions.data.map((session) => ({
      user_id: session.user_id,
      name: nameById.get(session.user_id) ?? null,
      clock_in: session.clock_in,
      minutes_so_far: round(minutesBetween(session.clock_in), 0),
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
