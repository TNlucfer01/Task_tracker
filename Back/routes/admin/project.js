const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
    res.send("Admin Project details");
  });

router.post("/add", (req, res) => {
    res.send("Admin Project add details");
  });

router.put("/update/:id", (req, res) => {
    res.send("Admin Project update details");
  });

router.delete("/delete/:id", (req, res) => {
    res.send("Admin Project delete details");
  });


module.exports = router;