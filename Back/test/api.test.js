// End-to-end API checks against an in-memory Postgres loaded with the demo data.
const test = require("node:test");
const assert = require("node:assert/strict");
const { start, client } = require("./db");

let env;
test.before(async () => { env = await start(); });
test.after(async () => { await env.stop(); });

/** Signs in as a demo person and returns their client. */
async function as(name) {
  const c = client(env.base);
  const r = await c.login(name);
  assert.equal(r.status, 200, `login ${name}: ${JSON.stringify(r.body)}`);
  return c;
}

test("auth: wrong password, me, logout", async () => {
  const c = client(env.base);
  assert.equal((await c.login("ravi", "nope")).status, 401);
  assert.equal((await c.get("/tasks")).status, 401);
  await c.login("RAVI");
  const me = await c.get("/auth/me");
  assert.equal(me.body.user.role.name, "Manager");
  assert.ok(me.body.user.permissions.includes("projects.manage"));
  await c.post("/auth/logout");
  assert.equal((await c.get("/auth/me")).status, 401);
  assert.equal((await client(env.base).login("suresh")).status, 403, "inactive user is refused");
});

test("scope: employee sees own tasks, manager their department, admin everything", async () => {
  const [priya, ravi, admin] = await Promise.all([as("priya"), as("ravi"), as("aathi2006")]);
  const own = (await priya.get("/tasks")).body.tasks;
  const meId = (await priya.get("/auth/me")).body.user.id;
  assert.ok(own.length > 0 && own.every((t) => t.assignee?.id === meId || t.reporter?.id === meId));
  const all = (await admin.get("/tasks")).body.tasks;
  const dept = (await ravi.get("/tasks")).body.tasks;
  assert.ok(all.length >= dept.length && dept.length > own.length);
  assert.equal((await priya.get("/people")).status, 403);
  assert.equal((await priya.get("/dashboard/summary")).status, 403);
  const summary = await ravi.get("/dashboard/summary");
  assert.equal(summary.status, 200);
  assert.equal(summary.body.scope, "department");
  assert.ok(summary.body.departments.every((d) => d.name === "Development"));
  const full = await admin.get("/dashboard/summary");
  assert.equal(full.body.departments.length, 5);
});

