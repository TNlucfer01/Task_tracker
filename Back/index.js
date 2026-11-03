const express = require("express");
const supabase = require("./config/db");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const requireAuth = require("./middleware/requireAuth");
const requireRole = require("./middleware/requireRole");
const { HttpError } = require("./utils/http");
const authRoutes = require("./routes/auth");
const taskRoutes = require("./routes/tasks");
const adminRoutes = require("./routes/admin");
const userRoutes = require("./routes/user");

const app = express();
const port = Number(process.env.PORT) || 3000;

app.locals.supabase = supabase;
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/admin", requireAuth, requireRole("admin"), adminRoutes);
app.use("/api/user", requireAuth, requireRole("user"), userRoutes);

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found." });
});

// Express 5 forwards errors thrown in async handlers here.
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body must be valid JSON." });
  }
  console.error(`${req.method} ${req.originalUrl} failed:`, error);
  return res.status(500).json({ error: "Something went wrong on the server." });
});

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
