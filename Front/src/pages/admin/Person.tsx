import { useState, type ReactNode } from 'react'
import { UserDialog } from '../../components/UserDialog'
import {
  Button,
  DataState,
  LiveDot,
  Meter,
  Muted,
  OverdueTag,
  PageHeader,
  RangePicker,
  Section,
  SectionHead,
  Sub,
  SuccessNotice,
  TableWrap,
  Tally,
  TaskStatusPill,
} from '../../components/ui'
import {
  daysBetween,
  formatDate,
  formatDateTime,
  formatDay,
  formatHours,
  formatMinutes,
  formatPct,
  formatRating,
  formatTime,
  lastDays,
} from '../../lib/format'
import { setFlash } from '../../lib/flash'
import { href } from '../../lib/router'
import { useApi } from '../../lib/useApi'
import { getPerson, type DashboardTask, type DayRange, type PersonDetail } from '../../api/admin/dashboard'

export function Person({ id, myId }: { id: number; myId: number }) {
  const [range, setRange] = useState<DayRange>(() => lastDays(30))
  const person = useApi(() => getPerson(id, range), `person-${id}-${range.from}-${range.to}`)
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <>
      <a href={href('people')} className="mb-4 inline-block text-sm">
        Back to people
      </a>
      {notice && <SuccessNotice message={notice} onDismiss={() => setNotice(null)} />}
      <DataState state={person}>
        {(data) => (
          <>
            <PersonView data={data} range={range} onRange={setRange} onEdit={() => setEditing(true)} />
            {editing && (
              <UserDialog
                user={data.user}
                isSelf={data.user.id === myId}
                onClose={() => setEditing(false)}
                onSaved={(_, message) => {
                  setEditing(false)
                  setNotice(message)
                  person.reload()
                }}
                onDeleted={(name) => {
                  setFlash(`${name} was deleted.`)
                  window.location.hash = href('people')
                }}
              />
            )}
          </>
        )}
      </DataState>
    </>
  )
}

