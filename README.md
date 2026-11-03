# Task Tracker

## Local development

1. Copy `Back/.env.example` to `Back/.env` and set your Supabase URL, server-only secret key, and a random `JWT_SECRET` of at least 32 bytes.
2. Copy `Front/.env.example` to `Front/.env`.
3. Install dependencies and start the backend:

   ```powershell
   cd Back
   npm install
   npm run seed   # optional: adds 3 dummy users (aathi, priya, karthik), password TaskTracker@123
   npm run dev    # or: npm start
   ```

4. In another terminal, start the frontend. It uses Tailwind CSS v4 through its Vite plugin:

   ```powershell
   cd Front
   npm install
   npm install tailwindcss @tailwindcss/vite
   npm run dev
   ```

   Admins land on the team dashboard; everyone else sees their own tasks.

## Custom login

Login uses the Supabase `users` table (`id`, `name`, `email`, `password_hash`, `role`, `is_active`). `name` is the username; email is unique (case-insensitive), and passwords must be bcrypt hashes. There is no public sign-up route.

The backend issues an eight-hour JWT in an HttpOnly cookie and verifies it on protected routes. The `GET /api/tasks` endpoint returns only tasks whose `assigned_to` is the signed-in user's `id`.

Keep `SUPABASE_SECRET_KEY` and `JWT_SECRET` only in `Back/.env`; never add them to frontend environment variables or commit `.env` files.

## Roles

Every user has a `role` of `admin` or `user`. Login returns it, and `GET /api/auth/me` returns the current one. On every request the backend re-reads the user's role and `is_active` flag from the database, so deactivating someone or changing their role takes effect immediately. Deactivated users cannot sign in.

- `/api/admin/*` requires an admin.
- `/api/user/*` requires a regular user.
- `/api/tasks` returns the signed-in user's assigned tasks.

## Admin dashboard API

All routes are `GET`, admin only, and under `/api/admin/dashboard`. `from` and `to` are calendar days (`YYYY-MM-DD`) in India time, and default to the last 30 days.

| Route | Returns |
| --- | --- |
| `/overview` | Counts of users, projects and tasks by status, overdue tasks, who is clocked in now, hours clocked today |
| `/users?role=user\|admin\|all&from&to` | One row per user: tasks done, open and overdue tasks, on-time %, average rating, rework count, hours clocked, clocked-in status |
| `/users/:id?from&to` | The same summary for one user, plus their tasks (with actual vs estimated minutes), daily hours, recent sessions, timers and reviews |
| `/projects?status` | Each project with task counts, overdue tasks and progress % |
| `/tasks?status&project_id&assigned_to&overdue=true&limit` | Tasks with project, assignee and actual minutes (default limit 100, max 500) |
| `/rank?by=tasks_done\|on_time_pct\|avg_rating\|hours_clocked\|rework_bounces&from&to` | Active users ordered by one metric; users with no data for it are listed last with `rank: null` |
| `/attendance?from&to` | Who is clocked in now, and hours per user per day |
