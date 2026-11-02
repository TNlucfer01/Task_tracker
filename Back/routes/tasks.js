const express = require("express");
const supabase = require("../config/db");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const { id } = res.locals.authUser;
    const { data, error } = await supabase
      .from("tasks")
      .select("id, name, description, project_id, user_assigned_id:user_assigened_id, created_at")
      .eq("user_assigened_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Assigned task lookup failed:", error);
      return res.status(500).json({ error: "Unable to load your tasks." });
    }

    return res.json({ tasks: data });
  } catch (error) {
    console.error("Assigned task lookup failed:", error);
    return res.status(500).json({ error: "Unable to load your tasks." });
  }
});

module.exports = router;
