// Mounts every module under /api. Everything except signing in requires a session.
const express = require("express");
const { requireAuth } = require("./middleware/auth");

const router = express.Router();

router.use("/auth", require("./modules/auth/routes"));
router.use(requireAuth);
router.use("/users", require("./modules/users/routes"));
router.use("/roles", require("./modules/roles/routes"));
router.use("/departments", require("./modules/departments/routes"));
router.use("/projects", require("./modules/projects/routes").router);
router.use("/tasks", require("./modules/tasks/routes"));
router.use("/", require("./modules/comments/routes"));
router.use("/", require("./modules/reviews/routes"));
router.use("/notifications", require("./modules/notifications/routes"));
router.use("/time", require("./modules/time/routes"));
router.use("/people", require("./modules/people/routes"));
router.use("/dashboard", require("./modules/dashboard/routes"));
router.use("/reports", require("./modules/reports/routes"));

router.use((req, res) => res.status(404).json({ error: "Not found." }));

module.exports = router;
