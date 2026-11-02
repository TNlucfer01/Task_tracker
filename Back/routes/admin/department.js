const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
res.send("Admin Department details");
});

router.post("/add", (req, res) => {
res.send("Admin Department add details");
}   );

router.put("/update/:id", (req, res) => {
res.send("Admin Department update details");
});


router.delete("/delete/:id", (req, res) => {
res.send("Admin Department delete details");
});



module.exports = router;