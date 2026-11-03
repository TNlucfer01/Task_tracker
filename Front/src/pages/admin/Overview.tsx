import { useState, type ReactNode } from 'react'
import {
  getSummary,
  type AttentionTask,
  type DashboardSummary,
  type DepartmentSummary,
  type ProjectProgress,
} from '../../api/admin/dashboard'
import { Button, LiveDot, OverdueTag, PageHeader, ProjectStatusPill, TaskStatusPill } from '../../components/ui'
import {
  formatAgo,
  formatDay,
  formatDue,
  formatHours,
  formatMinutes,
  formatTime,
  minutesSince,
  plural,
  taskStatusLabel,
} from '../../lib/format'
import { href } from '../../lib/router'
import { departmentFill } from '../../lib/status'
import { useApi, useNow } from '../../lib/useApi'

const REFRESH_MS = 60_000

export function Overview() {
  const summary = useApi(getSummary, 'summary', REFRESH_MS)
  const now = useNow(15_000)
  const data = summary.data

  return (
    <>
      <PageHeader
        title="Overview"
        lede={
          data ? (
            <>
              {formatDay(data.date, 'long')}.{' '}
              {summary.loading
                ? 'Updating…'
                : summary.loadedAt
                  ? `Updated at ${formatTime(new Date(summary.loadedAt).toISOString())}.`
                  : ''}
            </>
          ) : (
            'Loading the latest numbers…'
          )
        }
        actions={
          <Button onClick={summary.reload} disabled={summary.loading}>
            Refresh
          </Button>
        }
      />

      {summary.error && (
        <div
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/30 bg-danger-tint px-4 py-3 text-danger"
          role="alert"
        >
          <p>
            {data ? 'Showing the last numbers that loaded. ' : ''}
            {summary.error}
          </p>
          <Button onClick={summary.reload}>Try again</Button>
        </div>
      )}

      {!data ? (
        !summary.error && (
          <p className="py-10 text-ink-soft" role="status">
            Loading…
          </p>
        )
      ) : (
        <div className="grid gap-6">
          <Kpis data={data} />

          <div className="grid gap-6 xl:grid-cols-12">
            <div className="min-w-0 xl:col-span-8">
              <Attention attention={data.attention} now={now} />
            </div>
            <div className="min-w-0 xl:col-span-4">
              <OnTheClock data={data} now={now} />
            </div>
          </div>

          <ProjectsPanel projects={data.projects} departments={data.departments} now={now} />
          <DepartmentsPanel departments={data.departments} />

          <div className="grid items-start gap-6 xl:grid-cols-12">
            <div className="min-w-0 xl:col-span-7">
              <HoursTrend data={data} />
            </div>
            <div className="min-w-0 xl:col-span-5">
              <Activity activity={data.activity} now={now} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ---- Building blocks --------------------------------------------------------------------

function Panel({
  id,
  title,
  meta,
  action,
  children,
  flush = false,
}: {
  id: string
  title: string
  meta?: ReactNode
  action?: ReactNode
  children: ReactNode
  flush?: boolean
}) {
  return (
    <section aria-labelledby={id} className="h-full overflow-hidden rounded-lg border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-3.5">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
          <h2 id={id} className="text-[17px] leading-6 font-semibold">
            {title}
          </h2>
          {meta && <p className="text-sm text-ink-soft">{meta}</p>}
        </div>
        {action}
      </header>
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </section>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-center text-sm text-ink-soft">{children}</p>
}

function Swatch({ slot }: { slot: number }) {
  return <i className={`inline-block size-2.5 shrink-0 rounded-sm ${departmentFill(slot)}`} aria-hidden="true" />
}

// ---- KPI strip ---------------------------------------------------------------------------

function Kpis({ data }: { data: DashboardSummary }) {
  const { people, tasks } = data
  const cells: { label: string; value: number; context: string; to?: string; alert?: boolean }[] = [
    { label: 'Active people', value: people.active, context: `${people.clocked_in_now} clocked in now`, to: href('people') },
    { label: 'Not started', value: tasks.not_started, context: 'Assigned, no work yet', to: href('tasks', 'status', 'todo') },
    {
      label: 'Pending',
      value: tasks.pending,
      context: `${tasks.in_progress} in progress, ${tasks.in_review} in review, ${tasks.rework} rework`,
    },
    {
      label: 'Completed',
      value: tasks.completed,
      context: `${tasks.completed_this_week} in the last 7 days`,
      to: href('tasks', 'status', 'done'),
    },
    {
      label: 'Overdue',
      value: tasks.overdue,
      context: `${tasks.due_this_week} more due this week`,
      to: href('tasks', 'overdue'),
      alert: tasks.overdue > 0,
    },
  ]

  return (
    <section aria-label="Key numbers" className="overflow-hidden rounded-lg border border-line bg-surface">
      <dl className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-5">
        {cells.map((c) => (
          <div key={c.label} className="bg-surface px-5 py-4 last:max-sm:col-span-2">
            <dt className="text-[13px] font-medium text-ink-soft">{c.label}</dt>
            <dd className={`mt-0.5 text-[30px] leading-9 font-semibold tracking-tight ${c.alert ? 'text-danger' : ''}`}>
              {c.to ? (
                <a
                  href={c.to}
                  className={`no-underline hover:underline ${c.alert ? 'text-danger hover:text-danger' : 'text-ink hover:text-ink'}`}
                >
                  {c.value}
                </a>
              ) : (
                c.value
              )}
            </dd>
            <dd className="mt-0.5 text-xs text-ink-faint">{c.context}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// ---- Needs attention ---------------------------------------------------------------------

const attentionTabs = [
  { key: 'waiting_review', label: 'Waiting for review', empty: 'Nothing is waiting for your review.' },
  { key: 'overdue', label: 'Overdue', empty: 'No tasks are overdue.' },
  { key: 'due_soon', label: 'Due this week', empty: 'Nothing else is due in the next 7 days.' },
] as const

type AttentionKey = (typeof attentionTabs)[number]['key']

function Attention({ attention, now }: { attention: DashboardSummary['attention']; now: number }) {
  const [tab, setTab] = useState<AttentionKey>(
    attention.waiting_review.count ? 'waiting_review' : attention.overdue.count ? 'overdue' : 'due_soon',
  )
  const current = attention[tab]
  const config = attentionTabs.find((t) => t.key === tab)!
  const moreLink =
    tab === 'overdue' ? href('tasks', 'overdue') : tab === 'waiting_review' ? href('tasks', 'status', 'in_review') : href('tasks')

  return (
    <Panel id="attention-title" title="Needs attention" flush>
      <div role="tablist" aria-label="Needs attention" className="flex gap-1 overflow-x-auto border-b border-line px-3">
        {attentionTabs.map((t) => (
          <button
            key={t.key}
            id={`attention-tab-${t.key}`}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            aria-controls="attention-panel"
            onClick={() => setTab(t.key)}
            className="-mb-px flex cursor-pointer items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium whitespace-nowrap text-ink-soft hover:text-ink aria-selected:border-primary aria-selected:text-ink"
          >
            {t.label}
            <span
              className={`rounded-sm px-1.5 text-xs font-semibold ${t.key === 'overdue' && attention.overdue.count ? 'bg-danger-tint text-danger' : 'bg-subtle text-ink-soft'}`}
            >
              {attention[t.key].count}
            </span>
          </button>
        ))}
      </div>
      <div id="attention-panel" role="tabpanel" aria-labelledby={`attention-tab-${tab}`}>
        {current.tasks.length === 0 ? (
          <Empty>{config.empty}</Empty>
        ) : (
          <ul>
            {current.tasks.map((t) => (
              <AttentionRow key={t.id} task={t} now={now} />
            ))}
          </ul>
        )}
        {current.count > current.tasks.length && (
          <p className="border-t border-line px-5 py-3 text-sm">
            <a href={moreLink}>See all {current.count}</a>
          </p>
        )}
      </div>
    </Panel>
  )
}

function AttentionRow({ task, now }: { task: AttentionTask; now: number }) {
  return (
    <li className="grid gap-x-4 gap-y-1 border-b border-line px-5 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_120px_170px] sm:items-center">
      <div className="min-w-0">
        <p className="truncate font-medium">{task.name}</p>
        <p className="truncate text-xs text-ink-faint">
          {task.number ? `#${task.number} · ` : ''}{task.priority} priority · {task.project?.name ?? 'No project'}
        </p>
      </div>
      <p className="text-sm">
        {task.assignee ? (
          <a href={href('people', task.assignee.id)}>{task.assignee.name}</a>
        ) : (
          <span className="text-ink-faint">Unassigned</span>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-x-2 text-sm">
        {task.overdue ? (
          <span className="font-medium text-danger">{formatDue(task.deadline, now)}</span>
        ) : (
          <>
            <TaskStatusPill status={task.status} />
            <span className="text-xs text-ink-faint">{formatDue(task.deadline, now)}</span>
          </>
        )}
      </div>
    </li>
  )
}

// ---- On the clock ------------------------------------------------------------------------

function OnTheClock({ data, now }: { data: DashboardSummary; now: number }) {
  const deptName = new Map(data.departments.map((d) => [d.id, d.name]))

  return (
    <Panel
      id="clock-title"
      title="On the clock"
      meta={`${data.on_the_clock.length} now`}
      action={
        <a href={href('attendance')} className="text-sm">
          Attendance
        </a>
      }
      flush
    >
      {data.on_the_clock.length === 0 ? (
        <Empty>Nobody is clocked in right now.</Empty>
      ) : (
        <ul>
          {data.on_the_clock.map((e) => (
            <li key={e.user_id} className="flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-b-0">
              <LiveDot />
              <div className="min-w-0 flex-1">
                <a href={href('people', e.user_id)} className="font-medium">
                  {e.name ?? `User ${e.user_id}`}
                </a>
                <p className="truncate text-xs text-ink-faint">
                  {deptName.get(e.department_id) ?? 'No department'}, since {formatTime(e.clock_in)}
                </p>
              </div>
              <span className="text-[15px] font-semibold">{formatMinutes(minutesSince(e.clock_in, now))}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-line bg-subtle px-5 py-3 text-sm text-ink-soft">
        <strong className="font-semibold text-ink">{formatHours(data.people.hours_today)}</strong> clocked today across the
        team
      </p>
    </Panel>
  )
}

// ---- Projects, with progress by department -----------------------------------------------

type DeptBucket = ProjectProgress['by_department'][number]

function ProjectsPanel({
  projects,
  departments,
  now,
}: {
  projects: ProjectProgress[]
  departments: DepartmentSummary[]
  now: number
}) {
  const hasUnassigned = projects.some((p) => p.by_department.some((b) => b.unassigned))
  const columns: { key: string; name: string; slot: number; match: (b: DeptBucket) => boolean }[] = [
    ...departments.map((d) => ({
      key: String(d.id),
      name: d.name,
      slot: d.slot,
      match: (b: DeptBucket) => !b.unassigned && b.department_id === d.id,
    })),
    ...(hasUnassigned ? [{ key: 'unassigned', name: 'Unassigned', slot: 0, match: (b: DeptBucket) => b.unassigned }] : []),
  ]
  const active = projects.filter((p) => p.status === 'active').length

  return (
    <Panel
      id="projects-title"
      title="Projects"
      meta={`${plural(projects.length, 'project')}, ${active} active. Each department column shows its tasks done of tasks assigned.`}
      action={
        <a href={href('projects')} className="text-sm">
          All projects
        </a>
      }
      flush
    >
      {projects.length === 0 ? (
        <Empty>No projects yet.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table min-w-[900px]">
            <thead>
              <tr>
                <th scope="col" className="min-w-48">
                  Project
                </th>
                <th scope="col">Status</th>
                <th scope="col" className="w-52">
                  Progress
                </th>
                {columns.map((c) => (
                  <th scope="col" key={c.key} className="w-28">
                    <span className="inline-flex items-center gap-1.5">
                      <Swatch slot={c.slot} />
                      {c.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <th scope="row">
                    <a href={href('tasks', 'project', p.id)}>{p.name}</a>
                    <span className="mt-0.5 block text-xs font-normal text-ink-faint">
                      {p.status === 'completed' ? 'Completed' : formatDue(p.deadline, now)}
                      {p.tasks_overdue > 0 && <span className="text-danger">, {plural(p.tasks_overdue, 'task')} overdue</span>}
                    </span>
                  </th>
                  <td className="whitespace-nowrap">
                    <ProjectStatusPill status={p.status} />
                    {p.overdue && <OverdueTag />}
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div
                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle"
                        role="img"
                        aria-label={`${p.progress_pct}% done`}
                      >
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${p.progress_pct}%` }} />
                      </div>
                      <span className="w-10 text-right font-semibold">{p.progress_pct}%</span>
                    </div>
                    <span className="text-xs text-ink-faint">
                      {p.tasks_done} of {plural(p.task_count, 'task')} done
                    </span>
                  </td>
                  {columns.map((c) => {
                    const b = p.by_department.find(c.match)
                    return (
                      <td key={c.key}>
                        {b ? (
                          <div className="grid gap-1" aria-label={`${c.name}: ${b.done} of ${b.total} done`}>
                            <span aria-hidden="true">
                              <strong className="font-semibold">{b.done}</strong>
                              <span className="text-ink-faint"> / {b.total}</span>
                            </span>
                            <div className="h-1 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
                              <span
                                className={`block h-full rounded-full ${departmentFill(c.slot)}`}
                                style={{ width: `${(100 * b.done) / b.total}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

// ---- Departments -------------------------------------------------------------------------

function DepartmentsPanel({ departments }: { departments: DepartmentSummary[] }) {
  return (
    <Panel id="departments-title" title="Departments" meta="Hours and time on tasks cover the last 7 days." flush>
      {departments.length === 0 ? (
        <Empty>No departments yet. Add departments to compare teams here.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table min-w-[880px]">
            <thead>
              <tr>
                <th scope="col">Department</th>
                <th scope="col" className="num">
                  People
                </th>
                <th scope="col" className="num">
                  Working now
                </th>
                <th scope="col" className="num">
                  Open tasks
                </th>
                <th scope="col" className="num">
                  Overdue
                </th>
                <th scope="col" className="num">
                  Done
                </th>
                <th scope="col" className="num">
                  Hours
                </th>
                <th scope="col" className="w-44">
                  Time on tasks
                </th>
                <th scope="col" className="num">
                  Rating
                </th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id ?? 'none'}>
                  <th scope="row">
                    <span className="inline-flex items-center gap-2">
                      <Swatch slot={d.slot} />
                      {d.name}
                    </span>
                  </th>
                  <td className="num">{d.members}</td>
                  <td className="num">
                    {d.active_now > 0 ? (
                      <span className="font-medium text-success">{d.active_now}</span>
                    ) : (
                      <span className="text-ink-faint">0</span>
                    )}
                  </td>
                  <td className="num">{d.open_tasks}</td>
                  <td className={`num ${d.overdue_tasks ? 'font-semibold text-danger' : ''}`}>{d.overdue_tasks}</td>
                  <td className="num">{d.completed_tasks}</td>
                  <td className="num">{formatHours(d.hours_week)}</td>
                  <td>
                    {d.utilization_pct === null ? (
                      <span className="text-ink-faint">No hours yet</span>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${d.utilization_pct}%` }} />
                        </div>
                        <span className="w-10 text-right">{d.utilization_pct}%</span>
                      </div>
                    )}
                  </td>
                  <td className="num">
                    {d.avg_rating === null ? <span className="text-ink-faint">—</span> : d.avg_rating.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

// ---- Team hours, last 14 days (stacked by department) ------------------------------------

function niceStep(max: number) {
  for (const step of [5, 10, 20, 25, 50, 100, 200]) if (max / step <= 4) return step
  return 500
}

const CHART_HEIGHT = 220

function HoursTrend({ data }: { data: DashboardSummary }) {
  const [hover, setHover] = useState<number | null>(null)
  const { days, series } = data.hours_trend
  const depts = new Map(data.departments.map((d) => [d.id, d]))
  const rows = series.filter((s) => depts.has(s.department_id))
  const totals = days.map((_, i) => rows.reduce((sum, s) => sum + s.values[i], 0))
  const peak = Math.max(1, ...totals)
  const step = niceStep(peak)
  const max = Math.ceil(peak / step) * step
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step)
  const grandTotal = totals.reduce((a, b) => a + b, 0)

  return (
    <Panel id="hours-title" title="Team hours" meta={`Last 14 days, ${formatHours(grandTotal)} in total`}>
      {grandTotal === 0 ? (
        <p className="py-8 text-center text-sm text-ink-soft">No hours clocked in the last 14 days.</p>
      ) : (
        <>
          <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm" aria-label="Hours by department">
            {rows.map((s) => {
              const d = depts.get(s.department_id)!
              return (
                <li key={String(s.department_id)} className="flex items-center gap-2">
                  <Swatch slot={d.slot} />
                  <span className="text-ink-soft">{d.name}</span>
                  <strong className="font-semibold">{formatHours(s.values.reduce((a, b) => a + b, 0))}</strong>
                </li>
              )
            })}
          </ul>

          <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-2">
            <div className="relative" style={{ height: CHART_HEIGHT }} aria-hidden="true">
              {ticks.map((t) => (
                <span
                  key={t}
                  className="absolute right-0 translate-y-1/2 text-xs text-ink-faint"
                  style={{ bottom: `${(t / max) * 100}%` }}
                >
                  {t}h
                </span>
              ))}
            </div>
            <div className="relative" style={{ height: CHART_HEIGHT }}>
              {ticks.map((t) => (
                <div
                  key={t}
                  className={`absolute inset-x-0 border-t ${t === 0 ? 'border-line-strong' : 'border-line'}`}
                  style={{ bottom: `${(t / max) * 100}%` }}
                  aria-hidden="true"
                />
              ))}
              <ol className="relative flex h-full items-end gap-[3px] sm:gap-1.5" aria-label="Hours clocked per day">
                {days.map((day, i) => {
                  const segments = rows.map((s) => ({ s, v: s.values[i] })).filter((x) => x.v > 0)
                  return (
                    <li
                      key={day}
                      tabIndex={0}
                      aria-label={`${formatDay(day)}: ${formatHours(totals[i])}`}
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(i)}
                      onBlur={() => setHover(null)}
                      className={`flex h-full min-w-0 flex-1 flex-col-reverse gap-[2px] rounded-t-sm ${hover === i ? 'bg-subtle' : ''}`}
                    >
                      {segments.map(({ s, v }, k) => (
                        <span
                          key={String(s.department_id)}
                          className={`block w-full shrink-0 ${departmentFill(depts.get(s.department_id)!.slot)} ${k === segments.length - 1 ? 'rounded-t-sm' : ''}`}
                          style={{ height: `${Math.max(1, (v / max) * CHART_HEIGHT - 2)}px` }}
                        />
                      ))}
                    </li>
                  )
                })}
              </ol>
              {hover !== null && (
                <div
                  className={`pointer-events-none absolute top-1 z-10 w-52 rounded-md border border-line bg-surface p-3 text-sm shadow-overlay ${hover >= days.length / 2 ? 'left-1' : 'right-1'}`}
                >
                  <p className="mb-1.5 font-semibold">{formatDay(days[hover], 'long')}</p>
                  {rows.map((s) => {
                    const d = depts.get(s.department_id)!
                    return (
                      <p key={String(s.department_id)} className="flex items-center gap-2">
                        <Swatch slot={d.slot} />
                        <span className="flex-1 text-ink-soft">{d.name}</span>
                        <span>{formatHours(s.values[hover])}</span>
                      </p>
                    )
                  })}
                  <p className="mt-1.5 flex justify-between border-t border-line pt-1.5 font-semibold">
                    <span>Total</span>
                    <span>{formatHours(totals[hover])}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
          <p className="mt-2 ml-[44px] flex justify-between text-xs text-ink-faint" aria-hidden="true">
            <span>{formatDay(days[0])}</span>
            <span>{formatDay(days[Math.floor(days.length / 2)])}</span>
            <span>{formatDay(days[days.length - 1])}</span>
          </p>
        </>
      )}
    </Panel>
  )
}

// ---- Recent activity ---------------------------------------------------------------------

function Activity({ activity, now }: { activity: DashboardSummary['activity']; now: number }) {
  return (
    <Panel id="activity-title" title="Recent activity" flush>
      {activity.length === 0 ? (
        <Empty>Status changes will appear here as people work.</Empty>
      ) : (
        <ul>
          {activity.map((a) => (
            <li key={a.id} className="flex gap-3 border-b border-line px-5 py-3 last:border-b-0">
              <span
                className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-tint text-xs font-semibold text-primary"
                aria-hidden="true"
              >
                {(a.actor?.name ?? '?').slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p>
                  <strong className="font-medium">{a.actor?.name ?? 'Someone'}</strong>{' '}
                  {a.old_status === null ? 'added' : 'moved'}{' '}
                  <span className="font-medium">{a.task?.name ?? 'a deleted task'}</span>
                  {a.old_status !== null && (
                    <>
                      {' '}
                      to <TaskStatusPill status={a.new_status} />
                    </>
                  )}
                </p>
                <p className="text-xs text-ink-faint">
                  {formatAgo(a.changed_at, now)}
                  {a.old_status !== null && `, from ${taskStatusLabel[a.old_status]}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