test("task lifecycle: create, edit, timer, submit, request changes, approve", async () => {
  const [ravi, priya] = await Promise.all([as("ravi"), as("priya")]);
  const projects = (await ravi.get("/projects")).body.projects;
  const project = projects.find((p) => p.key === "CPR");
  const detail = (await ravi.get(`/projects/${project.id}`)).body.project;
  const props = Object.fromEntries(detail.fields.filter((f) => f.required).map((f) => [f.key, f.type === "select" ? f.options[0] : "x"]));
  const priyaId = (await priya.get("/auth/me")).body.user.id;
  const created = await ravi.post("/tasks", {
    project_id: project.id, title: "Write the test plan", body_md: "# Plan\n\n- [ ] cases", priority: "high",
    assignee_id: priyaId, deadline: new Date(Date.now() + 864e5).toISOString(), properties: props,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.task.id;
  assert.match(created.body.task.key, /^CPR-\d+$/);
  assert.ok((await priya.get("/notifications")).body.notifications.some((n) => n.type === "assigned" && n.task_id === id));

  assert.equal((await priya.patch(`/tasks/${id}`, { status: "done" })).status, 400, "done only via review");
  assert.equal((await priya.patch(`/tasks/${id}`, { body_md: "# Plan\n\nUpdated" })).status, 200);

  await priya.post("/time/clock-out");
  assert.equal((await priya.post("/time/timer/start", { task_id: id })).status, 400, "need to clock in first");
  assert.equal((await priya.post("/time/clock-in")).status, 200);
  assert.equal((await priya.post("/time/timer/start", { task_id: id })).status, 200);
  assert.equal((await priya.get(`/tasks/${id}`)).body.task.status, "in_progress");

  const submit = await priya.post(`/tasks/${id}/submit`);
  assert.equal(submit.status, 200, JSON.stringify(submit.body));
  assert.equal(submit.body.task.status, "in_review");
  assert.equal((await priya.post(`/tasks/${id}/reviews`, { decision: "approved", rating: 5 })).status, 403, "no self review");
  assert.equal((await ravi.post(`/tasks/${id}/reviews`, { decision: "changes_requested" })).status, 400, "comment required");
  assert.equal((await ravi.post(`/tasks/${id}/reviews`, { decision: "changes_requested", comment: "Add edge cases" })).status, 201);
  assert.equal((await priya.get(`/tasks/${id}`)).body.task.status, "rework");
  await priya.post(`/tasks/${id}/submit`);
  const approve = await ravi.post(`/tasks/${id}/reviews`, { decision: "approved", rating: 4, comment: "Good" });
  assert.equal(approve.status, 201);
  const final = (await ravi.get(`/tasks/${id}`)).body.task;
  assert.equal(final.status, "done");
  assert.ok(final.events.length >= 4);
  assert.equal((await priya.post("/time/clock-out")).status, 200);
});

test("comments, markdown export and import", async () => {
  const ravi = await as("ravi");
  const [task] = (await ravi.get("/tasks?limit=1")).body.tasks;
  const c = await ravi.post(`/tasks/${task.id}/comments`, { body_md: "Looks good @arjun" });
  assert.equal(c.status, 201);
  assert.equal((await ravi.patch(`/comments/${c.body.comment.id}`, { body_md: "Edited" })).status, 200);
  const md = await ravi.get(`/tasks/${task.id}/markdown`);
  assert.equal(md.status, 200);
  assert.match(md.body, /^---\n[\s\S]*title:/);
  const imported = await ravi.post("/tasks/import", { project_id: task.project.id, markdown: "---\npriority: urgent\nlabels: [import]\n---\n# Imported task\n\nBody text" });
  assert.equal(imported.status, 201, JSON.stringify(imported.body));
  assert.equal(imported.body.task.title, "Imported task");
  assert.equal(imported.body.task.priority, "urgent");
});

test("admin: custom role, user, project field, department", async () => {
  const admin = await as("aathi2006");
  const role = await admin.post("/roles", { name: "Auditor", scope: "all", permissions: ["dashboard.view", "people.view", "reports.export"] });
  assert.equal(role.status, 201, JSON.stringify(role.body));
  const user = await admin.post("/users", { name: "audrey", email: "audrey@example.com", password: "Audit@12345", role_id: role.body.role.id });
  assert.equal(user.status, 201, JSON.stringify(user.body));
  const a = client(env.base); await a.login("audrey", "Audit@12345");
  assert.equal((await a.get("/dashboard/summary")).status, 200);
  assert.equal((await a.post("/projects", { key: "AUD", name: "Nope" })).status, 403);
  const csv = await a.get("/reports/people.csv");
  assert.equal(csv.status, 200);
  assert.match(csv.body, /Name,Email/);
  assert.equal((await admin.post("/roles", { name: "auditor", scope: "own", permissions: [] })).status, 409);
  assert.equal((await admin.del(`/roles/${role.body.role.id}`)).status, 409, "role with members");

  const proj = await admin.post("/projects", { key: "OPS", name: "Operations", status: "active" });
  assert.equal(proj.status, 201, JSON.stringify(proj.body));
  const field = await admin.post(`/projects/${proj.body.project.id}/fields`, { key: "env", label: "Environment", type: "select", options: ["prod", "staging"], required: true });
  assert.equal(field.status, 201, JSON.stringify(field.body));
  assert.equal(field.body.fields.length, 1);
  const bad = await admin.post("/tasks", { project_id: proj.body.project.id, title: "Deploy", properties: { env: "moon" } });
  assert.equal(bad.status, 400);
  const good = await admin.post("/tasks", { project_id: proj.body.project.id, title: "Deploy", properties: { env: "prod" } });
  assert.equal(good.status, 201, JSON.stringify(good.body));
  assert.equal(good.body.task.key, "OPS-1");

  const dept = await admin.post("/departments", { name: "Finance" });
  assert.equal(dept.status, 201);
  assert.equal((await admin.del(`/departments/${dept.body.department.id}`)).status, 204);
});

test("time corrections and attendance", async () => {
  const [ravi] = await Promise.all([as("ravi")]);
  const arjun = (await ravi.get("/users?q=arjun")).body.users[0];
  const sessions = (await ravi.get(`/time/sessions?user_id=${arjun.id}`)).body.sessions;
  const other = sessions.find((s) => s.clock_out);
  assert.ok(other, "a closed session to correct");
  const out = new Date(new Date(other.clock_out).getTime() - 15 * 60e3).toISOString();
  const fix = await ravi.patch(`/time/sessions/${other.id}`, { clock_in: other.clock_in, clock_out: out, reason: "Left early" });
  assert.equal(fix.status, 200, JSON.stringify(fix.body));
  assert.equal((await ravi.get(`/time/sessions/${other.id}/corrections`)).body.corrections.length, 1);
  const att = await ravi.get("/time/attendance");
  assert.equal(att.status, 200);
  const people = await ravi.get("/people");
  assert.equal(people.status, 200);
  const one = await ravi.get(`/people/${people.body.people[0].id}`);
  assert.equal(one.status, 200, JSON.stringify(one.body));
});
