const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");
const authRoutes = require("./auth");
const taskRoutes = require("./tasks");
const adminRoutes = require("./admin");
const userRoutes = require("./user");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/tasks", taskRoutes);
router.use("/admin", requireAuth, requireRole("admin"), adminRoutes);
router.use("/user", requireAuth, requireRole("user"), userRoutes);

router.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

module.exports = router;
