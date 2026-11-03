const express= require("express");
const router   = express.Router();
const requirePermission = require("../../middleware/requirePermission");
const userRoutes = require("./user");
const projectRoutes = require("./project");
const taskRoutes = require("./tasks");
const departmentRoutes = require("./department");
const dashboardRoutes = require("./dashboard");

router.use("/users", requirePermission("people.view"), userRoutes);
router.use("/project", requirePermission("projects.manage"), projectRoutes);
router.use("/tasks", requirePermission("tasks.create"), taskRoutes);
router.use("/department", requirePermission("departments.manage"), departmentRoutes);
router.use("/dashboard", dashboardRoutes);

module.exports = router;
