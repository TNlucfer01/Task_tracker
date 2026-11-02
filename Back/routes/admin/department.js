const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
res.status(501).json({ error: "Not implemented: Admin Department details" });
});

router.post("/add", (req, res) => {
res.status(501).json({ error: "Not implemented: Admin Department add details" });
}   );

router.put("/update/:id", (req, res) => {
res.status(501).json({ error: "Not implemented: Admin Department update details" });
});


router.delete("/delete/:id", (req, res) => {
res.status(501).json({ error: "Not implemented: Admin Department delete details" });
});



module.exports = router;