// Home: your clock, what's on your plate, what needs your review, and recent notifications.
import { useState } from 'react'
import { notifications as notificationsApi, tasks as tasksApi } from '../api/endpoints'
import { NewTaskDialog, TaskTable } from '../components/tasks'
import { Button, DataState, Empty, KpiStrip, Panel } from '../components/ui'
import { useClock } from '../lib/clock'
import { formatHours, formatMinutes, plural, relative, since } from '../lib/format'
import { href } from '../lib/router'
import { can, useMe } from '../lib/session'
import { useApi, useNow } from '../lib/useApi'

/** Greets by time of day in India. */
function greeting() {
  const h = Number(new Date().toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }))
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/** The Home page. */
export function Home() {
  const me = useMe()
  const clock = useClock()
  const now = useNow(30_000)
  const [creating, setCreating] = useState(false)
  const mine = useApi(() => tasksApi.list({ assignee: 'me', status: 'todo,in_progress,in_review,rework', sort: 'deadline' }), 'home-mine')
  const review = useApi(() => (can(me, 'reviews.perform') ? tasksApi.list({ status: 'in_review', sort: 'deadline' }) : Promise.resolve({ tasks: [] })), 'home-review')
  const notes = useApi(() => notificationsApi.list(), 'home-notes')
  const tracks = can(me, 'time.track')

  const open = mine.data?.tasks ?? []
  const toReview = (review.data?.tasks ?? []).filter((t) => t.assignee_id !== me.id)
  const s = clock.status

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.01em]">
            {greeting()}, {me.name}
          </h1>
          <p className="mt-1 text-ink-soft">
            {me.title ? `${me.title} · ` : ''}
            {me.role.name}
            {me.department_name ? ` in ${me.department_name}` : ''}
          </p>
        </div>
        {can(me, 'tasks.create') && (
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            New task
          </Button>
        )}
      </header>

      <div className="grid gap-6">
        {tracks && s && (
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-surface px-5 py-4">
            <div className="flex items-center gap-3">
              <span className={s.session ? 'live-dot size-2.5 rounded-full bg-success' : 'size-2.5 rounded-full bg-status-todo'} aria-hidden />
              <div>
                <p className="font-medium">{s.session ? `Clocked in for ${since(s.session.clock_in, now)}` : "You're not clocked in"}</p>
                <p className="text-[13px] text-ink-soft">
                  {s.timer ? (
                    <>
                      Timing <a href={href('tasks', s.timer.task_id)}>{s.timer.task_key}</a> · {since(s.timer.started_at, now)}
                    </>
                  ) : (
                    `Today: ${formatHours(s.hours_today)} clocked, ${formatMinutes(s.task_minutes_today)} on tasks`
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {s.timer && (
                <Button icon="stop" busy={clock.busy} onClick={clock.stopTimer}>
                  Stop timer
                </Button>
              )}
              {s.session ? (
                <Button busy={clock.busy} onClick={clock.clockOut}>
                  Clock out
                </Button>
              ) : (
                <Button variant="primary" busy={clock.busy} onClick={clock.clockIn}>
                  Clock in
                </Button>
              )}
            </div>
          </section>
        )}

        <KpiStrip
          items={[
            { label: 'My open tasks', value: open.length, href: href('tasks', { assignee: 'me' }) },
            { label: 'Overdue', value: open.filter((t) => t.overdue).length, tone: open.some((t) => t.overdue) ? 'danger' : undefined, href: href('tasks', { assignee: 'me', overdue: 'true' }) },
            { label: 'Sent back', value: open.filter((t) => t.status === 'rework').length, hint: 'Rework after review' },
            { label: 'Waiting for review', value: open.filter((t) => t.status === 'in_review').length },
            ...(can(me, 'reviews.perform') ? [{ label: 'For you to review', value: toReview.length, href: href('tasks', { status: 'in_review' }) }] : []),
          ]}
        />

        <Panel title="Your tasks" actions={<a href={href('tasks', { assignee: 'me', view: 'board' })} className="text-[13px]">Open board</a>} padded={false}>
          <div className="p-0">
            <DataState state={mine} isEmpty={(d) => d.tasks.length === 0} empty="Nothing assigned to you right now. New assignments show up here and in your notifications.">
              {(d) => <TaskTable tasks={d.tasks} />}
            </DataState>
          </div>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          {can(me, 'reviews.perform') && (
            <Panel title="Waiting for your review">
              <DataState state={review} isEmpty={() => toReview.length === 0} empty="No work is waiting for review.">
                {() => (
                  <ul className="divide-y divide-line">
                    {toReview.slice(0, 8).map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                        <span className="min-w-0">
                          <a href={href('tasks', t.id)} className="block truncate font-medium">
                            {t.title}
                          </a>
                          <span className="text-[13px] text-ink-faint">
                            {t.key} · {t.assignee?.name ?? 'Unassigned'}
                          </span>
                        </span>
                        <a href={href('tasks', t.id)} className="shrink-0 text-[13px]">
                          Review
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </DataState>
            </Panel>
          )}
          <Panel title="Recent notifications">
            <DataState state={notes} isEmpty={(d) => d.notifications.length === 0} empty="No notifications yet.">
              {(d) => (
                <ul className="divide-y divide-line">
                  {d.notifications.slice(0, 8).map((n) => (
                    <li key={n.id} className="py-2.5">
                      {n.task_id ? <a href={href('tasks', n.task_id)} className={n.read_at ? 'text-ink' : 'font-medium'}>{n.title}</a> : <span>{n.title}</span>}
                      <span className="block text-[12px] text-ink-faint">{relative(n.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </DataState>
            {notes.data && notes.data.unread > 0 && <p className="mt-3 text-[13px] text-ink-soft">{plural(notes.data.unread, 'unread notification')}</p>}
          </Panel>
        </div>
        {!tracks && !can(me, 'tasks.create') && open.length === 0 && <Empty>Use the menu to find projects and tasks.</Empty>}
      </div>
      <NewTaskDialog open={creating} onClose={() => setCreating(false)} />
    </>
  )
}
