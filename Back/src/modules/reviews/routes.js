// Reviewing submitted work: approve with a 1–5 rating (task becomes Done) or request changes (Rework).
const express = require("express");
const sql = require("../../db");
const v = require("../../lib/validate");
const { HttpError, forbid } = require("../../lib/http");
const { notify } = require("../notifications/service");
const { visibleTask, canReview } = require("../tasks/service");

const router = express.Router();

/** POST /tasks/:id/reviews — records a review decision and moves the task on. */
router.post("/tasks/:id/reviews", async (req, res) => {
  const me = res.locals.me;
  const task = await visibleTask(me, v.id(req.params.id, "task id"));
  if (!canReview(me, task)) forbid(task.assignee_id === me.id ? "You can't review your own work." : "You can't review work.");
  if (task.status !== "in_review") throw new HttpError(400, "This task isn't waiting for review.");
  const b = req.body ?? {};
  const decision = v.oneOf(b.decision, ["approved", "changes_requested"], "Decision");
  const rating = decision === "approved" ? v.int(b.rating, "Rating", { min: 1, max: 5 }) : null;
  const comment = v.optionalText(b.comment, "Comment", { max: 2000 }) ?? "";
  if (decision === "changes_requested" && !comment) throw new HttpError(400, "Say what needs to change.");

  await sql.begin(async (tx) => {
    await tx`insert into task_reviews (task_id, reviewer_id, assignee_id, decision, rating, comment)
             values (${task.id}, ${me.id}, ${task.assignee_id}, ${decision}, ${rating}, ${comment})`;
    await tx`update tasks set status = ${decision === "approved" ? "done" : "rework"}, updated_by = ${me.id} where id = ${task.id}`;
    await tx`insert into task_events (task_id, actor_id, type, data) values (${task.id}, ${me.id}, 'review', ${tx.json({ decision, rating })})`;
    await notify(tx, {
      userIds: [task.assignee_id],
      type: decision,
      title: decision === "approved" ? `${task.key} was approved` : `${task.key} needs changes`,
      body: comment || task.title,
      taskId: task.id,
      actorId: me.id,
    });
  });
  res.status(201).json({ task: await visibleTask(me, task.id) });
});

module.exports = router;
