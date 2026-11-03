// Task views shared by the Tasks page, project pages and Home: the table, the board and the
// create/import dialogs.
import { useState, type DragEvent } from 'react'
import { projects as projectsApi, tasks as tasksApi, users as usersApi } from '../api/endpoints'
import type { Field, Priority, Project, PropertyValue, TaskRow, TaskStatus } from '../api/types'
import { formatDate, formatMinutes, fromLocalInput, priorities, priorityLabel, taskStatusLabel, taskStatuses } from '../lib/format'
import { go, href } from '../lib/router'
import { can, useMe } from '../lib/session'
import { toast } from '../lib/toast'
import { useAction, useApi } from '../lib/useApi'
import { Icon } from './icons'
import { MarkdownEditor } from './MarkdownEditor'
import { cleanProperties, PropertyInput } from './PropertyInput'
import { Avatar, Button, Chip, cx, Dialog, Field as FormField, Input, Notice, OverdueTag, PersonLink, PriorityTag, Select, StatusBadge, TableWrap } from './ui'

/** A dense table of tasks. */
export function TaskTable({ tasks, showProject = true }: { tasks: TaskRow[]; showProject?: boolean }) {
  return (
    <>
      <div className="hidden sm:block">
        <TableWrap>
          <table className="data-table min-w-[820px]">
            <thead>
              <tr>
                <th scope="col">Task</th>
                <th scope="col">Status</th>
                <th scope="col">Priority</th>
                <th scope="col">Assignee</th>
                <th scope="col">Deadline</th>
                <th scope="col" className="num">Time / estimate</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                return (
                  <tr key={t.id}>
                    <th scope="row" className="font-normal">
                      <a href={href('tasks', t.id)} className="font-medium text-ink hover:text-primary">
                        {t.title}
                      </a>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-faint">
                        <span>{t.key}</span>
                        {showProject && <span>{t.project.name}</span>}
                        {t.labels.slice(0, 3).map((l) => (
                          <Chip key={l}>{l}</Chip>
                        ))}
                        {t.comment_count > 0 && (
                          <span className="inline-flex items-center gap-0.5">
                            <Icon name="comment" size={12} />
                            {t.comment_count}
                          </span>
                        )}
                      </span>
                    </th>
                    <td><StatusBadge status={t.status} /></td>
                    <td><PriorityTag priority={t.priority} /></td>
                    <td><PersonLink person={t.assignee} /></td>
                    <td className="whitespace-nowrap">{formatDate(t.deadline)}{t.overdue && <OverdueTag />}</td>
                    <td className={cx('num', t.estimate_minutes && t.actual_minutes > t.estimate_minutes && 'font-medium text-danger')}>
                      {t.actual_minutes ? formatMinutes(t.actual_minutes) : '—'} / {formatMinutes(t.estimate_minutes)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableWrap>
      </div>
      <ul className="mobile-records p-3 sm:hidden">
        {tasks.map((t) => (
          <li key={t.id} className="mobile-record">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <a href={href('tasks', t.id)} className="block font-semibold leading-5 text-ink">{t.title}</a>
                <span className="mt-1 block text-[13px] text-ink-faint">{t.key}{showProject ? ` · ${t.project.name}` : ''}</span>
              </div>
              <StatusBadge status={t.status} />
            </div>
            <div className="mobile-record-grid">
              <div><span className="mobile-record-label">Assignee</span><span className="mobile-record-value"><PersonLink person={t.assignee} /></span></div>
              <div><span className="mobile-record-label">Deadline</span><span className={cx('mobile-record-value', t.overdue && 'font-medium text-danger')}>{formatDate(t.deadline)}{t.overdue && <OverdueTag />}</span></div>
              <div><span className="mobile-record-label">Priority</span><PriorityTag priority={t.priority} /></div>
              <div><span className="mobile-record-label">Time / estimate</span><span className={cx('mobile-record-value', t.estimate_minutes && t.actual_minutes > t.estimate_minutes && 'font-medium text-danger')}>{t.actual_minutes ? formatMinutes(t.actual_minutes) : '—'} / {formatMinutes(t.estimate_minutes)}</span></div>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

/** One card on the board. */
function BoardCard({ task, draggable, onDragStart, onMove }: { task: TaskRow; draggable: boolean; onDragStart: (e: DragEvent) => void; onMove: (status: TaskStatus) => void }) {
  return (
    <li
      draggable={draggable}
      onDragStart={onDragStart}
      className={cx('rounded-md border border-line bg-surface p-3 hover:border-line-strong', draggable && 'cursor-grab active:cursor-grabbing')}
    >
      <a href={href('tasks', task.id)} className="block font-medium text-ink hover:text-primary hover:no-underline">
        {task.title}
      </a>
      <p className="mt-1 text-[12px] text-ink-faint">
        {task.key} · {task.project.name}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <PriorityTag priority={task.priority} quiet />
          {task.deadline && (
            <span className={cx('text-[12px]', task.overdue ? 'font-medium text-danger' : 'text-ink-soft')}>
              {task.overdue ? 'Overdue · ' : 'Due '}
              {formatDate(task.deadline)}
            </span>
          )}
        </span>
        {task.assignee && (
          <span title={task.assignee.name}>
            <Avatar name={task.assignee.name} size={22} />
          </span>
        )}
      </div>
      {draggable && task.status !== 'done' && (
        <label className="mt-3 block text-[12px] text-ink-faint">
          Move task
          <select
            aria-label={`Move ${task.key}`}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) onMove(e.target.value as TaskStatus)
              e.target.value = ''
            }}
            className="mt-1 h-8 w-full rounded-md border border-line bg-surface px-2 text-[13px] text-ink sm:hidden"
          >
            <option value="">Choose a status…</option>
            {(['todo', 'in_progress', 'in_review'] as const).filter((status) => status !== task.status).map((status) => (
              <option key={status} value={status}>{status === 'in_review' ? 'Submit for review' : taskStatusLabel[status]}</option>
            ))}
          </select>
        </label>
      )}
    </li>
  )
}

/** A Kanban board. Cards move between Not started and In progress; dropping on In review submits. */
export function TaskBoard({ tasks, onChanged }: { tasks: TaskRow[]; onChanged: () => void }) {
  const me = useMe()
  const [over, setOver] = useState<TaskStatus | null>(null)

  /** Applies a drop: a status move, or a submit for review. */
  const drop = async (status: TaskStatus, id: number) => {
    setOver(null)
    const task = tasks.find((t) => t.id === id)
    if (!task || task.status === status) return
    try {
      if (status === 'in_review') await tasksApi.submit(id)
      else if (status === 'todo' || status === 'in_progress') await tasksApi.update(id, { status })
      else return toast(status === 'done' ? 'Work is marked done when a reviewer approves it.' : 'Rework is set by a reviewer.')
      toast(status === 'in_review' ? `${task.key} submitted for review` : `${task.key} moved to ${taskStatusLabel[status]}`)
      onChanged()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That move didn’t work.')
    }
  }

  return (
    <div className="-mx-4 snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-4 pb-2 sm:mx-0 sm:snap-none sm:px-0">
      <p className="mb-2 text-[12px] text-ink-faint sm:hidden">Swipe across to see each status. You can move cards with the menu on each task.</p>
      <div className="task-board-columns gap-3 sm:min-w-[1060px]">
        {taskStatuses.map((status) => {
          const column = tasks.filter((t) => t.status === status)
          return (
            <section
              key={status}
              aria-label={taskStatusLabel[status]}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(status)
              }}
              onDragLeave={() => setOver((s) => (s === status ? null : s))}
              onDrop={(e) => {
                e.preventDefault()
                void drop(status, Number(e.dataTransfer.getData('text/task')))
              }}
              className={cx('flex min-h-64 snap-start flex-col rounded-lg border bg-subtle/60', over === status ? 'border-primary' : 'border-line')}
            >
              <header className="flex items-center justify-between px-3 pt-3 pb-2">
                <StatusBadge status={status} />
                <span className="text-[13px] text-ink-faint">{column.length}</span>
              </header>
              <ul className="grid content-start gap-2 px-2 pb-2">
                {column.map((t) => (
                  <BoardCard
                    key={t.id}
                    task={t}
                    draggable={t.status !== 'done' && (t.assignee_id === me.id || can(me, 'tasks.edit_any'))}
                    onDragStart={(e) => e.dataTransfer.setData('text/task', String(t.id))}
                    onMove={(status) => void drop(status, t.id)}
                  />
                ))}
                {!column.length && <li className="rounded-md border border-dashed border-line px-3 py-6 text-center text-[13px] text-ink-faint">No tasks</li>}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}

/** The create-task dialog: project, title, body, assignee, dates and custom fields. */
export function NewTaskDialog({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId?: number }) {
  const me = useMe()
  const projectList = useApi(() => projectsApi.list(), `new-task-projects-${open}`)
  const people = useApi(() => (can(me, 'tasks.assign') ? usersApi.options() : Promise.resolve({ users: [] })), `new-task-people-${open}`)
  const [project, setProject] = useState<number | ''>(projectId ?? '')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [assignee, setAssignee] = useState<number | ''>(me.id)
  const [priority, setPriority] = useState<Priority>('medium')
  const [deadline, setDeadline] = useState('')
  const [estimate, setEstimate] = useState('')
  const [labels, setLabels] = useState('')
  const [props, setProps] = useState<Record<string, PropertyValue | null>>({})
  const fields = useApi<Field[]>(() => (project ? projectsApi.get(Number(project)).then((r) => r.project.fields ?? []) : Promise.resolve([])), `fields-${project}`)
  const { busy, error, run } = useAction()
  const open_projects = (projectList.data?.projects ?? []).filter((p: Project) => p.status !== 'completed')

  /** Creates the task and opens it. */
  const save = () =>
    run(async () => {
      const { task } = await tasksApi.create({
        project_id: Number(project),
        title,
        body_md: body,
        priority,
        assignee_id: assignee === '' ? null : assignee,
        deadline: deadline ? fromLocalInput(`${deadline}T18:00`) : null,
        estimate_minutes: estimate ? Math.round(Number(estimate) * 60) : null,
        labels: labels.split(',').map((l) => l.trim()).filter(Boolean),
        properties: cleanProperties(props),
      })
      toast(`${task.key} created`)
      onClose()
      go('tasks', task.id)
    })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New task"
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy} disabled={!project || !title.trim()} onClick={save}>
            Create task
          </Button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={(e) => (e.preventDefault(), void save())}>
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Project">
            {(id) => (
              <Select id={id} value={project} onChange={(e) => (setProject(e.target.value ? Number(e.target.value) : ''), setProps({}))} required>
                <option value="">Choose a project</option>
                {open_projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.key} · {p.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          {can(me, 'tasks.assign') && (
            <FormField label="Assignee">
              {(id) => (
                <Select id={id} value={assignee} onChange={(e) => setAssignee(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Unassigned</option>
                  {people.data?.users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                      {u.department_name ? ` · ${u.department_name}` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          )}
        </div>
        <FormField label="Title">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required placeholder="What needs to happen?" />}</FormField>
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-soft">Description</p>
          <MarkdownEditor label="Description" value={body} onChange={setBody} minRows={6} placeholder={'## Goal\n\n## Acceptance\n- [ ] '} />
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <FormField label="Priority">
            {(id) => (
              <Select id={id} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                {priorities.map((p) => (
                  <option key={p} value={p}>
                    {priorityLabel[p]}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Deadline">{(id) => <Input id={id} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />}</FormField>
          <FormField label="Estimate (hours)">{(id) => <Input id={id} type="number" min="0.25" step="0.25" value={estimate} onChange={(e) => setEstimate(e.target.value)} />}</FormField>
          <FormField label="Labels" hint="Comma separated">
            {(id) => <Input id={id} value={labels} onChange={(e) => setLabels(e.target.value)} placeholder="api, bug" />}
          </FormField>
        </div>
        {fields.data && fields.data.length > 0 && (
          <fieldset className="grid gap-4 rounded-md border border-line p-4 sm:grid-cols-2">
            <legend className="px-1 text-[13px] font-medium text-ink-soft">Project fields</legend>
            {fields.data.map((f) => (
              <FormField key={f.id} label={`${f.label}${f.required ? ' (needed to submit)' : ''}`}>
                {(id) => <PropertyInput id={id} field={f} value={props[f.key] ?? undefined} onChange={(v) => setProps((p) => ({ ...p, [f.key]: v }))} />}
              </FormField>
            ))}
          </fieldset>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}

/** Imports a task from a .md file (front matter becomes properties). */
export function ImportDialog({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId?: number }) {
  const projectList = useApi(() => projectsApi.list(), `import-projects-${open}`)
  const [project, setProject] = useState<number | ''>(projectId ?? '')
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const { busy, error, run } = useAction()
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Import a Markdown task"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            busy={busy}
            disabled={!project || !text.trim()}
            onClick={() =>
              run(async () => {
                const { task } = await tasksApi.importMarkdown(Number(project), text)
                toast(`${task.key} imported`)
                onClose()
                go('tasks', task.id)
              })
            }
          >
            Import task
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {error && <Notice tone="danger">{error}</Notice>}
        <p className="text-ink-soft">
          The first <code># heading</code> becomes the title. Front matter between <code>---</code> lines can set status, priority, assignee, deadline, labels and project fields.
        </p>
        <FormField label="Project">
          {(id) => (
            <Select id={id} value={project} onChange={(e) => setProject(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Choose a project</option>
              {projectList.data?.projects.filter((p) => p.status !== 'completed').map((p) => (
                <option key={p.id} value={p.id}>
                  {p.key} · {p.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Markdown file" hint={fileName || 'A .md or .txt file'}>
          {(id) => (
            <Input
              id={id}
              type="file"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              className="py-1.5"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                setFileName(f.name)
                setText(await f.text())
              }}
            />
          )}
        </FormField>
        {text && <pre className="max-h-48 overflow-auto rounded-md bg-subtle p-3 text-[12px] leading-5 whitespace-pre-wrap">{text.slice(0, 2000)}</pre>}
      </div>
    </Dialog>
  )
}
