const express = require("express");
const router = express.Router();


router.get("/", (req, res) => {
  res.send("Admin User details");
});

router.post("/add", (req, res) => {
  res.send("Admin User add details");
});

router.put("/update/:id", (req, res) => {
  res.send("Admin User update details");
});
router.delete("/delete/:id", (req, res) => {
  res.send("Admin User delete details");
});

module.exports = router;