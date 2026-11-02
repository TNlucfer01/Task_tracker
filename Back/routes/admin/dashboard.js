const express = require("express");
const router = express.Router();

router.get("/tasks", (req, res) => {
  res.status(501).json({ error: "Not implemented: Admin Dashboard-task details" });
});

router.get("/projects", (req, res) => {
  res.status(501).json({ error: "Not implemented: Admin Dashboard-project details" });
});

router.get("/users", (req, res) => {
  res.status(501).json({ error: "Not implemented: Admin Dashboard-user details" });
});

router.get("/rank", (req, res) => {
  res.status(501).json({ error: "Not implemented: Admin Dashboard-rank details" });
});


module.exports = router;