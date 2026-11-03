-- remove-demo.sql
-- Removes everything demo.sql created: projects with the demo keys (and their tasks, comments,
-- reviews, events and timers) and every @example.com person (and their sessions and notifications).
-- Real accounts and anything you created yourself are kept.

begin;
delete from projects where key in ('CPR', 'MOB', 'DIW', 'HRL', 'DWH', 'PAY');
update departments set head_id = null where head_id in (select id from users where email like '%@example.com');
delete from users where email like '%@example.com';
delete from departments d
 where name in ('Design', 'QA', 'Marketing', 'Human Resources')
   and not exists (select 1 from users u where u.department_id = d.id)
   and not exists (select 1 from projects p where p.department_id = d.id);
commit;
