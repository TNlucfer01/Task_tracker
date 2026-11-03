-- 001_rebuild.sql
-- Rebuilds the Task Tracker schema for custom roles, Markdown tasks with properties, reviews,
-- comments, notifications and time tracking. Keeps the three real accounts; everything else
-- (demo data) is dropped and reseeded separately by db/seed/demo.sql.
--
-- The backend talks to the database with the secret key only. Row-level security is on with
-- no policies, and the anon/authenticated roles get no privileges, so the browser can never
-- read or write tables directly.

-- ---------------------------------------------------------------------------------------------
-- 0. Keep the real accounts
-- ---------------------------------------------------------------------------------------------
-- On a brand-new database there is nothing to keep; create the first admin afterwards with
-- `npm run create-admin`.
create schema if not exists migration_tmp;
drop table if exists migration_tmp.keep_users;
create table migration_tmp.keep_users (
  name text, email text, password_hash text, old_role text, department text, is_active boolean, created_at timestamptz
);
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'users' and column_name = 'role') then
    insert into migration_tmp.keep_users
    select u.name, u.email, u.password_hash, u.role::text, d.name, u.is_active, u.created_at
    from public.users u
    left join public.departments d on d.id = u.department_id
    where lower(u.email) in ('ihdaa2006@gmail.com', 'aathi2006@gmail.com', 'raja@gmail.com');
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 1. Drop the old schema
-- ---------------------------------------------------------------------------------------------
drop view if exists public.v_daily_hours, public.v_task_actual_vs_estimate, public.v_user_quality,
  public.v_user_rework, public.v_user_task_stats cascade;
drop table if exists public.task_status_history, public.task_reviews, public.task_time_logs,
  public.work_sessions, public.tasks, public.projects, public.users, public.departments cascade;
drop function if exists public.clock_in(bigint), public.clock_out(bigint), public.start_task_timer(bigint, bigint),
  public.stop_task_timer(bigint), public.tasks_before(), public.tasks_history() cascade;
drop type if exists public.task_status, public.project_status, public.user_role cascade;

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------------------------
-- 2. Types
-- ---------------------------------------------------------------------------------------------
create type public.task_status as enum ('todo', 'in_progress', 'in_review', 'rework', 'done');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.project_status as enum ('planned', 'active', 'on_hold', 'completed');
create type public.data_scope as enum ('all', 'department', 'own');
create type public.field_type as enum ('text', 'number', 'date', 'select', 'multi_select', 'checkbox', 'url');
create type public.review_decision as enum ('approved', 'changes_requested');

-- ---------------------------------------------------------------------------------------------
-- 3. Roles and permissions
-- ---------------------------------------------------------------------------------------------
-- The permission catalogue. Code checks these keys; roles grant any combination of them.
create table public.permissions (
  key text primary key check (key ~ '^[a-z]+\.[a-z_]+$'),
  label text not null,
  grp text not null,
  description text not null,
  position int not null default 0
);

-- A role is a named bundle of permissions plus a data scope:
-- all = the whole company, department = the user's own department, own = only their own work.
create table public.roles (
  id bigint generated always as identity primary key,
  name text not null check (length(trim(name)) between 2 and 40),
  description text not null default '',
  scope public.data_scope not null default 'own',
  is_system boolean not null default false,   -- the Admin role: can't be deleted or lose permissions
  created_at timestamptz not null default now()
);
create unique index roles_name_uq on public.roles (lower(name));

create table public.role_permissions (
  role_id bigint not null references public.roles(id) on delete cascade,
  permission text not null references public.permissions(key) on delete cascade,
  primary key (role_id, permission)
);

-- ---------------------------------------------------------------------------------------------
-- 4. People and departments
-- ---------------------------------------------------------------------------------------------
create table public.departments (
  id bigint generated always as identity primary key,
  name text not null check (length(trim(name)) between 2 and 60),
  description text not null default '',
  head_id bigint,                              -- FK added after users exists
  created_at timestamptz not null default now()
);
create unique index departments_name_uq on public.departments (lower(name));

