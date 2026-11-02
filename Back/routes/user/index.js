const express = require("express");
const router = express.Router();
const taskRoutes = require("./task");
const dashboardRoutes = require("./dashboard");

router.use("/task", taskRoutes);
router.use("/dashboard", dashboardRoutes);

module.exports = router;
