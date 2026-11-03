// The task page: a Markdown document on the left, its properties on the right, then the review
// box, comments and history. Edits save explicitly; .md download and copy are one click.
import { useEffect, useState } from 'react'
import { tasks as tasksApi, users as usersApi } from '../api/endpoints'
import type { Priority, PropertyValue, Task, TaskStatus } from '../api/types'
import { Icon } from '../components/icons'
import { Markdown, MarkdownEditor } from '../components/MarkdownEditor'
import { cleanProperties, PropertyInput, PropertyValueView } from '../components/PropertyInput'
import { Avatar, Button, Chip, ConfirmButton, cx, DataState, Field, Input, Notice, OverdueTag, Panel, PersonLink, PriorityTag, Prop, Select, Stars, StatusBadge, Tabs, Textarea } from '../components/ui'
import { useClock } from '../lib/clock'
import { formatDate, formatDateTime, formatMinutes, priorities, priorityLabel, relative, since, taskStatusLabel } from '../lib/format'
import { downloadText } from '../lib/markdown'
import { go, href } from '../lib/router'
import { can, useMe } from '../lib/session'
import { toast } from '../lib/toast'
import { useAction, useApi, useNow } from '../lib/useApi'

/** Describes one history event in plain words. */
function describeEvent(e: Task['events'][number]) {
  const d = e.data as Record<string, unknown>
  switch (e.type) {
    case 'created':
      return 'created this task'
    case 'status':
      return `moved it from ${taskStatusLabel[d.from as TaskStatus] ?? d.from} to ${taskStatusLabel[d.to as TaskStatus] ?? d.to}`
    case 'assignee':
      return d.to ? 'changed the assignee' : 'unassigned it'
    case 'updated':
      return `edited ${(Array.isArray(d.fields) ? d.fields : []).map((f) => String(f).replace(/_md$|_id$|_minutes$/, '').replace(/_/g, ' ')).join(', ')}`
    case 'comment':
      return 'commented'
    case 'review':
      return d.decision === 'approved' ? `approved it${d.rating ? ` (${d.rating}/5)` : ''}` : 'requested changes'
    default:
      return e.type
  }
}

