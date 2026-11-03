// Comments on tasks. @name mentions notify that person; the assignee and reporter hear about new comments.
const express = require("express");
const sql = require("../../db");
const v = require("../../lib/validate");
const { HttpError, found, forbid } = require("../../lib/http");
const { can } = require("../../middleware/auth");
const { notify } = require("../notifications/service");
const { visibleTask } = require("../tasks/service");

const router = express.Router();

/** Finds the ids of people @mentioned in a comment. */
async function mentionedIds(tx, body) {
  const names = [...new Set([...body.matchAll(/(?:^|\s)@([A-Za-z0-9._-]{2,60})/g)].map((m) => m[1].toLowerCase()))];
  if (!names.length) return [];
  return (await tx`select id from users where lower(name) = any(${names}::text[]) and is_active`).map((u) => u.id);
}

/** POST /tasks/:id/comments — adds a comment. */
router.post("/tasks/:id/comments", async (req, res) => {
  const me = res.locals.me;
  const task = await visibleTask(me, v.id(req.params.id, "task id"));
  const body = v.text(req.body?.body_md, "Comment", { max: 10000 });
  const comment = await sql.begin(async (tx) => {
    const [c] = await tx`insert into task_comments (task_id, author_id, body_md) values (${task.id}, ${me.id}, ${body}) returning *`;
    await tx`insert into task_events (task_id, actor_id, type, data) values (${task.id}, ${me.id}, 'comment', ${tx.json({ comment_id: c.id })})`;
    const mentions = await mentionedIds(tx, body);
    await notify(tx, { userIds: [task.assignee_id, task.reporter_id, ...mentions], type: "comment", title: `${me.name} commented on ${task.key}`, body: body.slice(0, 200), taskId: task.id, actorId: me.id });
    return c;
  });
  res.status(201).json({ comment: { ...comment, author: { id: me.id, name: me.name } } });
});

/** Loads a comment whose task `me` can see. */
async function visibleComment(me, id) {
  const [c] = await sql`select * from task_comments where id = ${id}`;
  found(c, "That comment");
  await visibleTask(me, c.task_id);
  return c;
}

/** PATCH /comments/:id — the author edits their comment. */
router.patch("/comments/:id", async (req, res) => {
  const me = res.locals.me;
  const c = await visibleComment(me, v.id(req.params.id, "comment id"));
  if (c.author_id !== me.id) forbid("You can only edit your own comments.");
  const body = v.text(req.body?.body_md, "Comment", { max: 10000 });
  const [row] = await sql`update task_comments set body_md = ${body}, edited_at = now() where id = ${c.id} returning *`;
  res.json({ comment: { ...row, author: { id: me.id, name: me.name } } });
});

/** DELETE /comments/:id — the author, or someone who can edit any task, removes a comment. */
router.delete("/comments/:id", async (req, res) => {
  const me = res.locals.me;
  const c = await visibleComment(me, v.id(req.params.id, "comment id"));
  if (c.author_id !== me.id && !can(me, "tasks.edit_any")) forbid("You can only delete your own comments.");
  await sql`delete from task_comments where id = ${c.id}`;
  res.status(204).end();
});

module.exports = router;
