const express = require("express");
const supabase = require("./config/db");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const apiRoutes = require("./routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.locals.supabase = supabase;
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.use("/api", apiRoutes);
app.use(errorHandler);

module.exports = app;
