const express = require("express");
const router = express.Router();


router.get("/", (req, res) => {
  res.status(501).json({ error: "Not implemented: Admin User details" });
});

router.post("/add", (req, res) => {
  res.status(501).json({ error: "Not implemented: Admin User add details" });
});

router.put("/update/:id", (req, res) => {
  res.status(501).json({ error: "Not implemented: Admin User update details" });
});
router.delete("/delete/:id", (req, res) => {
  res.status(501).json({ error: "Not implemented: Admin User delete details" });
});

module.exports = router;