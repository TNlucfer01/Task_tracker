const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
    res.status(501).json({ error: "Not implemented: User dashboard add details" });
});

router.post("/", (req, res) => {
    res.status(501).json({ error: "Not implemented: User dashboard add details" });
});
router.put("/:id", (req, res) => {
    res.status(501).json({ error: "Not implemented: User dashboard update details" });
});

module.exports = router;