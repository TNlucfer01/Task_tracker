import { useState } from 'react'
import { Button, DataState, LiveDot, Muted, PageHeader, Section, SectionHead, Select, Tally } from '../../components/ui'
import {
  dayInIndia,
  formatDay,
  formatHours,
  formatMinutes,
  formatPct,
  formatRating,
  formatTime,
  lastDays,
  minutesSince,
  plural,
  taskStatusLabel,
  taskStatuses,
} from '../../lib/format'
import { href } from '../../lib/router'
import { taskStatusDot } from '../../lib/status'
import { useApi, useNow } from '../../lib/useApi'
import { getAttendance, getOverview, getRanking, type RankMetric, type RankedUser } from '../../api/admin/dashboard'

const metrics: { key: RankMetric; label: string; show: (u: RankedUser) => string }[] = [
  { key: 'tasks_done', label: 'Tasks done', show: (u) => plural(u.tasks_done, 'task') },
  { key: 'on_time_pct', label: 'On time', show: (u) => formatPct(u.on_time_pct) },
  { key: 'avg_rating', label: 'Average rating', show: (u) => formatRating(u.avg_rating) },
  { key: 'hours_clocked', label: 'Hours clocked', show: (u) => formatHours(u.hours_clocked) },
  { key: 'rework_bounces', label: 'Fewest reworks', show: (u) => plural(u.rework_bounces, 'rework') },
]

export function Overview() {
  const today = dayInIndia()
  const overview = useApi(getOverview, 'overview')
  const clock = useApi(() => getAttendance({ from: today, to: today }), `clock-${today}`)

  return (
    <>
      <PageHeader title="Today" lede={formatDay(today, 'long')} />

      <section aria-labelledby="clock-title" className="mb-10 rounded-lg bg-stamp-deep p-6 text-white sm:p-8">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id="clock-title" className="text-xl font-semibold text-white">
            On the clock
          </h2>
          <Button variant="onDark" onClick={clock.reload}>
            Refresh
          </Button>
        </div>
        {clock.error ? (
          <p role="alert" className="text-white/90">
            {clock.error}
          </p>
        ) : !clock.data ? (
          <p className="text-white/70" role="status">
            Loading…
          </p>
        ) : (
          <ClockList entries={clock.data.clocked_in_now} />
        )}
      </section>

      <DataState state={overview}>
        {(data) => (
          <>
            <Tally
              items={[
                { label: 'Hours clocked today', value: formatHours(data.attendance.hours_today) },
                {
                  label: 'Overdue tasks',
                  value: data.tasks.overdue ? (
                    <a href={href('tasks', 'overdue')} className="text-over hover:text-over">
                      {data.tasks.overdue}
                    </a>
                  ) : (
                    0
                  ),
                  alert: data.tasks.overdue > 0,
                },
                { label: 'Active people', value: data.users.active - data.users.admins },
                { label: 'Active projects', value: data.projects.by_status.active },
              ]}
            />

            <Section labelledBy="pipeline-title">
              <SectionHead id="pipeline-title" title="Task pipeline">
                <p className="text-sm text-ink-soft">{plural(data.tasks.total, 'task')} across all projects</p>
              </SectionHead>
              {data.tasks.total === 0 ? (
                <Muted>No tasks yet. Tasks you assign will show up here by status.</Muted>
              ) : (
                <>
                  <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-sm" role="img" aria-label="Tasks by status">
                    {taskStatuses.map((s) =>
                      data.tasks.by_status[s] ? (
                        <span
                          key={s}
                          className={taskStatusDot[s]}
                          style={{ flexGrow: data.tasks.by_status[s] }}
                          title={`${taskStatusLabel[s]}: ${data.tasks.by_status[s]}`}
                        />
                      ) : null,
                    )}
                  </div>
                  <ul className="mt-3.5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
                    {taskStatuses.map((s) => (
                      <li key={s} className="flex items-center gap-2">
                        <i className={`size-2.5 rounded-sm ${taskStatusDot[s]}`} aria-hidden="true" />
                        {taskStatusLabel[s]}
                        <strong className="font-semibold text-ink">{data.tasks.by_status[s]}</strong>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Section>
          </>
        )}
      </DataState>

      <Ranking />
    </>
  )
}

function ClockList({ entries }: { entries: { user_id: number; name: string | null; clock_in: string }[] }) {
  const now = useNow(15_000)

  if (entries.length === 0) {
    return <p className="text-white/75">Nobody is clocked in right now.</p>
  }

  return (
    <ul className="flex flex-col sm:flex-row sm:flex-wrap">
      {entries.map((e) => (
        <li
          key={e.user_id}
          className="border-t border-white/15 first:border-t-0 sm:min-w-[230px] sm:flex-none sm:border-t-0 sm:border-l sm:first:border-l-0"
        >
          <a
            href={href('people', e.user_id)}
            className="grid gap-0.5 rounded-md px-4 py-3.5 text-white no-underline hover:bg-white/5 hover:text-white sm:pr-10"
          >
            <span className="flex items-center gap-2 font-medium">
              <LiveDot light />
              {e.name ?? `User ${e.user_id}`}
            </span>
            <span className="font-display text-[40px] leading-none font-semibold tracking-tight">
              {formatMinutes(minutesSince(e.clock_in, now))}
            </span>
            <span className="text-sm text-white/70">since {formatTime(e.clock_in)}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

function Ranking() {
  const [by, setBy] = useState<RankMetric>('tasks_done')
  const range = lastDays(30)
  const ranking = useApi(() => getRanking(by, range), `rank-${by}-${range.from}`)
  const metric = metrics.find((m) => m.key === by)!

  return (
    <Section labelledBy="rank-title">
      <SectionHead id="rank-title" title="Ranking, last 30 days">
        <Select label="Rank by" value={by} onChange={(v) => setBy(v as RankMetric)}>
          {metrics.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </Select>
      </SectionHead>
      <DataState state={ranking} isEmpty={(d) => d.users.length === 0} empty="No active people to rank yet.">
        {(data) => (
          <ol className="max-w-2xl">
            {data.users.map((u) => (
              <li key={u.id} className="flex items-baseline gap-4 border-b border-line py-3">
                <span className="w-6 font-display text-xl font-semibold text-ink-faint">{u.rank ?? '–'}</span>
                <a href={href('people', u.id)} className="font-medium">
                  {u.name}
                </a>
                <span className={`ml-auto ${u.rank === null ? 'text-ink-faint' : 'font-medium'}`}>
                  {u.rank === null ? 'No data yet' : metric.show(u)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </DataState>
    </Section>
  )
}
