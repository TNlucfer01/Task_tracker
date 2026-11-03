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

   Users with `dashboard.view` land on the dashboard; other users see their assigned tasks.

## Code structure

- `Back/app.js` configures Express and exports the app; `Back/index.js` starts the HTTP server.
- `Back/routes/index.js` mounts API route groups, with shared authentication and error middleware under `Back/middleware/`.
- `Back/routes/admin/dashboard/` groups dashboard endpoints by domain; `shared.js` contains common queries and calculations.
- `Front/src/api/` separates the request client, shared API types, authentication, tasks, and admin APIs. Page-level code imports from the relevant feature module. `Front/src/utils/api.ts` remains as a compatibility barrel.
- `Front/src/pages/admin/`, `Front/src/components/`, and `Front/src/lib/` contain admin screens, reusable UI, and shared client utilities respectively.

## Custom login

Login uses the Supabase `users` table and resolves each user's role from `roles` and `role_permissions`. The database role name, scope, and permissions are reloaded on every request. `name` is the username; email is unique (case-insensitive), and passwords are bcrypt hashes. There is no public sign-up route.

The backend issues an eight-hour JWT in an HttpOnly cookie and verifies it on protected routes. The `GET /api/tasks` endpoint returns only tasks whose `assignee_id` is the signed-in user's `id`.

Keep `SUPABASE_SECRET_KEY` and `JWT_SECRET` only in `Back/.env`; never add them to frontend environment variables or commit `.env` files.

## Roles

Roles are data-driven. The current database includes Admin, Manager, Team lead, HR, and Employee roles, with `all`, `department`, or `own` data scopes and explicit permissions. Login and `GET /api/auth/me` return the user's role, scope, and permissions. Deactivating a user or changing their role takes effect immediately; deactivated users cannot sign in.

- `/api/admin/*` requires `dashboard.view`; user and department management endpoints also check their specific permissions.
- `/api/user/*` requires `time.track`.
- `/api/tasks` returns the signed-in user's assigned tasks.

## Admin dashboard API

All routes are `GET`, require `dashboard.view`, and are under `/api/admin/dashboard`. Results are restricted to the signed-in user's role scope. `from` and `to` are calendar days (`YYYY-MM-DD`) in India time, and default to the last 30 days.

| Route | Returns |
| --- | --- |
| `/overview` | Counts of users, projects and tasks by status, overdue tasks, who is clocked in now, hours clocked today |
| `/users?role=user\|admin\|all&from&to` | One row per user: tasks done, open and overdue tasks, on-time %, average rating, rework count, hours clocked, clocked-in status |
| `/users/:id?from&to` | The same summary for one user, plus their tasks (with actual vs estimated minutes), daily hours, recent sessions, timers and reviews |
| `/projects?status` | Each project with task counts, overdue tasks and progress % |
| `/tasks?status&project_id&assigned_to&overdue=true&limit` | Tasks with project, assignee and actual minutes (default limit 100, max 500); `assigned_to` filters the database's `assignee_id` |
| `/rank?by=tasks_done\|on_time_pct\|avg_rating\|hours_clocked\|rework_bounces&from&to` | Active users ordered by one metric; users with no data for it are listed last with `rank: null` |
| `/attendance?from&to` | Who is clocked in now, and hours per user per day |

## Managing users (admin)

In the dashboard, use **Add person** on the People page, or **Edit details** on a person's page. The API is under `/api/admin/users` and requires `people.manage` for changes:

| Method and route | Does |
| --- | --- |
| `GET /roles` | List available roles and their permissions |
| `GET /` | List users (`?role=<role name or id>`, `?active=true\|false`) |
| `GET /:id` | One user |
| `POST /` | Create `{ name, email, password, role_id?, department_id?, title? }` (defaults to Employee) |
| `PATCH /:id` | Change any of `name`, `email`, `role_id`, `department_id`, `title`, `is_active`, `password` |
| `DELETE /:id` | Permanently delete a user with no history |

Rules:

- Names are also usernames, so they must be unique (ignoring case) and can't contain `@`. Emails are unique, and passwords are 8 to 128 characters.
- People with tasks, hours or reviews can't be deleted, because that would erase their history. Deactivate them instead (`is_active: false`): they can't sign in, and everything they did is kept.
- Users can't change their own role, deactivate themselves or delete themselves, so they can't lock themselves out.
- Passwords are stored as bcrypt hashes and are never returned by the API.

`GET /api/admin/department` lists departments for the form's picker.

## Design system

The UI follows the Task Tracker design system: a navy app frame, brand blue `primary`, a fixed set of task status colours, IBM Plex Sans, and light and dark themes that follow the operating system. The colour tokens live in `Front/src/index.css` as Tailwind theme variables (`bg-surface`, `text-ink-soft`, `bg-status-review`, `bg-series-1` and so on). Use those tokens instead of raw colours.

## Overview dashboard

`GET /api/admin/dashboard/summary` returns everything the overview shows in one request. "This week" means the last 7 days in India time.

- **People:** active team members, how many are clocked in now, and hours clocked today.
- **Tasks:** not started (`todo`), pending (in progress, in review and rework), completed, overdue, completed this week and due this week.
- **Projects:** status, progress, and tasks done of tasks assigned for each department.
- **Departments:** members, who's working now, open, overdue and completed tasks, hours this week, time on task timers as a share of clocked hours, and average review rating.
- **Needs attention:** tasks waiting for review, overdue tasks, and tasks due in the next 7 days.
- **On the clock**, a 14-day **hours trend** by department, and the latest **activity** (status changes).

The overview refreshes every 60 seconds while the tab is visible.