create table public.users (
  id bigint generated always as identity primary key,
  name text not null check (length(trim(name)) between 2 and 60 and position('@' in name) = 0),
  email text not null check (length(email) <= 254),
  password_hash text not null,
  role_id bigint not null references public.roles(id),
  department_id bigint references public.departments(id) on delete set null,
  title text not null default '',              -- job title, e.g. "Frontend developer"
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index users_email_uq on public.users (lower(email));
create unique index users_name_uq on public.users (lower(name));
create index users_department_idx on public.users (department_id);

alter table public.departments
  add constraint departments_head_fk foreign key (head_id) references public.users(id) on delete set null;

-- ---------------------------------------------------------------------------------------------
-- 5. Projects and their custom fields
-- ---------------------------------------------------------------------------------------------
create table public.projects (
  id bigint generated always as identity primary key,
  key text not null check (key ~ '^[A-Z][A-Z0-9]{1,9}$'),   -- prefix for task numbers, e.g. CPR-12
  name text not null check (length(trim(name)) between 2 and 120),
  description_md text not null default '',
  status public.project_status not null default 'planned',
  department_id bigint references public.departments(id) on delete set null,
  owner_id bigint references public.users(id) on delete set null,
  start_date date,
  deadline timestamptz,
  completed_at timestamptz,
  next_task_number int not null default 1,
  created_by bigint references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index projects_key_uq on public.projects (key);

-- Admin-defined task properties for one project (e.g. Client, Sprint, Severity).
create table public.project_fields (
  id bigint generated always as identity primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,39}$'),
  label text not null check (length(trim(label)) between 1 and 60),
  type public.field_type not null,
  options text[] not null default '{}',        -- choices for select and multi_select
  required boolean not null default false,
  position int not null default 0,
  unique (project_id, key)
);

-- ---------------------------------------------------------------------------------------------
-- 6. Tasks: a Markdown page plus properties
-- ---------------------------------------------------------------------------------------------
create table public.tasks (
  id bigint generated always as identity primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  number int not null,                         -- per project; shown as <project key>-<number>
  title text not null check (length(trim(title)) between 1 and 200),
  body_md text not null default '' check (length(body_md) <= 100000),
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  assignee_id bigint references public.users(id) on delete set null,
  reporter_id bigint references public.users(id) on delete set null,
  start_date date,
  deadline timestamptz,
  estimate_minutes int check (estimate_minutes > 0),
  labels text[] not null default '{}',
  properties jsonb not null default '{}' check (jsonb_typeof(properties) = 'object'),   -- custom field values by key
  position double precision not null default 0,                                        -- order within a board column
  updated_by bigint references public.users(id) on delete set null,                    -- who made the latest change
  completed_at timestamptz,
  completed_by bigint references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, number)
);
create index tasks_project_status_idx on public.tasks (project_id, status);
create index tasks_assignee_idx on public.tasks (assignee_id);
create index tasks_deadline_idx on public.tasks (deadline) where status <> 'done';

