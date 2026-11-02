const express = require("express");
const router = express.Router();

router.get("/tasks", (req, res) => {
    res.send("User dashboard add details");
});

router.post("/tasks", (req, res) => {
    res.send("User dashboard add details");
});
router.put("/tasks/:id", (req, res) => {
    res.send("User dashboard update details");
});

module.exports = router;