# Task Tracker

Task and work tracking for a medium-sized organization. Every role signs in to the same app and sees
what its role allows: employees see their own work, managers see their department, admins and HR see
the whole company.

- **Roles and permissions.** Admins create roles with permission checkboxes and a data scope
  (own work, department, or whole company). Admin, Manager, Team lead, HR and Employee come built in.
- **Projects** with a key (`MOB`), owner, department, deadline and **custom fields** (text, number,
  date, select, multi-select, checkbox, link) that appear on every task.
- **Tasks are Markdown pages** with properties: status, priority, assignee, dates, estimate, labels and
  the project's fields. Download any task as `.md` (front matter + body) or import one.
- **List and Kanban board**, filters kept in the URL.
- **Reviews**: the assignee submits, a reviewer approves with a 1–5 rating or sends it back with a note.
  Done and Rework only happen through reviews.
- **Comments** with Markdown and `@name` mentions; **notifications** for assignments, reviews,
  comments, and due/overdue reminders.
- **Time tracking**: clock in/out, task timers, attendance, and corrections with a recorded reason.
- **Dashboard, People and Reports**: KPIs, what needs attention, projects split by department, hours
  trend, per-person delivery and quality, and CSV exports.

## Setup

1. **Database.** In Supabase, open *Connect → Session pooler* and copy the connection string.
   Run the schema once (it rebuilds the tables, keeping existing accounts), and optionally the demo data:

   ```bash
   cd Back
   npm install
   cp .env.example .env        # set DATABASE_URL and a random JWT_SECRET (32+ bytes)
   npm run sql -- db/migrations/001_rebuild.sql db/migrations/002_lock_helper_function.sql
   npm run sql -- db/seed/demo.sql          # optional demo company, password TaskTracker@123
   npm run create-admin -- admin admin@yourco.com 'A-strong-password'   # on a fresh database
   ```

   `db/seed/remove-demo.sql` removes the demo data again.

2. **Backend:** `npm run dev` (or `npm start`) in `Back/`. Tests: `npm test` (runs against an
   in-memory Postgres, no Supabase needed).

3. **Frontend:**

   ```bash
   cd Front
   cp .env.example .env        # VITE_API_URL=http://localhost:3000
   npm install
   npm run dev
   ```

Demo sign-ins (after `demo.sql`): `ravi` (Manager, Development), `arjun` (Team lead), `priya`
(Employee), `lakshmi` (HR), `meena` (Manager, Design), all with `TaskTracker@123`.

## Host the app online

The simplest setup is **Render** for the web app and **Supabase** for PostgreSQL. Render builds the
frontend and serves it from the same web service as the API, so login cookies stay same-origin.

1. Push this repository to GitHub and create or update your Supabase database. If the schema is
   already installed, do not rerun the migrations; `001_rebuild.sql` changes database tables.
2. In Render, choose **New → Blueprint**, select this repository, and apply `render.yaml`.
3. When prompted, set `DATABASE_URL` to your Supabase **Session pooler** connection string. Keep it
   private. Render generates `JWT_SECRET` automatically.
4. Wait for the service to become healthy, then open its `onrender.com` URL. The frontend and API
   are served together; no `VITE_API_URL` setting is needed.
5. To use a custom domain, add it to the Render service and configure its DNS as Render instructs.
   Keep the app and API on the same origin.

The deployment does not run database migrations or seed scripts. Back up production data and apply
any future schema migration deliberately. The free Render plan may sleep when idle; choose a paid
plan if the app needs to stay available continuously.

## Code structure

```
Back/
  index.js                 starts the server
  src/app.js               Express app (CORS, JSON, cookies, routes, errors)
  src/routes.js            mounts each module under /api
  src/config.js, db.js     environment and the Postgres client
  src/access.js            scope filters: what a role can see
  src/middleware/          auth (session cookie, permissions) and error mapping
  src/lib/                 validation, dates, CSV, Markdown front matter
  src/modules/<name>/      one folder per feature: auth, users, roles, departments, projects,
                           tasks, comments, reviews, notifications, time, people, dashboard, reports
  db/migrations, db/seed   schema (tables, triggers, time functions, views) and demo data
  test/                    API tests
Front/src/
  api/                     client, types, and every endpoint by module
  lib/                     router, session, clock, formatting, Markdown, theme, toasts
  components/              design-system kit, shell, task views, editor, charts
  pages/                   one file per page
```

To add a feature: add a module folder in `Back/src/modules`, mount it in `src/routes.js`, add its
permission to the `permissions` table if it needs one, add endpoints to `Front/src/api/endpoints.ts`,
and a page in `Front/src/pages` plus a nav entry in `components/Shell.tsx`.
