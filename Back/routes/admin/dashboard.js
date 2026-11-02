const express = require("express");
const router = express.Router();

router.get("/tasks", (req, res) => {
  res.send("Admin Dashboard-task details");
});

router.get("/projects", (req, res) => {
  res.send("Admin Dashboard-project details");
});

router.get("/users", (req, res) => {
  res.send("Admin Dashboard-user details");
});

router.get("/rank", (req, res) => {
  res.send("Admin Dashboard-rank details");
});


module.exports = router;