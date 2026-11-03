// Who can see what. A role's scope decides the reach of everything a person can see:
//   all        the whole company
//   department their own department's people, its projects, and work assigned to its people
//   own        only their own tasks (assigned or reported) and the projects those belong to
// Each helper returns a SQL condition to drop into a WHERE clause.
const sql = require("./db");

/** Condition on users table alias `u` for people `me` can see. */
function peopleFilter(me) {
  if (me.role.scope === "all") return sql`true`;
  if (me.role.scope === "department" && me.department_id) {
    return sql`(u.department_id = ${me.department_id} or u.id = ${me.id})`;
  }
  return sql`u.id = ${me.id}`;
}

/** Condition on tasks table alias `t` for tasks `me` can see. */
function taskFilter(me) {
  if (me.role.scope === "all") return sql`true`;
  if (me.role.scope === "department" && me.department_id) {
    return sql`(t.assignee_id in (select id from users where department_id = ${me.department_id})
             or t.project_id in (select id from projects where department_id = ${me.department_id})
             or t.reporter_id = ${me.id} or t.assignee_id = ${me.id})`;
  }
  return sql`(t.assignee_id = ${me.id} or t.reporter_id = ${me.id})`;
}

/** Condition on projects table alias `p` for projects `me` can see. */
function projectFilter(me) {
  if (me.role.scope === "all") return sql`true`;
  if (me.role.scope === "department" && me.department_id) {
    return sql`(p.department_id = ${me.department_id} or p.owner_id = ${me.id}
             or exists (select 1 from tasks t where t.project_id = p.id and
                        (t.assignee_id in (select id from users where department_id = ${me.department_id}) or t.reporter_id = ${me.id})))`;
  }
  return sql`(p.owner_id = ${me.id} or exists (select 1 from tasks t where t.project_id = p.id and (t.assignee_id = ${me.id} or t.reporter_id = ${me.id})))`;
}

/** Condition on departments alias `d` for departments `me` can see numbers for. */
function departmentFilter(me) {
  if (me.role.scope === "all") return sql`true`;
  if (me.department_id) return sql`d.id = ${me.department_id}`;
  return sql`false`;
}

/** True when `me` can see the given user. */
async function canSeeUser(me, userId) {
  const [row] = await sql`select 1 from users u where u.id = ${userId} and ${peopleFilter(me)}`;
  return Boolean(row);
}

/** True when `me` can manage (create work in, or administer) the project. */
function canManageProject(me, project) {
  if (!me.permissions.has("projects.manage")) return false;
  if (me.role.scope === "all") return true;
  if (me.role.scope === "department") return project.department_id === me.department_id || project.owner_id === me.id;
  return project.owner_id === me.id;
}

module.exports = { peopleFilter, taskFilter, projectFilter, departmentFilter, canSeeUser, canManageProject };
