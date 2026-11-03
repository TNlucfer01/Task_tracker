// The dashboard: headline numbers, what needs attention, projects split by department, department
// health, hours trend and recent activity — all limited to the viewer's scope.
import { dashboard as dashboardApi } from '../api/endpoints'
import type { AttentionTask, Summary } from '../api/types'
import { departmentColor, LineChart } from '../components/charts'
import { Button, DataState, Dot, Empty, KpiStrip, OverdueTag, Panel, ProgressBar, ProjectStatusBadge, Stars, TableWrap } from '../components/ui'
import { apiHref } from '../api/client'
import { reports } from '../api/endpoints'
import { formatDate, formatHours, lastDays, relative, since, taskStatusLabel } from '../lib/format'
import { href } from '../lib/router'
import { can, useMe } from '../lib/session'
import { useApi, useNow } from '../lib/useApi'

/** A short list of tasks needing attention. */
function AttentionList({ title, list, empty, more }: { title: string; list: { count: number; tasks: AttentionTask[] }; empty: string; more: string }) {
  return (
    <Panel title={`${title} · ${list.count}`} actions={list.count > list.tasks.length && <a href={more} className="text-[13px]">See all</a>}>
      {list.tasks.length === 0 ? (
        <p className="text-ink-soft">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.tasks.map((t) => (
            <li key={t.id} className="py-2.5">
              <a href={href('tasks', t.id)} className="block truncate font-medium">
                {t.title}
              </a>
              <span className="flex flex-wrap items-center gap-x-2 text-[13px] text-ink-faint">
                {t.key} · {t.assignee?.name ?? 'Unassigned'} · {formatDate(t.deadline)}
                {t.overdue && <OverdueTag />}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/** Describes an activity event. */
function activityText(a: Summary['activity'][number]) {
  const d = a.data as Record<string, string>
  if (a.type === 'created') return 'created'
  if (a.type === 'status') return `moved to ${taskStatusLabel[d.to as keyof typeof taskStatusLabel] ?? d.to}`
  if (a.type === 'review') return d.decision === 'approved' ? 'approved' : 'requested changes on'
  return 'commented on'
}

/** The dashboard page. */
export function Dashboard() {
  const me = useMe()
  const now = useNow(60_000)
  const state = useApi(() => dashboardApi.summary(), 'dashboard')
  return (
    <DataState state={state}>
      {(s) => {
        const depts = s.departments
        const deptName = (id: number | null) => depts.find((d) => d.id === id)?.name ?? 'No department'
        return (
          <>
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.01em]">Dashboard</h1>
                <p className="mt-1 text-ink-soft">{s.department ? `${s.department.name} department` : 'Whole company'} · {formatDate(s.date)}</p>
              </div>
              <div className="flex gap-2">
                {can(me, 'reports.export') && (
                  <a href={apiHref(reports.people(lastDays(30)))}>
                    <Button icon="download">People report</Button>
                  </a>
                )}
                <Button onClick={state.reload}>Refresh</Button>
              </div>
            </header>

            <div className="grid gap-6">
              <KpiStrip
                items={[
                  { label: 'People active', value: s.people.active, hint: `${s.people.clocked_in_now} clocked in now` },
                  { label: 'Hours today', value: formatHours(s.people.hours_today) },
                  { label: 'Not started', value: s.tasks.not_started, href: href('tasks', { status: 'todo' }) },
                  { label: 'Pending', value: s.tasks.pending, hint: `${s.tasks.in_review} in review · ${s.tasks.rework} rework`, href: href('tasks', { status: 'in_progress,in_review,rework' }) },
                  { label: 'Done this week', value: s.tasks.completed_this_week, tone: 'success', hint: `${s.tasks.completed} in total` },
                  { label: 'Overdue', value: s.tasks.overdue, tone: s.tasks.overdue ? 'danger' : undefined, href: href('tasks', { overdue: 'true' }) },
                ]}
              />

              <div className="grid gap-6 lg:grid-cols-3">
                <AttentionList title="Waiting for review" list={s.attention.waiting_review} empty="Nothing is waiting for review." more={href('tasks', { status: 'in_review' })} />
                <AttentionList title="Overdue" list={s.attention.overdue} empty="No tasks are overdue." more={href('tasks', { overdue: 'true' })} />
                <AttentionList title="Due in 7 days" list={s.attention.due_soon} empty="Nothing is due in the next week." more={href('tasks', { status: 'todo,in_progress,in_review,rework' })} />
              </div>

              <Panel title="Hours clocked, last 14 days">
                <LineChart days={s.hours_trend.days} series={s.hours_trend.series.map((x) => ({ name: deptName(x.department_id), color: departmentColor(depts, x.department_id), values: x.values }))} />
              </Panel>

              <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <Panel title="Projects" actions={<a href={href('projects')} className="text-[13px]">All projects</a>} padded={false}>
                  {s.projects.length === 0 ? (
                    <div className="p-5">
                      <Empty>No projects yet.</Empty>
                    </div>
                  ) : (
                    <ul className="divide-y divide-line">
                      {s.projects.slice(0, 8).map((p) => (
                        <li key={p.id} className="grid gap-2 px-5 py-3.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <a href={href('projects', p.id)} className="font-medium">
                              {p.name}
                            </a>
                            <span className="flex items-center gap-3 text-[13px] text-ink-soft">
                              <ProjectStatusBadge status={p.status} />
                              {p.progress_pct}% · {p.tasks_done}/{p.task_count}
                              {p.tasks_overdue > 0 && <span className="font-medium text-danger">{p.tasks_overdue} overdue</span>}
                            </span>
                          </div>
                          <ProgressBar
                            value={p.progress_pct}
                            label={`${p.name} progress by department`}
                            segments={p.by_department.map((b) => ({ value: p.task_count ? (100 * b.done) / p.task_count : 0, color: departmentColor(depts, b.department_id), label: `${deptName(b.department_id)}: ${b.done} of ${b.total} done` }))}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                <Panel title={`On the clock · ${s.on_the_clock.length}`}>
                  {s.on_the_clock.length === 0 ? (
                    <p className="text-ink-soft">Nobody is clocked in right now.</p>
                  ) : (
                    <ul className="divide-y divide-line">
                      {s.on_the_clock.map((c) => (
                        <li key={c.user_id} className="flex items-center justify-between gap-3 py-2">
                          <span className="min-w-0">
                            <Dot live color="var(--success)" label={can(me, 'people.view') ? <a href={href('people', c.user_id)}>{c.name}</a> : c.name} />
                            <span className="block pl-3.5 text-[12px] text-ink-faint">{c.working_on ? `Working on ${c.working_on}` : 'No timer running'}</span>
                          </span>
                          <span className="text-[13px] text-ink-soft tabular-nums">{since(c.clock_in, now)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>

              <Panel title="Departments" padded={false}>
                <div className="hidden sm:block">
                  <TableWrap>
                    <table className="data-table min-w-[820px]">
                      <thead>
                        <tr>
                          <th scope="col">Department</th><th scope="col" className="num">People</th><th scope="col" className="num">Clocked in</th>
                          <th scope="col" className="num">Open</th><th scope="col" className="num">Overdue</th><th scope="col" className="num">Done</th>
                          <th scope="col" className="num">Hours (7 days)</th><th scope="col" className="num">On tasks</th><th scope="col">Avg rating</th>
                        </tr>
                      </thead>
                      <tbody>
                        {depts.map((d) => (
                          <tr key={d.id}>
                            <th scope="row"><Dot color={departmentColor(depts, d.id)} label={<span className="text-sm font-medium">{d.name}</span>} /></th>
                            <td className="num">{d.members}</td><td className="num">{d.active_now}</td>
                            <td className="num"><a href={href('tasks', { department_id: d.id, status: 'todo,in_progress,in_review,rework' })}>{d.open_tasks}</a></td>
                            <td className={d.overdue_tasks ? 'num font-medium text-danger' : 'num'}>{d.overdue_tasks}</td>
                            <td className="num">{d.completed_tasks}</td><td className="num">{formatHours(d.hours_week)}</td>
                            <td className="num">{d.utilization_pct === null ? '—' : `${d.utilization_pct}%`}</td><td><Stars value={d.avg_rating} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableWrap>
                </div>
                <ul className="mobile-records p-3 sm:hidden">
                  {depts.map((d) => (
                    <li key={d.id} className="mobile-record">
                      <div className="flex items-center justify-between gap-3">
                        <Dot color={departmentColor(depts, d.id)} label={<span className="font-semibold">{d.name}</span>} />
                        <Stars value={d.avg_rating} />
                      </div>
                      <div className="mobile-record-grid">
                        <div><span className="mobile-record-label">People · clocked in</span><span className="mobile-record-value">{d.members} · {d.active_now}</span></div>
                        <div><span className="mobile-record-label">Open · overdue</span><span className="mobile-record-value"><a href={href('tasks', { department_id: d.id, status: 'todo,in_progress,in_review,rework' })}>{d.open_tasks}</a> · <span className={d.overdue_tasks ? 'font-medium text-danger' : ''}>{d.overdue_tasks}</span></span></div>
                        <div><span className="mobile-record-label">Done · hours this week</span><span className="mobile-record-value">{d.completed_tasks} · {formatHours(d.hours_week)}</span></div>
                        <div><span className="mobile-record-label">On tasks</span><span className="mobile-record-value">{d.utilization_pct === null ? '—' : `${d.utilization_pct}%`}</span></div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="Recent activity">
                {s.activity.length === 0 ? (
                  <p className="text-ink-soft">No activity yet.</p>
                ) : (
                  <ul className="grid gap-2.5">
                    {s.activity.map((a) => (
                      <li key={a.id} className="text-sm">
                        <span className="font-medium">{a.actor?.name ?? 'Someone'}</span> {activityText(a)} <a href={href('tasks', a.task_id)}>{a.task_key} {a.task_title}</a>
                        <span className="ml-2 text-[12px] text-ink-faint">{relative(a.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </>
        )
      }}
    </DataState>
  )
}
