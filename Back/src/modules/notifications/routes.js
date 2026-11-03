// Your notifications: list, unread count, and marking read.
const express = require("express");
const sql = require("../../db");
const v = require("../../lib/validate");
const { addDueReminders } = require("./service");

const router = express.Router();

/** GET /notifications — latest 50 (?unread=true for unread only), with the unread count. */
router.get("/", async (req, res) => {
  const me = res.locals.me;
  await addDueReminders(me.id);
  const unreadOnly = req.query.unread === "true";
  const rows = await sql`
    select n.id, n.type, n.title, n.body, n.read_at, n.created_at, n.task_id,
           case when a.id is null then null else json_build_object('id', a.id, 'name', a.name) end as actor
    from notifications n left join users a on a.id = n.actor_id
    where n.user_id = ${me.id} ${unreadOnly ? sql`and n.read_at is null` : sql``}
    order by n.created_at desc limit 50`;
  const [{ unread }] = await sql`select count(*) as unread from notifications where user_id = ${me.id} and read_at is null`;
  res.json({ notifications: rows, unread });
});

/** GET /notifications/count — just the unread count, for the bell badge. */
router.get("/count", async (req, res) => {
  await addDueReminders(res.locals.me.id);
  const [{ unread }] = await sql`select count(*) as unread from notifications where user_id = ${res.locals.me.id} and read_at is null`;
  res.json({ unread });
});

/** POST /notifications/read — marks the given ids read, or all of them with { all: true }. */
router.post("/read", async (req, res) => {
  const me = res.locals.me;
  if (req.body?.all === true) {
    await sql`update notifications set read_at = now() where user_id = ${me.id} and read_at is null`;
  } else {
    const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map((i) => v.id(i, "notification id"));
    if (ids.length) await sql`update notifications set read_at = now() where user_id = ${me.id} and id = any(${ids}::bigint[]) and read_at is null`;
  }
  res.status(204).end();
});

module.exports = router;
