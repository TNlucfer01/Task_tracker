const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.send("Admin Task details");
});

router.post("/add", (req, res) => {
  res.send("Admin Task add details");
});

router.put("/update/:id", (req, res) => {
  res.send("Admin Task update details");
});

router.delete("/delete/:id", (req, res) => {
  res.send("Admin Task delete details");
});

module.exports = router;