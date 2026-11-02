const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.status(501).json({ error: "Not implemented: Admin Task details" });
});

router.post("/add", (req, res) => {
  res.status(501).json({ error: "Not implemented: Admin Task add details" });
});

router.put("/update/:id", (req, res) => {
  res.status(501).json({ error: "Not implemented: Admin Task update details" });
});

router.delete("/delete/:id", (req, res) => {
  res.status(501).json({ error: "Not implemented: Admin Task delete details" });
});

module.exports = router;