create table public.task_comments (
  id bigint generated always as identity primary key,
  task_id bigint not null references public.tasks(id) on delete cascade,
  author_id bigint references public.users(id) on delete set null,
  body_md text not null check (length(trim(body_md)) between 1 and 10000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index task_comments_task_idx on public.task_comments (task_id, created_at);

-- A review decision on work submitted for review. Approvals carry a 1-5 rating.
create table public.task_reviews (
  id bigint generated always as identity primary key,
  task_id bigint not null references public.tasks(id) on delete cascade,
  reviewer_id bigint references public.users(id) on delete set null,
  assignee_id bigint references public.users(id) on delete set null,   -- whose work was reviewed
  decision public.review_decision not null,
  rating smallint check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  check (decision = 'changes_requested' or rating is not null)
);
create index task_reviews_assignee_idx on public.task_reviews (assignee_id);

-- Everything that happened to a task, for the activity feed and rework metrics.
create table public.task_events (
  id bigint generated always as identity primary key,
  task_id bigint not null references public.tasks(id) on delete cascade,
  actor_id bigint references public.users(id) on delete set null,
  type text not null check (type in ('created', 'status', 'assignee', 'updated', 'comment', 'review')),
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index task_events_task_idx on public.task_events (task_id, created_at);
create index task_events_recent_idx on public.task_events (created_at desc);

-- ---------------------------------------------------------------------------------------------
-- 7. Notifications
-- ---------------------------------------------------------------------------------------------
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.users(id) on delete cascade,
  type text not null check (type in ('assigned', 'review_requested', 'approved', 'changes_requested', 'comment', 'overdue', 'due_soon')),
  title text not null,
  body text not null default '',
  task_id bigint references public.tasks(id) on delete cascade,
  actor_id bigint references public.users(id) on delete set null,
  dedupe_key text unique,                      -- stops repeat reminders, e.g. one overdue notice per task per day
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------------------------
-- 8. Time tracking
-- ---------------------------------------------------------------------------------------------
create table public.work_sessions (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.users(id) on delete cascade,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  check (clock_out is null or clock_out > clock_in),
  exclude using gist (user_id with =, tstzrange(clock_in, coalesce(clock_out, 'infinity')) with &&)
);
create unique index work_sessions_one_open on public.work_sessions (user_id) where clock_out is null;

create table public.task_time_logs (
  id bigint generated always as identity primary key,
  task_id bigint not null references public.tasks(id) on delete cascade,
  user_id bigint not null references public.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check (ended_at is null or ended_at > started_at)
);
create unique index task_time_logs_one_running on public.task_time_logs (user_id) where ended_at is null;
create index task_time_logs_task_idx on public.task_time_logs (task_id);

-- Audit trail for corrected clock-ins (forgotten clock-outs and mistakes).
create table public.time_corrections (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.work_sessions(id) on delete cascade,
  editor_id bigint references public.users(id) on delete set null,
  old_clock_in timestamptz not null,
  old_clock_out timestamptz,
  new_clock_in timestamptz not null,
  new_clock_out timestamptz,
  reason text not null check (length(trim(reason)) between 3 and 500),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- 9. Triggers
-- ---------------------------------------------------------------------------------------------
-- Gives a new task the next number in its project.
create or replace function public.tasks_assign_number() returns trigger
language plpgsql set search_path = public as $$
begin
  update projects set next_task_number = next_task_number + 1
   where id = new.project_id
  returning next_task_number - 1 into new.number;
  return new;
end $$;
create trigger tasks_assign_number before insert on public.tasks
  for each row execute function public.tasks_assign_number();

-- Stamps updated_at and completion (server time, never client time).
create or replace function public.tasks_before_write() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := now();
    new.completed_by := coalesce(new.updated_by, new.assignee_id);
  elsif new.status <> 'done' then
    new.completed_at := null;
    new.completed_by := null;
  end if;
  return new;
end $$;
create trigger tasks_before_write before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

-- Records creation, status changes and reassignment in task_events.
create or replace function public.tasks_log_events() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into task_events (task_id, actor_id, type, data)
    values (new.id, coalesce(new.updated_by, new.reporter_id), 'created', jsonb_build_object('status', new.status));
    return null;
  end if;
  if new.status is distinct from old.status then
    insert into task_events (task_id, actor_id, type, data)
    values (new.id, new.updated_by, 'status', jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  if new.assignee_id is distinct from old.assignee_id then
    insert into task_events (task_id, actor_id, type, data)
    values (new.id, new.updated_by, 'assignee', jsonb_build_object('from', old.assignee_id, 'to', new.assignee_id));
  end if;
  return null;
end $$;
create trigger tasks_log_events after insert or update on public.tasks
  for each row execute function public.tasks_log_events();

-- Keeps projects.updated_at current.
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- 10. Time functions (called by the backend with supabase.rpc; server clock only)
-- ---------------------------------------------------------------------------------------------
-- Opens a work session for the user. Fails if one is already open.
create or replace function public.clock_in(p_user bigint) returns public.work_sessions
language sql set search_path = public as $$
  insert into work_sessions (user_id) values (p_user) returning *;
$$;

-- Closes the user's open session and stops any running task timer.
create or replace function public.clock_out(p_user bigint) returns public.work_sessions
language plpgsql set search_path = public as $$
declare r work_sessions;
begin
  update task_time_logs set ended_at = now() where user_id = p_user and ended_at is null;
  update work_sessions set clock_out = now() where user_id = p_user and clock_out is null returning * into r;
  if r.id is null then
    raise exception 'You are not clocked in' using errcode = 'P0002';
  end if;
  return r;
end $$;

-- Starts a timer on a task, stopping any timer already running. Requires being clocked in.
create or replace function public.start_task_timer(p_user bigint, p_task bigint) returns public.task_time_logs
language plpgsql set search_path = public as $$
declare r task_time_logs;
begin
  if not exists (select 1 from work_sessions where user_id = p_user and clock_out is null) then
    raise exception 'Clock in before starting a task timer' using errcode = 'P0001';
  end if;
  update task_time_logs set ended_at = now() where user_id = p_user and ended_at is null;
  insert into task_time_logs (task_id, user_id) values (p_task, p_user) returning * into r;
  return r;
end $$;

-- Stops the user's running task timer, if any. Returns null when nothing was running.
create or replace function public.stop_task_timer(p_user bigint) returns public.task_time_logs
language sql set search_path = public as $$
  update task_time_logs set ended_at = now() where user_id = p_user and ended_at is null returning *;
$$;

-- Corrects a work session and records who changed it, from what, and why.
create or replace function public.correct_session(
  p_session bigint, p_editor bigint, p_clock_in timestamptz, p_clock_out timestamptz, p_reason text
) returns public.work_sessions
language plpgsql set search_path = public as $$
declare old_row work_sessions; r work_sessions;
begin
  select * into old_row from work_sessions where id = p_session for update;
  if old_row.id is null then
    raise exception 'Work session not found' using errcode = 'P0002';
  end if;
  insert into time_corrections (session_id, editor_id, old_clock_in, old_clock_out, new_clock_in, new_clock_out, reason)
  values (p_session, p_editor, old_row.clock_in, old_row.clock_out, p_clock_in, p_clock_out, p_reason);
  update work_sessions set clock_in = p_clock_in, clock_out = p_clock_out where id = p_session returning * into r;
  -- Timers from the old session must fit inside the corrected one: drop those now entirely
  -- outside it, and trim the rest to its new start and end.
  delete from task_time_logs
   where user_id = old_row.user_id
     and started_at >= old_row.clock_in and started_at < coalesce(old_row.clock_out, 'infinity')
     and (coalesce(ended_at, now()) <= p_clock_in or started_at >= coalesce(p_clock_out, 'infinity'));
  update task_time_logs
     set started_at = greatest(started_at, p_clock_in),
         ended_at = case when p_clock_out is null then ended_at else least(coalesce(ended_at, p_clock_out), p_clock_out) end
   where user_id = old_row.user_id
     and started_at < coalesce(old_row.clock_out, 'infinity')
     and coalesce(ended_at, 'infinity') > old_row.clock_in;
  return r;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 11. Reporting views (security_invoker so they never bypass row-level security)
-- ---------------------------------------------------------------------------------------------
-- Hours clocked per user per calendar day in India time (open sessions count up to now).
create view public.v_daily_hours with (security_invoker = true) as
select user_id,
       (clock_in at time zone 'Asia/Kolkata')::date as day,
       round(sum(extract(epoch from (coalesce(clock_out, now()) - clock_in))) / 3600, 2) as hours_clocked
from public.work_sessions
group by user_id, (clock_in at time zone 'Asia/Kolkata')::date;

-- Minutes logged on task timers per task (running timers count up to now).
create view public.v_task_time with (security_invoker = true) as
select task_id, round(sum(extract(epoch from (coalesce(ended_at, now()) - started_at))) / 60) as actual_minutes
from public.task_time_logs
group by task_id;

-- Per-user delivery stats: finished tasks and how many were on time.
create view public.v_user_task_stats with (security_invoker = true) as
select u.id as user_id,
       count(t.id) filter (where t.status = 'done') as tasks_done,
       round(100.0 * count(t.id) filter (where t.status = 'done' and t.deadline is not null and t.completed_at <= t.deadline)
             / nullif(count(t.id) filter (where t.status = 'done' and t.deadline is not null), 0), 1) as on_time_pct
from public.users u
left join public.tasks t on t.assignee_id = u.id
group by u.id;

-- Per-user quality: average approval rating and how often work was sent back.
create view public.v_user_quality with (security_invoker = true) as
select assignee_id as user_id,
       round(avg(rating) filter (where decision = 'approved'), 2) as avg_rating,
       count(*) filter (where decision = 'changes_requested') as changes_requested
from public.task_reviews
where assignee_id is not null
group by assignee_id;

-- ---------------------------------------------------------------------------------------------
-- 12. Permission catalogue and default roles
-- ---------------------------------------------------------------------------------------------
insert into public.permissions (key, label, grp, description, position) values
  ('dashboard.view',     'View dashboard',        'Workspace',         'See the team dashboard and department numbers.', 10),
  ('people.view',        'View people',           'People',            'See people, their work and their performance.', 20),
  ('people.manage',      'Manage people',         'People',            'Add, edit, deactivate and delete people.', 21),
  ('roles.manage',       'Manage roles',          'People',            'Create roles and choose what each one can do.', 22),
  ('departments.manage', 'Manage departments',    'People',            'Create, rename and delete departments.', 23),
  ('projects.manage',    'Manage projects',       'Projects and tasks','Create, edit and close projects and their custom fields.', 30),
  ('tasks.create',       'Create tasks',          'Projects and tasks','Create new tasks in projects they can see.', 31),
  ('tasks.assign',       'Assign tasks',          'Projects and tasks','Assign tasks to other people.', 32),
  ('tasks.edit_any',     'Edit any task',         'Projects and tasks','Edit tasks assigned to someone else.', 33),
  ('tasks.delete',       'Delete tasks',          'Projects and tasks','Delete tasks permanently.', 34),
  ('reviews.perform',    'Review work',           'Projects and tasks','Approve submitted work with a rating, or send it back for rework.', 35),
  ('time.track',         'Track time',            'Time',              'Clock in and out and run task timers.', 40),
  ('time.manage',        'Correct time',          'Time',              'Correct other people''s clock-ins, with a reason.', 41),
  ('reports.export',     'Export reports',        'Reports',           'Download CSV reports.', 50);

insert into public.roles (name, description, scope, is_system) values
  ('Admin',     'Full access to everything.', 'all', true),
  ('Manager',   'Runs a department: its projects, tasks, reviews and time.', 'department', false),
  ('Team lead', 'Leads work in a department: assigns and reviews tasks.', 'department', false),
  ('HR',        'Manages people and time across the company.', 'all', false),
  ('Employee',  'Works on their own tasks and tracks their time.', 'own', false);

insert into public.role_permissions (role_id, permission)
select r.id, p.key from public.roles r cross join public.permissions p where r.name = 'Admin';

insert into public.role_permissions (role_id, permission)
select r.id, x.p from public.roles r
join (values
  ('Manager', 'dashboard.view'), ('Manager', 'people.view'), ('Manager', 'projects.manage'), ('Manager', 'tasks.create'),
  ('Manager', 'tasks.assign'), ('Manager', 'tasks.edit_any'), ('Manager', 'tasks.delete'), ('Manager', 'reviews.perform'),
  ('Manager', 'time.track'), ('Manager', 'time.manage'), ('Manager', 'reports.export'),
  ('Team lead', 'dashboard.view'), ('Team lead', 'people.view'), ('Team lead', 'tasks.create'), ('Team lead', 'tasks.assign'),
  ('Team lead', 'tasks.edit_any'), ('Team lead', 'reviews.perform'), ('Team lead', 'time.track'),
  ('HR', 'dashboard.view'), ('HR', 'people.view'), ('HR', 'people.manage'), ('HR', 'departments.manage'),
  ('HR', 'time.manage'), ('HR', 'reports.export'), ('HR', 'time.track'),
  ('Employee', 'tasks.create'), ('Employee', 'time.track')
) as x(role, p) on x.role = r.name;

-- ---------------------------------------------------------------------------------------------
-- 13. Restore the real accounts (admins stay Admin, everyone else becomes Employee)
-- ---------------------------------------------------------------------------------------------
insert into public.departments (name)
select distinct initcap(department) from migration_tmp.keep_users where department is not null;

-- Usernames are now unique ignoring case. If two kept accounts differ only by case ("Aathi" and
-- "aathi"), the later one is renamed to its email's local part ("aathi2006").
insert into public.users (name, email, password_hash, role_id, department_id, is_active, created_at)
select case when row_number() over (partition by lower(k.name) order by k.created_at) > 1
            then split_part(k.email, '@', 1) else k.name end,
       lower(k.email), k.password_hash,
       (select id from public.roles where name = case when k.old_role = 'admin' then 'Admin' else 'Employee' end),
       (select id from public.departments d where lower(d.name) = lower(k.department)),
       k.is_active, k.created_at
from migration_tmp.keep_users k;

drop schema migration_tmp cascade;

-- ---------------------------------------------------------------------------------------------
-- 14. Lock everything to the backend
-- ---------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on function public.clock_in(bigint), public.clock_out(bigint), public.start_task_timer(bigint, bigint),
  public.stop_task_timer(bigint), public.correct_session(bigint, bigint, timestamptz, timestamptz, text)
  from public, anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on function public.clock_in(bigint), public.clock_out(bigint), public.start_task_timer(bigint, bigint),
  public.stop_task_timer(bigint), public.correct_session(bigint, bigint, timestamptz, timestamptz, text) to service_role;