function PersonView({
  data,
  range,
  onRange,
  onEdit,
}: {
  data: PersonDetail
  range: DayRange
  onRange: (r: DayRange) => void
  onEdit: () => void
}) {
  const { user } = data

  return (
    <>
      <PageHeader
        title={user.name}
        actions={<Button onClick={onEdit}>Edit details</Button>}
        lede={
          <>
            {user.role === 'admin' ? 'Admin, ' : ''}
            {user.department?.name ?? 'No department'}, {user.email}
            <span
              className={`ml-3 inline-flex items-center gap-2 font-medium ${user.clocked_in ? 'text-status-done' : 'text-ink-soft'}`}
            >
              {user.clocked_in && <LiveDot />}
              {!user.is_active
                ? 'Deactivated'
                : user.clocked_in && user.clocked_in_since
                  ? `Clocked in since ${formatTime(user.clocked_in_since)}`
                  : 'Off the clock'}
            </span>
          </>
        }
      />

      <Tally
        items={[
          { label: 'Hours in range', value: formatHours(user.hours_clocked) },
          { label: 'Tasks done', value: user.tasks_done },
          { label: 'Open', value: user.open_tasks },
          { label: 'Overdue', value: user.overdue_tasks, alert: user.overdue_tasks > 0 },
          { label: 'On time', value: formatPct(user.on_time_pct) },
          { label: 'Avg rating', value: formatRating(user.avg_rating) },
          { label: 'Sent to rework', value: user.rework_bounces },
        ]}
      />

      <Section labelledBy="hours-title">
        <SectionHead id="hours-title" title="Hours per day">
          <RangePicker value={range} onChange={onRange} />
        </SectionHead>
        <HoursChart range={range} days={data.daily_hours} />
      </Section>

      <Section labelledBy="tasks-title">
        <SectionHead id="tasks-title" title="Assigned tasks">
          <p className="text-sm text-ink-soft">Time spent compares task timers with the estimate.</p>
        </SectionHead>
        {data.tasks.length === 0 ? (
          <Muted>No tasks assigned to {user.name} yet.</Muted>
        ) : (
          <TableWrap>
            <table className="data-table min-w-[640px]">
              <thead>
                <tr>
                  <th scope="col">Task</th>
                  <th scope="col">Status</th>
                  <th scope="col">Deadline</th>
                  <th scope="col" className="w-56">Time spent</th>
                </tr>
              </thead>
              <tbody>
                {data.tasks.map((t) => (
                  <tr key={t.id}>
                    <th scope="row">
                      {t.name}
                      <Sub>{t.project?.name ?? 'No project'}</Sub>
                    </th>
                    <td>
                      <TaskStatusPill status={t.status} />
                    </td>
                    <td className="whitespace-nowrap">
                      {formatDate(t.deadline)}
                      {t.overdue && <OverdueTag />}
                    </td>
                    <td>
                      <Estimate task={t} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>

      <div className="grid gap-x-12 lg:grid-cols-2">
        <Section labelledBy="sessions-title">
          <SectionHead id="sessions-title" title="Recent work sessions" />
          {data.recent_sessions.length === 0 ? (
            <Muted>No clock-ins yet.</Muted>
          ) : (
            <Log
              rows={data.recent_sessions.map((s) => ({
                id: s.id,
                label: `${formatDateTime(s.clock_in)} to ${s.clock_out ? formatTime(s.clock_out) : 'now'}`,
                value: formatMinutes(s.minutes),
              }))}
            />
          )}

          <h3 className="mt-8 mb-3 text-base font-semibold">Task timers</h3>
          {data.recent_time_logs.length === 0 ? (
            <Muted>No task timers yet.</Muted>
          ) : (
            <Log
              rows={data.recent_time_logs.map((l) => ({
                id: l.id,
                label: (
                  <>
                    {l.task?.name ?? 'Deleted task'}
                    <Sub>{formatDateTime(l.started_at)}</Sub>
                  </>
                ),
                value: l.ended_at ? formatMinutes(l.minutes) : 'Running',
              }))}
            />
          )}
        </Section>

        <Section labelledBy="reviews-title">
          <SectionHead id="reviews-title" title="Reviews" />
          {data.recent_reviews.length === 0 ? (
            <Muted>No reviews yet. Ratings appear here once you review finished tasks.</Muted>
          ) : (
            <ul>
              {data.recent_reviews.map((r) => (
                <li key={r.id} className="border-b border-line py-3.5">
                  <div className="flex items-baseline justify-between gap-4">
                    <strong className="font-medium">{r.task.name}</strong>
                    <Stars rating={r.rating} />
                  </div>
                  {r.comments && <p className="mt-1 text-ink">{r.comments}</p>}
                  <Sub>
                    {formatDateTime(r.reviewed_at)}
                    {r.needed_rework && ', needed rework'}
                  </Sub>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  )
}

function Log({ rows }: { rows: { id: number; label: ReactNode; value: string }[] }) {
  return (
    <ul>
      {rows.map((r) => (
        <li key={r.id} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-sm">
          <span>{r.label}</span>
          <strong className="font-semibold whitespace-nowrap">{r.value}</strong>
        </li>
      ))}
    </ul>
  )
}

function HoursChart({ range, days }: { range: DayRange; days: { day: string; hours_clocked: number }[] }) {
  if (days.length === 0) {
    return <Muted>No hours clocked in this period.</Muted>
  }

  const all = daysBetween(range)
  const byDay = new Map(days.map((d) => [d.day, d.hours_clocked]))
  const max = Math.max(9, ...days.map((d) => d.hours_clocked))
  const columns = { gridTemplateColumns: `repeat(${all.length}, minmax(0, 1fr))` }

  return (
    <div role="img" aria-label={`Hours clocked per day, ${formatDay(range.from)} to ${formatDay(range.to)}`}>
      <div className="relative h-40">
        <div className="absolute inset-x-0 border-t border-dashed border-line-strong" style={{ bottom: `${(8 / max) * 100}%` }}>
          <span className="absolute -top-5 right-0 bg-canvas pl-1 text-xs text-ink-faint">8h day</span>
        </div>
        <ol className="relative grid h-full items-end gap-[3px] border-b border-line-strong" style={columns}>
          {all.map((day) => {
            const hours = byDay.get(day) ?? 0
            return (
              <li
                key={day}
                title={`${formatDay(day)}: ${formatHours(hours)}`}
                className="rounded-t-sm bg-primary"
                style={{ height: `${(hours / max) * 100}%` }}
              />
            )
          })}
        </ol>
      </div>
      <p className="mt-1.5 flex justify-between text-xs text-ink-faint" aria-hidden="true">
        <span>{formatDay(all[0])}</span>
        {all.length > 2 && <span>{formatDay(all[Math.floor(all.length / 2)])}</span>}
        <span>{formatDay(all[all.length - 1])}</span>
      </p>
    </div>
  )
}

function Estimate({ task }: { task: DashboardTask }) {
  if (!task.estimated_minutes) {
    return task.actual_minutes ? (
      <span>{formatMinutes(task.actual_minutes)}, no estimate</span>
    ) : (
      <span className="text-ink-faint">Not tracked</span>
    )
  }
  const pct = (task.actual_minutes / task.estimated_minutes) * 100
  const over = pct > 100
  return (
    <div className="grid gap-1.5">
      <span className={over ? 'font-medium text-danger' : undefined}>
        {formatMinutes(task.actual_minutes)} of {formatMinutes(task.estimated_minutes)}
      </span>
      <Meter value={pct} over={over} label={`${Math.round(pct)}% of estimate`} />
    </div>
  )
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="tracking-widest whitespace-nowrap text-status-rework" aria-label={`${rating} out of 5`}>
      {'★'.repeat(rating)}
      <span className="text-line-strong" aria-hidden="true">
        {'★'.repeat(5 - rating)}
      </span>
    </span>
  )
}
