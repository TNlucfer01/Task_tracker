// Converts tasks to and from Markdown files with YAML front matter, e.g.
//   ---
//   title: Login screen
//   status: in_progress
//   priority: high
//   assignee: priya
//   properties: { component: Frontend }
//   ---
//   ## What
//   ...
const YAML = require("yaml");
const { HttpError } = require("./http");

/** Builds a .md document for a task. */
function taskToMarkdown(task) {
  const front = {
    key: task.key,
    title: task.title,
    project: task.project?.key ?? null,
    status: task.status,
    priority: task.priority,
    assignee: task.assignee?.name ?? null,
    start_date: task.start_date ?? null,
    deadline: task.deadline ? new Date(task.deadline).toISOString() : null,
    estimate_minutes: task.estimate_minutes ?? null,
    labels: task.labels ?? [],
    properties: task.properties ?? {},
  };
  return `---\n${YAML.stringify(front).trimEnd()}\n---\n\n${task.body_md ?? ""}\n`;
}

/** Splits a .md document into front matter (object) and body (string). */
function parseMarkdown(text) {
  if (typeof text !== "string" || !text.trim()) throw new HttpError(400, "The file is empty.");
  if (text.length > 120000) throw new HttpError(413, "That file is too large to import.");
  const normalized = text.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(normalized);
  let front = {};
  if (match) {
    try {
      front = YAML.parse(match[1]) ?? {};
    } catch {
      throw new HttpError(400, "The properties block at the top of the file isn't valid YAML.");
    }
    if (typeof front !== "object" || Array.isArray(front)) throw new HttpError(400, "The properties block must be a set of key: value lines.");
  }
  let body = match ? normalized.slice(match[0].length) : normalized;
  // No title in front matter: use the first "# Heading" line and drop it from the body.
  if (!front.title) {
    const h = /^\s*#\s+(.+)\n?/.exec(body);
    if (h) {
      front.title = h[1].trim();
      body = body.slice(h[0].length);
    }
  }
  return { front, body: body.replace(/^\n+/, "") };
}

module.exports = { taskToMarkdown, parseMarkdown };