/** The editable properties panel (assignee, dates, estimate, labels, custom fields). */
function PropertiesPanel({ task, onSaved }: { task: Task; onSaved: (t: Task) => void }) {
  const me = useMe()
  const [editing, setEditing] = useState(false)
  const people = useApi(() => (editing && task.can.assign ? usersApi.options() : Promise.resolve({ users: [] })), `task-people-${editing}`)
  const [form, setForm] = useState(() => initial(task))
  const { busy, error, run } = useAction()
  useEffect(() => setForm(initial(task)), [task])

  /** The form values for a task. */
  function initial(t: Task) {
    return {
      priority: t.priority,
      assignee_id: t.assignee_id ?? ('' as number | ''),
      start_date: t.start_date ?? '',
      deadline: t.deadline ? new Date(t.deadline).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '',
      estimate: t.estimate_minutes ? String(t.estimate_minutes / 60) : '',
      labels: t.labels.join(', '),
      properties: { ...t.properties } as Record<string, PropertyValue | null>,
    }
  }

  const save = () =>
    run(async () => {
      const body: Record<string, unknown> = {
        priority: form.priority,
        start_date: form.start_date || null,
        deadline: form.deadline ? new Date(`${form.deadline}T18:00:00+05:30`).toISOString() : null,
        estimate_minutes: form.estimate ? Math.round(Number(form.estimate) * 60) : null,
        labels: form.labels.split(',').map((l) => l.trim()).filter(Boolean),
        properties: cleanProperties(form.properties),
      }
      if (task.can.assign) body.assignee_id = form.assignee_id === '' ? null : form.assignee_id
      const { task: saved } = await tasksApi.update(task.id, body)
      onSaved(saved)
      setEditing(false)
      toast('Properties saved')
    })

  if (!editing)
    return (
      <Panel title="Properties" actions={task.can.edit && <Button size="sm" icon="edit" onClick={() => setEditing(true)}>Edit</Button>}>
        <dl className="divide-y divide-line">
          <Prop label="Status">
            <StatusBadge status={task.status} />
            {task.overdue && <OverdueTag />}
          </Prop>
          <Prop label="Assignee">
            <PersonLink person={task.assignee} to={task.assignee && can(me, 'people.view') ? href('people', task.assignee.id) : undefined} />
          </Prop>
          <Prop label="Reporter">
            <PersonLink person={task.reporter} />
          </Prop>
          <Prop label="Priority">
            <PriorityTag priority={task.priority} />
          </Prop>
          <Prop label="Start">{formatDate(task.start_date)}</Prop>
          <Prop label="Deadline">{formatDate(task.deadline)}</Prop>
          <Prop label="Time logged">
            <span className={cx(task.estimate_minutes && task.actual_minutes > task.estimate_minutes && 'font-medium text-danger')}>
              {formatMinutes(task.actual_minutes)} of {formatMinutes(task.estimate_minutes)}
            </span>
          </Prop>
          <Prop label="Labels">
            {task.labels.length ? (
              <span className="flex flex-wrap gap-1">
                {task.labels.map((l) => (
                  <a key={l} href={href('tasks', { label: l })} className="hover:no-underline">
                    <Chip>{l}</Chip>
                  </a>
                ))}
              </span>
            ) : (
              <span className="text-ink-faint">None</span>
            )}
          </Prop>
          {task.fields.map((f) => (
            <Prop key={f.id} label={f.label}>
              <PropertyValueView field={f} value={task.properties[f.key]} />
              {f.required && task.properties[f.key] === undefined && <span className="ml-1 text-[12px] text-warning">needed to submit</span>}
            </Prop>
          ))}
        </dl>
      </Panel>
    )

  return (
    <Panel title="Edit properties">
      <form className="grid gap-3.5" onSubmit={(e) => (e.preventDefault(), void save())}>
        {error && <Notice tone="danger">{error}</Notice>}
        {task.can.assign && (
          <Field label="Assignee">
            {(id) => (
              <Select id={id} value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value ? Number(e.target.value) : '' })}>
                <option value="">Unassigned</option>
                {task.assignee && !people.data?.users.some((u) => u.id === task.assignee_id) && <option value={task.assignee.id}>{task.assignee.name}</option>}
                {people.data?.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label="Priority">
          {(id) => (
            <Select id={id} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {priorityLabel[p]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">{(id) => <Input id={id} type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />}</Field>
          <Field label="Deadline">{(id) => <Input id={id} type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />}</Field>
        </div>
        <Field label="Estimate (hours)">{(id) => <Input id={id} type="number" min="0.25" step="0.25" value={form.estimate} onChange={(e) => setForm({ ...form, estimate: e.target.value })} />}</Field>
        <Field label="Labels" hint="Comma separated">
          {(id) => <Input id={id} value={form.labels} onChange={(e) => setForm({ ...form, labels: e.target.value })} />}
        </Field>
        {task.fields.map((f) => (
          <Field key={f.id} label={f.label + (f.required ? ' (needed to submit)' : '')}>
            {(id) => <PropertyInput id={id} field={f} value={form.properties[f.key] ?? undefined} onChange={(v) => setForm({ ...form, properties: { ...form.properties, [f.key]: v } })} />}
          </Field>
        ))}
        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={() => (setEditing(false), setForm(initial(task)))}>Cancel</Button>
          <Button type="submit" variant="primary" busy={busy}>
            Save properties
          </Button>
        </div>
      </form>
    </Panel>
  )
}

/** Approve (with a rating) or request changes. */
function ReviewBox({ task, onDone }: { task: Task; onDone: (t: Task) => void }) {
  const [rating, setRating] = useState(4)
  const [comment, setComment] = useState('')
  const { busy, error, run } = useAction()
  const decide = (decision: 'approved' | 'changes_requested') =>
    run(async () => {
      const { task: next } = await tasksApi.review(task.id, { decision, rating: decision === 'approved' ? rating : undefined, comment: comment.trim() || undefined })
      onDone(next)
      setComment('')
      toast(decision === 'approved' ? `${task.key} approved` : `${task.key} sent back for changes`)
    })
  return (
    <section className="rounded-lg border border-status-review bg-surface p-4 sm:p-5">
      <h2 className="text-[17px] font-semibold">Review this work</h2>
      <p className="mt-1 text-ink-soft">{task.assignee?.name ?? 'Someone'} submitted this for review. Approve it to mark it done, or send it back with a note.</p>
      <div className="mt-4 grid gap-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <div role="radiogroup" aria-label="Rating" className="flex items-center gap-1">
          <span className="mr-2 text-[13px] text-ink-soft">Rating</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} out of 5`} onClick={() => setRating(n)} className="text-warning">
              <Icon name="star" size={22} fill={n <= rating ? 'currentColor' : 'none'} />
            </button>
          ))}
        </div>
        <Textarea aria-label="Review note" placeholder="What was good, or what needs to change (required when sending back)" value={comment} onChange={(e) => setComment(e.target.value)} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="danger" busy={busy} disabled={!comment.trim()} onClick={() => decide('changes_requested')}>
            Request changes
          </Button>
          <Button variant="primary" icon="check" busy={busy} onClick={() => decide('approved')}>
            Approve
          </Button>
        </div>
      </div>
    </section>
  )
}

/** Comments with Markdown, editing and deletion. */
function Comments({ task, onChange }: { task: Task; onChange: () => void }) {
  const me = useMe()
  const [text, setText] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const { busy, error, run } = useAction()
  return (
    <div className="grid gap-4">
      {task.comments.length === 0 && <p className="text-ink-soft">No comments yet. Mention someone with @name to notify them.</p>}
      <ul className="grid gap-4">
        {task.comments.map((c) => (
          <li key={c.id} className="flex gap-3">
            <Avatar name={c.author?.name ?? '?'} size={30} />
            <div className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-4 py-3">
              <p className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[13px]">
                <span>
                  <span className="font-medium">{c.author?.name ?? 'Former member'}</span>
                  <span className="text-ink-faint"> · {relative(c.created_at)}{c.edited_at ? ' · edited' : ''}</span>
                </span>
                {editingId !== c.id && (
                  <span className="flex gap-1">
                    {c.author_id === me.id && (
                      <button type="button" className="text-ink-soft hover:text-ink" onClick={() => (setEditingId(c.id), setEditText(c.body_md))}>
                        Edit
                      </button>
                    )}
                    {(c.author_id === me.id || can(me, 'tasks.edit_any')) && (
                      <button type="button" className="text-ink-soft hover:text-danger" onClick={() => run(async () => (await tasksApi.deleteComment(c.id), onChange()))}>
                        Delete
                      </button>
                    )}
                  </span>
                )}
              </p>
              {editingId === c.id ? (
                <div className="grid gap-2">
                  <MarkdownEditor label="Edit comment" value={editText} onChange={setEditText} minRows={4} />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                    <Button size="sm" variant="primary" busy={busy} onClick={() => run(async () => (await tasksApi.editComment(c.id, editText), setEditingId(null), onChange()))}>
                      Save comment
                    </Button>
                  </div>
                </div>
              ) : (
                <Markdown text={c.body_md} />
              )}
            </div>
          </li>
        ))}
      </ul>
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void run(async () => {
            await tasksApi.comment(task.id, text)
            setText('')
            onChange()
          })
        }}
      >
        {error && <Notice tone="danger">{error}</Notice>}
        <MarkdownEditor label="New comment" value={text} onChange={setText} minRows={3} placeholder="Write a comment… use @name to mention someone" />
        <div className="flex justify-end">
          <Button type="submit" variant="primary" busy={busy} disabled={!text.trim()}>
            Comment
          </Button>
        </div>
      </form>
    </div>
  )
}

/** The task page. */
export function TaskPage({ id }: { id: number }) {
  const clock = useClock()
  const now = useNow(30_000)
  const state = useApi(() => tasksApi.get(id).then((r) => r.task), `task-${id}`)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tab, setTab] = useState<'comments' | 'reviews' | 'history'>('comments')
  const { busy, error, run, setError } = useAction()

  return (
    <DataState state={state}>
      {(task) => {
        const timing = clock.status?.timer?.task_id === task.id
        const startEdit = () => {
          setTitle(task.title)
          setBody(task.body_md ?? '')
          setError(null)
          setEditing(true)
        }
        const saveDoc = () =>
          run(async () => {
            const { task: saved } = await tasksApi.update(task.id, { title, body_md: body })
            state.set({ ...task, ...saved })
            setEditing(false)
            toast('Saved')
          })
        const refresh = () => {
          state.reload()
          void clock.refresh()
        }

        return (
          <>
            <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-[13px] text-ink-soft">
              <a href={href('projects', task.project.id)} className="text-ink-soft hover:text-ink">
                {task.project.name}
              </a>
              <Icon name="chevron" size={13} />
              <span>{task.key}</span>
            </nav>

            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              {editing ? (
                <Input aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="h-11 max-w-3xl flex-1 text-[22px] font-semibold" />
              ) : (
                <h1 className="max-w-3xl text-[26px] leading-8 font-semibold tracking-[-0.01em] break-words">{task.title}</h1>
              )}
              <div className="flex flex-wrap gap-2">
                {task.can.track_time && (
                  timing ? (
                    <Button icon="stop" busy={clock.busy} onClick={async () => (await clock.stopTimer(), state.reload())}>
                      Stop timer · {since(clock.status!.timer!.started_at, now)}
                    </Button>
                  ) : (
                    <Button icon="play" busy={clock.busy} disabled={!clock.status?.session} title={clock.status?.session ? undefined : 'Clock in first'} onClick={async () => (await clock.startTimer(task.id)) && state.reload()}>
                      Start timer
                    </Button>
                  )
                )}
                {task.can.submit && (
                  <Button variant="primary" icon="check" busy={busy} onClick={() => run(async () => (state.set({ ...task, ...(await tasksApi.submit(task.id)).task }), refresh(), toast('Submitted for review')))}>
                    Submit for review
                  </Button>
                )}
                {task.can.edit && task.status === 'todo' && (
                  <Button busy={busy} onClick={() => run(async () => (await tasksApi.update(task.id, { status: 'in_progress' }), refresh()))}>
                    Start work
                  </Button>
                )}
              </div>
            </div>

            {error && (
              <div className="mb-4">
                <Notice tone="danger">{error}</Notice>
              </div>
            )}
            {task.status === 'rework' && task.reviews[0]?.decision === 'changes_requested' && (
              <div className="mb-4">
                <Notice tone="warning">
                  <strong>{task.reviews[0].reviewer?.name ?? 'A reviewer'} asked for changes:</strong> {task.reviews[0].comment}
                </Notice>
              </div>
            )}
            {task.status === 'in_review' && !task.can.review && (
              <div className="mb-4">
                <Notice>This is waiting for review. You'll get a notification when it's approved or sent back.</Notice>
              </div>
            )}
            {!clock.status?.session && task.can.track_time && (
              <p className="mb-4 text-[13px] text-ink-faint">Clock in to time your work on this task.</p>
            )}

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="grid min-w-0 gap-6">
                {task.can.review && <ReviewBox task={task} onDone={(t) => (state.set({ ...task, ...t }), state.reload())} />}
                <section className="rounded-lg border border-line bg-surface">
                  <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 sm:px-5">
                    <h2 className="text-[13px] font-medium text-ink-soft">Description</h2>
                    <div className="flex flex-wrap gap-1.5">
                      {!editing && (
                        <>
                          <Button size="sm" variant="ghost" icon="download" onClick={() => run(async () => downloadText(`${task.key}.md`, await tasksApi.markdown(task.id)))}>
                            .md
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => run(async () => (await navigator.clipboard.writeText(await tasksApi.markdown(task.id)), toast('Markdown copied')))}>
                            Copy
                          </Button>
                          {task.can.edit && (
                            <Button size="sm" icon="edit" onClick={startEdit}>
                              Edit
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </header>
                  <div className="px-4 py-4 sm:px-5">
                    {editing ? (
                      <div className="grid gap-3">
                        <MarkdownEditor label="Description" value={body} onChange={setBody} minRows={16} autoFocus />
                        <div className="flex justify-end gap-2">
                          <Button onClick={() => setEditing(false)}>Cancel</Button>
                          <Button variant="primary" busy={busy} disabled={!title.trim()} onClick={saveDoc}>
                            Save changes
                          </Button>
                        </div>
                      </div>
                    ) : task.body_md?.trim() ? (
                      <Markdown text={task.body_md} />
                    ) : (
                      <p className="text-ink-faint">
                        No description yet.{' '}
                        {task.can.edit && (
                          <button type="button" className="text-primary hover:underline" onClick={startEdit}>
                            Write one
                          </button>
                        )}
                      </p>
                    )}
                  </div>
                </section>

                <section>
                  <Tabs
                    value={tab}
                    onChange={setTab}
                    tabs={[
                      { value: 'comments', label: `Comments${task.comments.length ? ` (${task.comments.length})` : ''}` },
                      { value: 'reviews', label: `Reviews${task.reviews.length ? ` (${task.reviews.length})` : ''}` },
                      { value: 'history', label: 'History' },
                    ]}
                  />
                  {tab === 'comments' && <Comments task={task} onChange={state.reload} />}
                  {tab === 'reviews' &&
                    (task.reviews.length ? (
                      <ul className="grid gap-3">
                        {task.reviews.map((r) => (
                          <li key={r.id} className="rounded-lg border border-line bg-surface px-4 py-3">
                            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                              <span className={cx('font-medium', r.decision === 'approved' ? 'text-success' : 'text-warning')}>{r.decision === 'approved' ? 'Approved' : 'Changes requested'}</span>
                              {r.rating && <Stars value={r.rating} />}
                              <span className="text-ink-faint">
                                {r.reviewer?.name ?? 'Former member'} · {formatDateTime(r.created_at)}
                              </span>
                            </p>
                            {r.comment && <p className="mt-1.5 whitespace-pre-wrap">{r.comment}</p>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-ink-soft">No reviews yet. Reviews appear after the task is submitted.</p>
                    ))}
                  {tab === 'history' && (
                    <ol className="grid gap-2.5 border-l border-line pl-4">
                      {task.events.map((e) => (
                        <li key={e.id} className="relative text-sm">
                          <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-surface bg-line-strong" aria-hidden />
                          <span className="font-medium">{e.actor?.name ?? 'System'}</span> {describeEvent(e)}
                          <span className="block text-[12px] text-ink-faint">{formatDateTime(e.created_at)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </div>

              <aside className="grid gap-4 lg:sticky lg:top-6">
                <PropertiesPanel task={task} onSaved={(t) => state.set({ ...task, ...t })} />
                <p className="px-1 text-[12px] text-ink-faint">
                  Created {formatDateTime(task.created_at)} · updated {relative(task.updated_at)}
                  {task.completed_at ? ` · done ${formatDate(task.completed_at)}` : ''}
                </p>
                {task.can.delete && (
                  <div className="px-1">
                    <ConfirmButton
                      size="sm"
                      icon="trash"
                      label="Delete task"
                      title={`Delete ${task.key}?`}
                      confirm="This removes the task with its comments, reviews and timers. It can't be undone."
                      onConfirm={async () => {
                        await tasksApi.remove(task.id)
                        toast(`${task.key} deleted`)
                        go('projects', task.project.id)
                      }}
                    />
                  </div>
                )}
              </aside>
            </div>
          </>
        )
      }}
    </DataState>
  )
}
