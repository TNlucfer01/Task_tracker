const express = require("express");
const supabase = require("./config/db");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const requireAuth = require("./middleware/requireAuth");
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
// TODO: admin routes also need an admin-role check once users have a role column.
app.use("/api/admin", requireAuth, adminRoutes);
app.use("/api/user", requireAuth, userRoutes);

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found." });
});

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
