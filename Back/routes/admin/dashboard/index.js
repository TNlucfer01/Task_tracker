const express = require("express");
const router = express.Router();

router.use(require("./overview"));
router.use(require("./summary"));
router.use(require("./users"));
router.use(require("./projects"));
router.use(require("./tasks"));
router.use(require("./attendance"));

module.exports = router;
