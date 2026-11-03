const express = require("express");
const supabase = require("../../config/db");
const { run } = require("../../utils/http");

const router = express.Router();

// Used by the user form's department picker.
router.get("/", async (req, res) => {
  const { data } = await run(supabase.from("departments").select("id, name, description").order("name"));
  res.json({ departments: data });
});

router.post("/add", (req, res) => {
  res.status(501).json({ error: "Not implemented: Admin Department add details" });
});

router.put("/update/:id", (req, res) => {
  res.status(501).json({ error: "Not implemented: Admin Department update details" });
});

router.delete("/delete/:id", (req, res) => {
  res.status(501).json({ error: "Not implemented: Admin Department delete details" });
});

module.exports = router;
