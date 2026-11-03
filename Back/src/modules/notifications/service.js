// Creating notifications. Other modules call these; nobody is ever notified about their own action.
const sql = require("../../db");
const { todayInIndia } = require("../../lib/dates");

/** Sends one notification to each listed user (except the actor), inside the caller's transaction. */
async function notify(tx, { userIds, type, title, body = "", taskId = null, actorId = null }) {
  const targets = [...new Set(userIds.filter((id) => id && id !== actorId))];
  if (!targets.length) return;
  await tx`insert into notifications ${tx(targets.map((user_id) => ({ user_id, type, title, body, task_id: taskId, actor_id: actorId })))}`;
}

/** People who should review a task: the project owner and the assignee's department head, else admins. */
async function reviewersFor(tx, task) {
  const rows = await tx`
    select p.owner_id as id from projects p where p.id = ${task.project_id}
    union select d.head_id from users u join departments d on d.id = u.department_id where u.id = ${task.assignee_id}`;
  const ids = rows.map((r) => r.id).filter((id) => id && id !== task.assignee_id);
  if (ids.length) return ids;
  const admins = await tx`select u.id from users u join roles r on r.id = u.role_id where r.is_system and u.is_active`;
  return admins.map((a) => a.id);
}

/** Adds overdue and due-within-a-day reminders for a user's tasks; each appears once (per day for overdue). */
async function addDueReminders(userId) {
  const today = todayInIndia();
  await sql`
    insert into notifications (user_id, type, title, body, task_id, dedupe_key)
    select t.assignee_id, 'overdue', p.key || '-' || t.number || ' is overdue', t.title, t.id,
           'overdue:' || t.id || ':' || ${today}
    from tasks t join projects p on p.id = t.project_id
    where t.assignee_id = ${userId} and t.status <> 'done' and t.deadline < now()
    on conflict (dedupe_key) do nothing`;
  await sql`
    insert into notifications (user_id, type, title, body, task_id, dedupe_key)
    select t.assignee_id, 'due_soon', p.key || '-' || t.number || ' is due within a day', t.title, t.id,
           'due:' || t.id || ':' || to_char(t.deadline, 'YYYYMMDDHH24MI')
    from tasks t join projects p on p.id = t.project_id
    where t.assignee_id = ${userId} and t.status <> 'done' and t.deadline between now() and now() + interval '24 hours'
    on conflict (dedupe_key) do nothing`;
}

module.exports = { notify, reviewersFor, addDueReminders };
