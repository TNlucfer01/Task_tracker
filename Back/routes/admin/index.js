const express= require("express");
const router   = express.Router();
const userRoutes = require("./user");
const projectRoutes = require("./project");
const taskRoutes = require("./tasks");
const departmentRoutes = require("./department");
const dashboardRoutes = require("./dashboard");

router.use("/user", userRoutes);
router.use("/project", projectRoutes);
router.use("/tasks", taskRoutes);
router.use("/department", departmentRoutes);
router.use("/dashboard", dashboardRoutes);

module.exports = router;
