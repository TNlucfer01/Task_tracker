-- demo.sql
-- Realistic demo data for the rebuilt schema. Run after 001_rebuild.sql.
-- Every demo person has an @example.com email and the password TaskTracker@123.
-- Real accounts (anything not @example.com) get no fake activity.
-- Re-running is refused; remove the demo first with db/seed/remove-demo.sql.

do $$
declare
  v_hash constant text := '$2b$10$nYGhwyQz/U389zaCNLf/uOx1q75ahfs.vrSjr4PwvmJCndZQu6BS6';
  v_admin bigint;
  today date := (now() at time zone 'Asia/Kolkata')::date;
  r record; s record; t record;
  pid bigint; tid bigint; uid bigint; lead_id bigint;
  steps text[]; step text; i int; n int;
  created timestamptz; finished timestamptz; endt timestamptz;
  d date; cin timestamptz; cur timestamptz; seg int; hrs numeric;
begin
  if exists (select 1 from users where email like '%@example.com') then
    raise exception 'Demo data is already loaded. Run db/seed/remove-demo.sql first.';
  end if;
  perform setseed(0.42);
  select u.id into v_admin from users u join roles ro on ro.id = u.role_id where ro.name = 'Admin' order by u.id limit 1;

  -- Departments ----------------------------------------------------------------------------
  insert into departments (name, description) values
    ('Development', 'Builds and runs the product.'),
    ('Design', 'Product, interface and brand design.'),
    ('QA', 'Testing and release quality.'),
    ('Marketing', 'Campaigns, content and the website.'),
    ('Human Resources', 'Hiring, people operations and policies.')
  on conflict ((lower(name))) do update set description = excluded.description;

  -- People ---------------------------------------------------------------------------------
  insert into users (name, email, password_hash, role_id, department_id, title, is_active)
  select v.name, v.email, v_hash, (select id from roles where name = v.role),
         (select id from departments where name = v.dept), v.title, v.active
  from (values
    ('ravi',    'ravi@example.com',    'Manager',   'Development',     'Engineering manager',  true),
    ('arjun',   'arjun@example.com',   'Team lead', 'Development',     'Backend lead',         true),
    ('priya',   'priya@example.com',   'Employee',  'Development',     'Frontend developer',   true),
    ('sanjay',  'sanjay@example.com',  'Employee',  'Development',     'Mobile developer',     true),
    ('suresh',  'suresh@example.com',  'Employee',  'Development',     'Backend developer',    false),
    ('meena',   'meena@example.com',   'Manager',   'Design',          'Design lead',          true),
    ('divya',   'divya@example.com',   'Manager',   'QA',              'QA lead',              true),
    ('karthik', 'karthik@example.com', 'Employee',  'QA',              'QA engineer',          true),
    ('kavya',   'kavya@example.com',   'Manager',   'Marketing',       'Marketing manager',    true),
    ('nisha',   'nisha@example.com',   'Employee',  'Marketing',       'Content writer',       true),
    ('lakshmi', 'lakshmi@example.com', 'HR',        'Human Resources', 'HR manager',           true)
  ) v(name, email, role, dept, title, active);

  update departments d set head_id = u.id from users u
   where (d.name, u.name) in (('Development','ravi'), ('Design','meena'), ('QA','divya'), ('Marketing','kavya'), ('Human Resources','lakshmi'))
     and d.name = d.name;

  -- Projects and custom fields ---------------------------------------------------------------
  create temp table demo_projects (key text primary key, id bigint) on commit drop;
  for r in select * from (values
    ('CPR', 'Client portal redesign', 'Rebuild the customer portal on the new design system.' || chr(10) || chr(10) || '## Goals' || chr(10) || '- Faster sign-in' || chr(10) || '- Self-serve billing' || chr(10) || '- WCAG AA throughout', 'active', 'Development', 'ravi', 30, 18, null::int),
    ('MOB', 'Mobile app v2', 'Offline mode, push notifications and a faster checkout.', 'active', 'Development', 'arjun', 25, 40, null),
    ('DIW', 'Diwali campaign site', 'Landing pages, offers and newsletters for the Diwali sale.', 'active', 'Marketing', 'kavya', 20, 2, null),
    ('HRL', 'HR leave tracker', 'Internal tool for applying for and approving leave.', 'completed', 'Development', 'ravi', 40, -2, 4),
    ('DWH', 'Data warehouse migration', 'Move reporting from the old MySQL server to the warehouse.', 'planned', 'Development', 'arjun', 3, 60, null),
    ('PAY', 'Payment gateway upgrade', 'Switch to the new payment provider API. On hold until the contract is signed.', 'on_hold', 'Development', 'ravi', 15, 30, null)
  ) v(key, name, descr, status, dept, owner, created_days_ago, deadline_days, completed_days_ago) loop
    insert into projects (key, name, description_md, status, department_id, owner_id, start_date, deadline, completed_at, created_by, created_at)
    values (r.key, r.name, r.descr, r.status::project_status, (select id from departments where name = r.dept),
            (select id from users where name = r.owner), today - r.created_days_ago,
            date_trunc('day', now() + make_interval(days => r.deadline_days)) + interval '12 hours 30 minutes',
            case when r.completed_days_ago is null then null else now() - make_interval(days => r.completed_days_ago) end,
            v_admin, now() - make_interval(days => r.created_days_ago))
    returning id into pid;
    insert into demo_projects values (r.key, pid);
  end loop;

  insert into project_fields (project_id, key, label, type, options, required, position)
  select (select id from demo_projects where key = v.p), v.key, v.label, v.type::field_type, v.opts, v.req, v.pos
  from (values
    ('CPR', 'component', 'Component', 'select', array['Frontend','Backend','Infrastructure'], true, 1),
    ('CPR', 'client', 'Client', 'text', array[]::text[], false, 2),
    ('MOB', 'platform', 'Platform', 'multi_select', array['Android','iOS'], true, 1),
    ('MOB', 'sprint', 'Sprint', 'number', array[]::text[], false, 2),
    ('DIW', 'channel', 'Channel', 'select', array['Web','Email','Social'], false, 1),
    ('PAY', 'compliance', 'Needs compliance sign-off', 'checkbox', array[]::text[], false, 1)
  ) v(p, key, label, type, opts, req, pos);

  -- Tasks: project, title, assignee, final status, priority, deadline (days from now), estimate,
  --        went through rework, finished late, created (days ago), labels, properties, body
  create temp table demo_tasks (id bigint, assignee bigint, status text, rework bool, late bool,
                                deadline timestamptz, created timestamptz) on commit drop;
  for r in select * from (values
    ('CPR','Audit current portal pages','meena','done','medium',-22,240,false,false,29,'{research}','{"component":"Frontend","client":"All"}'),
    ('CPR','Design system components','meena','done','high',-12,960,true,false,27,'{design-system}','{"component":"Frontend"}'),
    ('CPR','Login and signup screens','priya','done','high',-8,480,false,true,24,'{auth}','{"component":"Frontend","client":"All"}'),
    ('CPR','Account dashboard page','priya','in_review','high',3,600,false,false,15,'{}','{"component":"Frontend"}'),
    ('CPR','Invoices and billing API','arjun','in_progress','urgent',6,720,false,false,12,'{billing}','{"component":"Backend","client":"Acme Retail"}'),
    ('CPR','Accessibility pass','karthik','todo','medium',14,300,false,false,5,'{a11y}','{"component":"Frontend"}'),
    ('CPR','Regression test plan','divya','in_progress','high',-1,240,false,false,9,'{testing}','{"component":"Infrastructure"}'),
    ('CPR','Notification settings','arjun','rework','medium',2,360,false,false,10,'{}','{"component":"Backend"}'),
    ('CPR','Help centre copy','nisha','done','low',-9,240,false,false,16,'{content}','{"component":"Frontend"}'),
    ('MOB','Offline sync for orders','sanjay','in_progress','urgent',12,1200,false,false,20,'{offline}','{"platform":["Android","iOS"],"sprint":14}'),
    ('MOB','Push notifications','sanjay','done','high',-5,480,true,false,22,'{}','{"platform":["Android","iOS"],"sprint":13}'),
    ('MOB','Checkout redesign','meena','in_review','high',4,540,false,false,14,'{checkout}','{"platform":["iOS"],"sprint":14}'),
    ('MOB','Crash fixes from 1.9','priya','done','urgent',-15,300,false,false,24,'{bug}','{"platform":["Android"],"sprint":12}'),
    ('MOB','App store screenshots','nisha','todo','low',20,180,false,false,4,'{}','{"platform":["Android","iOS"]}'),
    ('MOB','Automated UI tests','karthik','in_progress','medium',9,900,false,false,13,'{testing}','{"platform":["Android"],"sprint":14}'),
    ('MOB','Performance profiling','sanjay','todo','medium',15,240,false,false,6,'{}','{"platform":["Android","iOS"]}'),
    ('MOB','Dark mode','meena','todo','low',null,420,false,false,3,'{design-system}','{"platform":["iOS"]}'),
    ('DIW','Campaign landing page','priya','done','high',-3,480,false,true,18,'{}','{"channel":"Web"}'),
    ('DIW','Offer banner designs','meena','done','medium',-6,360,false,false,18,'{}','{"channel":"Social"}'),
    ('DIW','Countdown timer and offer codes','priya','in_progress','urgent',-2,300,false,false,12,'{}','{"channel":"Web"}'),
    ('DIW','SEO and meta tags','nisha','in_review','medium',-1,120,false,false,8,'{seo}','{"channel":"Web"}'),
    ('DIW','Load testing','karthik','todo','high',1,240,false,false,5,'{testing}','{"channel":"Web"}'),
    ('DIW','Email newsletter','kavya','rework','medium',1,180,false,false,7,'{}','{"channel":"Email"}'),
    ('HRL','Leave request form','priya','done','medium',-20,420,false,false,38,'{}','{}'),
    ('HRL','Manager approval flow','arjun','done','high',-12,600,true,false,34,'{}','{}'),
    ('HRL','Leave balance report','karthik','done','medium',-6,360,false,true,30,'{}','{}'),
    ('HRL','UAT with HR team','lakshmi','done','medium',-4,240,false,false,20,'{}','{}'),
    ('HRL','Holiday calendar import','suresh','done','low',-14,180,false,false,36,'{}','{}'),
    ('DWH','Inventory existing reports','arjun','todo','medium',10,240,false,false,3,'{}','{}'),
    ('DWH','Schema design','arjun','todo','high',20,600,false,false,2,'{}','{}'),
    ('PAY','Sandbox integration','sanjay','in_progress','high',25,720,false,false,14,'{}','{"compliance":true}'),
    ('PAY','Refund API mapping','suresh','done','medium',-12,300,false,false,15,'{}','{"compliance":false}'),
    ('PAY','Webhook security review','divya','in_review','urgent',8,180,false,false,9,'{security}','{"compliance":true}')
  ) v(p, title, who, status, priority, deadline_days, est, rework, late, created_days_ago, labels, props) loop
    select id into uid from users where name = r.who;
    created := now() - make_interval(days => r.created_days_ago) + make_interval(mins => (random() * 300)::int);
    insert into tasks (project_id, title, body_md, priority, assignee_id, reporter_id, updated_by, deadline, estimate_minutes, labels, properties, position)
    values ((select id from demo_projects where key = r.p), r.title,
            '## What' || chr(10) || r.title || ' for ' || (select name from projects where id = (select id from demo_projects where key = r.p)) || '.' || chr(10) || chr(10) ||
            '## Acceptance criteria' || chr(10) ||
            '- [' || case when r.status = 'done' then 'x' else ' ' end || '] Meets the design and the spec' || chr(10) ||
            '- [' || case when r.status in ('done','in_review') then 'x' else ' ' end || '] Tested on staging' || chr(10) ||
            '- [ ] Documented in the changelog' || chr(10) || chr(10) ||
            '## Notes' || chr(10) || 'Ask in the project channel if anything is unclear.',
            r.priority::task_priority, uid, v_admin, v_admin,
            case when r.deadline_days is null then null
                 else date_trunc('day', now() + make_interval(days => r.deadline_days)) + interval '12 hours 30 minutes' end,
            r.est, r.labels::text[], r.props::jsonb, random() * 1000)
    returning id into tid;
    insert into demo_tasks select tid, uid, r.status, r.rework, r.late, tk.deadline, created from tasks tk where tk.id = tid;

    lead_id := coalesce((select head_id from departments where id = (select department_id from users where id = uid)), v_admin);
    steps := case r.status
      when 'todo' then array[]::text[]
      when 'in_progress' then array['in_progress']
      when 'in_review' then array['in_progress','in_review']
      when 'rework' then array['in_progress','in_review','rework']
      else case when r.rework then array['in_progress','in_review','rework','in_progress','in_review','done']
                else array['in_progress','in_review','done'] end
    end;
    foreach step in array steps loop
      update tasks set status = step::task_status,
                       updated_by = case when step in ('rework','done') then lead_id else uid end
       where id = tid;
      if step = 'rework' then
        insert into task_reviews (task_id, reviewer_id, assignee_id, decision, comment)
        values (tid, lead_id, uid, 'changes_requested', 'A few things to fix before this can go out: see the comments.');
      elsif step = 'done' then
        insert into task_reviews (task_id, reviewer_id, assignee_id, decision, rating, comment)
        values (tid, lead_id, uid, 'approved',
                greatest(1, least(5, round(
                  case r.who when 'meena' then 4.6 when 'divya' then 4.4 when 'priya' then 4.2 when 'nisha' then 4.1
                             when 'sanjay' then 3.9 when 'arjun' then 3.6 when 'karthik' then 3.4 else 4.0 end
                  + random() * 1.2 - 0.6 - case when r.rework then 0.7 else 0 end)))::smallint,
                (array['Clean work, nicely tested.', 'Good. Small follow-ups noted in the comments.', 'Solid and well documented.',
                       'Works well. Watch the edge cases next time.', 'Great attention to detail.'])[1 + floor(random() * 5)::int]);
      end if;
    end loop;
  end loop;

  -- Put everything in the past: creation, completion, events and reviews -------------------
  for r in select * from demo_tasks loop
    finished := null;
    if r.status = 'done' then
      finished := case when r.late then r.deadline + make_interval(hours => 20 + (random() * 40)::int)
                       else r.deadline - make_interval(hours => 4 + (random() * 60)::int) end;
      finished := least(greatest(finished, r.created + interval '1 day'), now() - interval '3 hours');
    end if;
    update tasks set created_at = r.created, completed_at = coalesce(finished, completed_at) where id = r.id;
    endt := coalesce(finished, now() - make_interval(hours => 2 + (random() * 30)::int));
    select count(*) into n from task_events where task_id = r.id;
    i := 0;
    for s in select id from task_events where task_id = r.id order by id loop
      update task_events set created_at = case when i = 0 then r.created
                                               else r.created + (endt - r.created) * (i::numeric / greatest(n - 1, 1)) end
       where id = s.id;
      i := i + 1;
    end loop;
    -- Each review happens when the task left review.
    update task_reviews rv set created_at = e.created_at
      from (select created_at, row_number() over (order by id) rn from task_events
             where task_id = r.id and type = 'status' and data->>'to' in ('rework','done')) e,
           (select id, row_number() over (order by id) rn from task_reviews where task_id = r.id) x
     where rv.id = x.id and x.rn = e.rn;
  end loop;
  update tasks set updated_at = greatest(created_at, coalesce(completed_at, created_at)) where id in (select id from demo_tasks);

  -- Comments ---------------------------------------------------------------------------------
  insert into task_comments (task_id, author_id, body_md, created_at)
  select tc.id, a.author, x.body, greatest(tc.created_at + interval '2 hours', now() - make_interval(hours => x.hours_ago))
  from tasks tc
  join (values
    ('Account dashboard page', 'priya', 'Ready for review. The usage chart loads lazily so the page stays fast.', 20),
    ('Account dashboard page', 'ravi', 'Thanks. I''ll look at it this afternoon.', 18),
    ('Notification settings', 'ravi', 'The digest toggle doesn''t save on Safari. Can you check `localStorage` handling?', 26),
    ('Notification settings', 'arjun', 'Reproduced. Fix is in progress.', 24),
    ('Email newsletter', 'kavya', 'Moving back to rework: the offer code in the footer is last year''s.', 22),
    ('Offline sync for orders', 'arjun', 'Let''s cap the queue at **500 orders** and show a warning above that.', 30),
    ('Offline sync for orders', 'sanjay', 'Agreed. Adding a banner when the queue is above 80%.', 28),
    ('Countdown timer and offer codes', 'kavya', 'This is past its deadline. What''s blocking it?', 6),
    ('Countdown timer and offer codes', 'priya', 'Waiting on final codes from the partner team. Should be done today.', 4),
    ('Webhook security review', 'divya', 'Signature check and replay window both verified. Ready for sign-off.', 12),
    ('Design system components', 'meena', 'Second round addresses all the spacing feedback.', 200)
  ) x(task, author_name, body, hours_ago) on x.task = tc.title
  cross join lateral (select id as author from users where name = x.author_name) a;

  insert into task_events (task_id, actor_id, type, data, created_at)
  select c.task_id, c.author_id, 'comment', jsonb_build_object('comment_id', c.id), c.created_at from task_comments c;

  -- Work sessions: weekdays and some Saturdays over three weeks, in India time ---------------
  for r in select u.id, u.name from users u where u.email like '%@example.com' and u.name <> 'lakshmi' loop
    for d in select g::date from generate_series(today - 21, today - 1, interval '1 day') g loop
      continue when extract(isodow from d) = 7;
      continue when extract(isodow from d) = 6 and random() < 0.75;
      continue when random() < 0.07;
      continue when r.name = 'suresh' and d > today - 13;
      cin := (d + time '09:00' + make_interval(mins => (random() * 75)::int))::timestamp at time zone 'Asia/Kolkata';
      hrs := case r.name when 'arjun' then 7.5 + random() * 3 when 'nisha' then 5.5 + random() * 2.5
                         when 'sanjay' then 7 + random() * 2.5 else 6.5 + random() * 2.5 end;
      insert into work_sessions (user_id, clock_in, clock_out) values (r.id, cin, cin + make_interval(mins => (hrs * 60)::int));
    end loop;
  end loop;
  for r in select id from users where name in ('priya', 'sanjay', 'meena', 'arjun', 'divya', 'karthik') loop
    cin := least((today + time '09:10' + make_interval(mins => (random() * 70)::int))::timestamp at time zone 'Asia/Kolkata',
                 now() - interval '25 minutes');
    insert into work_sessions (user_id, clock_in) values (r.id, cin);
  end loop;

  -- Task timers filling most of each session, on whatever the person was working on then --------
  for s in select ws.* from work_sessions ws join users u on u.id = ws.user_id
            where u.email like '%@example.com' order by ws.clock_in loop
    cur := s.clock_in + make_interval(mins => 10 + (random() * 15)::int);
    loop
      exit when cur + interval '40 minutes' > coalesce(s.clock_out, now()) - interval '10 minutes';
      select tk.id into t from tasks tk
       where tk.assignee_id = s.user_id and tk.created_at < cur
         and (tk.status <> 'todo')
         and (tk.completed_at is null or tk.completed_at > cur)
       order by random() limit 1;
      exit when not found;
      seg := least(50 + (random() * 100)::int,
                   (extract(epoch from (coalesce(s.clock_out, now()) - interval '10 minutes') - cur) / 60)::int);
      exit when seg < 20;
      insert into task_time_logs (task_id, user_id, started_at, ended_at) values (t.id, s.user_id, cur, cur + make_interval(mins => seg));
      cur := cur + make_interval(mins => seg + 8 + (random() * 25)::int);
    end loop;
  end loop;
  -- A running timer for most of the people on the clock now.
  for s in select ws.* from work_sessions ws join users u on u.id = ws.user_id
            where ws.clock_out is null and u.name in ('priya', 'sanjay', 'arjun', 'karthik') loop
    delete from task_time_logs where user_id = s.user_id and started_at >= s.clock_in;
    select tk.id into t from tasks tk where tk.assignee_id = s.user_id and tk.status in ('in_progress', 'rework') order by random() limit 1;
    continue when not found;
    insert into task_time_logs (task_id, user_id, started_at) values (t.id, s.user_id, s.clock_in + interval '15 minutes');
  end loop;

  -- Notifications ----------------------------------------------------------------------------
  insert into notifications (user_id, type, title, body, task_id, actor_id, read_at, created_at)
  select tk.assignee_id, 'assigned', 'You were assigned ' || p.key || '-' || tk.number, tk.title, tk.id, v_admin,
         case when tk.created_at < now() - interval '3 days' then tk.created_at + interval '1 hour' end, tk.created_at
  from tasks tk join projects p on p.id = tk.project_id
  where tk.id in (select id from demo_tasks);

  insert into notifications (user_id, type, title, body, task_id, actor_id, read_at, created_at)
  select rv.assignee_id,
         case rv.decision when 'approved' then 'approved' else 'changes_requested' end,
         case rv.decision when 'approved' then p.key || '-' || tk.number || ' was approved'
                          else p.key || '-' || tk.number || ' needs changes' end,
         rv.comment, tk.id, rv.reviewer_id,
         case when rv.created_at < now() - interval '2 days' then rv.created_at + interval '2 hours' end, rv.created_at
  from task_reviews rv join tasks tk on tk.id = rv.task_id join projects p on p.id = tk.project_id;

  insert into notifications (user_id, type, title, body, task_id, actor_id, created_at)
  select coalesce(dh.head_id, v_admin), 'review_requested', p.key || '-' || tk.number || ' is ready for review', tk.title, tk.id, tk.assignee_id,
         now() - make_interval(hours => 3 + (random() * 20)::int)
  from tasks tk join projects p on p.id = tk.project_id
  left join users a on a.id = tk.assignee_id left join departments dh on dh.id = a.department_id
  where tk.status = 'in_review' and tk.id in (select id from demo_tasks);
end $$;
