// One person's work: headline numbers, open and finished tasks, daily hours, reviews and activity.
import { useState } from 'react'
import { people as peopleApi } from '../api/endpoints'
import { HoursStrip } from '../components/charts'
import { Avatar, DataState, Dot, KpiStrip, OverdueTag, Panel, PriorityTag, Segmented, Stars, StatusBadge, TableWrap } from '../components/ui'
import { formatDate, formatHours, formatMinutes, lastDays, relative, since } from '../lib/format'
import { href } from '../lib/router'
import { useApi, useNow } from '../lib/useApi'

/** The person page. */
export function Person({ id }: { id: number }) {
  const [days, setDays] = useState<'14' | '30' | '90'>('30')
  const range = lastDays(Number(days))
  const state = useApi(() => peopleApi.get(id, range), `person-${id}-${days}`)
  const now = useNow(60_000)
  const [show, setShow] = useState<'open' | 'done'>('open')

  return (
    <DataState state={state}>
      {(d) => {
        const p = d.person
        const byDay = new Map(d.daily_hours.map((h) => [h.day, h.hours_clocked]))
        const calendar = Array.from({ length: Number(days) }, (_, i) => {
          const day = lastDays(Number(days) - i).from
          return { day, hours: byDay.get(day) ?? 0 }
        })
        const tasks = d.tasks.filter((t) => (show === 'open' ? t.status !== 'done' : t.status === 'done'))
        return (
          <>
            <a href={href('people')} className="mb-2 inline-block text-[13px] text-ink-soft hover:text-ink">
              People
            </a>
            <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar name={p.name} size={52} />
                <div>
                  <h1 className="text-[26px] leading-8 font-semibold">{p.name}</h1>
                  <p className="text-ink-soft">
                    {[p.title, p.role.name, p.department?.name].filter(Boolean).join(' · ')}
                    {!p.is_active && ' · Inactive'}
                  </p>
                  <p className="mt-1 text-[13px]">{p.clocked_in_since ? <Dot live color="var(--success)" label={`Clocked in for ${since(p.clocked_in_since, now)}`} /> : <span className="text-ink-faint">Not clocked in</span>}</p>
                </div>
              </div>
              <Segmented label="Period" value={days} onChange={setDays} options={[{ value: '14', label: '14 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} />
            </header>

            <div className="grid gap-6">
              <KpiStrip
                items={[
                  { label: 'Tasks done', value: p.tasks_done },
                  { label: 'On time', value: p.on_time_pct === null ? '—' : `${Math.round(p.on_time_pct)}%` },
                  { label: 'Average rating', value: p.avg_rating === null ? '—' : Number(p.avg_rating).toFixed(1), hint: `${p.changes_requested} sent back` },
                  { label: 'Open', value: p.open_tasks, hint: `${p.in_review} in review` },
                  { label: 'Overdue', value: p.overdue_tasks, tone: p.overdue_tasks ? 'danger' : undefined },
                  { label: `Hours (${days} days)`, value: formatHours(p.hours_clocked), hint: `${formatHours(p.task_hours)} on tasks` },
                ]}
              />

              <Panel title="Hours per day">
                <HoursStrip days={calendar} />
                <p className="mt-2 text-[12px] text-ink-faint">Darker means a fuller day. Hover a square for the exact hours.</p>
              </Panel>

              <Panel title="Tasks" actions={<Segmented label="Tasks shown" value={show} onChange={setShow} options={[{ value: 'open', label: 'Open' }, { value: 'done', label: 'Done' }]} />} padded={false}>
                {tasks.length === 0 ? (
                  <p className="p-5 text-ink-soft">{show === 'open' ? 'No open tasks.' : 'No finished tasks yet.'}</p>
                ) : (
                  <TableWrap>
                    <table className="data-table min-w-[760px]">
                      <thead>
                        <tr>
                          <th scope="col">Task</th>
                          <th scope="col">Status</th>
                          <th scope="col">Priority</th>
                          <th scope="col">{show === 'open' ? 'Deadline' : 'Finished'}</th>
                          <th scope="col" className="num">Time / estimate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.map((t) => (
                          <tr key={t.id}>
                            <th scope="row" className="font-normal">
                              <a href={href('tasks', t.id)} className="font-medium">
                                {t.title}
                              </a>
                              <span className="block text-[12px] text-ink-faint">
                                {t.key} · {t.project.name}
                              </span>
                            </th>
                            <td>
                              <StatusBadge status={t.status} />
                            </td>
                            <td>
                              <PriorityTag priority={t.priority} />
                            </td>
                            <td className="whitespace-nowrap">
                              {show === 'open' ? formatDate(t.deadline) : formatDate(t.completed_at)}
                              {t.overdue && <OverdueTag />}
                            </td>
                            <td className="num">
                              {formatMinutes(t.actual_minutes)} / {formatMinutes(t.estimate_minutes)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableWrap>
                )}
              </Panel>

              <div className="grid items-start gap-6 lg:grid-cols-2">
                <Panel title="Reviews received">
                  {d.reviews.length === 0 ? (
                    <p className="text-ink-soft">No reviews yet.</p>
                  ) : (
                    <ul className="divide-y divide-line">
                      {d.reviews.map((r) => (
                        <li key={r.id} className="py-2.5">
                          <p className="flex flex-wrap items-center gap-x-2 text-[13px]">
                            <span className={r.decision === 'approved' ? 'font-medium text-success' : 'font-medium text-warning'}>{r.decision === 'approved' ? 'Approved' : 'Changes requested'}</span>
                            {r.rating && <Stars value={r.rating} />}
                            <a href={href('tasks', r.task_id)}>{r.task_key}</a>
                            <span className="text-ink-faint">· {r.reviewer?.name} · {relative(r.created_at)}</span>
                          </p>
                          {r.comment && <p className="mt-1 text-ink-soft">{r.comment}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
                <Panel title="Recent activity">
                  {d.activity.length === 0 ? (
                    <p className="text-ink-soft">No activity yet.</p>
                  ) : (
                    <ul className="grid gap-2">
                      {d.activity.map((a) => (
                        <li key={a.id} className="text-sm">
                          {a.type === 'status' ? `Moved ${a.task_key} to ${String((a.data as Record<string, string>).to).replace('_', ' ')}` : `${a.type[0]!.toUpperCase()}${a.type.slice(1)} on ${a.task_key}`}{' '}
                          <a href={href('tasks', a.task_id)} className="text-ink-soft">
                            {a.task_title}
                          </a>
                          <span className="ml-2 text-[12px] text-ink-faint">{relative(a.created_at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>
            </div>
          </>
        )
      }}
    </DataState>
  )
}
