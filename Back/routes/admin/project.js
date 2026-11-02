const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
    res.status(501).json({ error: "Not implemented: Admin Project details" });
  });

router.post("/add", (req, res) => {
    res.status(501).json({ error: "Not implemented: Admin Project add details" });
  });

router.put("/update/:id", (req, res) => {
    res.status(501).json({ error: "Not implemented: Admin Project update details" });
  });

router.delete("/delete/:id", (req, res) => {
    res.status(501).json({ error: "Not implemented: Admin Project delete details" });
  });


module.exports = router;