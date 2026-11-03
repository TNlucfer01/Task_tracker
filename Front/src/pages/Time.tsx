// Time: your sessions, team attendance, and corrections with an audit trail.
import { useState } from 'react'
import { time as timeApi, users as usersApi } from '../api/endpoints'
import type { Session } from '../api/types'
import { HoursStrip } from '../components/charts'
import { Button, DataState, Dialog, Dot, Field, Input, Notice, PageHeader, Panel, Segmented, Select, TableWrap, Tabs, Textarea, Toolbar } from '../components/ui'
import { useClock } from '../lib/clock'
import { formatDate, formatDateTime, formatHours, formatMinutes, formatTime, fromLocalInput, lastDays, since, toLocalInput } from '../lib/format'
import { href } from '../lib/router'
import { can, useMe } from '../lib/session'
import { toast } from '../lib/toast'
import { useAction, useApi, useNow } from '../lib/useApi'

/** Edit a session's times with a reason; shows the previous corrections. */
function CorrectDialog({ session, onClose, onSaved }: { session: Session; onClose: () => void; onSaved: () => void }) {
  const [clockIn, setClockIn] = useState(toLocalInput(session.clock_in))
  const [clockOut, setClockOut] = useState(toLocalInput(session.clock_out))
  const [reason, setReason] = useState('')
  const history = useApi(() => timeApi.corrections(session.id), `corrections-${session.id}`)
  const { busy, error, run } = useAction()
  return (
    <Dialog
      open
      onClose={onClose}
      title="Correct work session"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            busy={busy}
            disabled={reason.trim().length < 3 || !clockIn}
            onClick={() =>
              run(async () => {
                await timeApi.correct(session.id, { clock_in: fromLocalInput(clockIn)!, clock_out: fromLocalInput(clockOut), reason })
                toast('Session corrected')
                onSaved()
                onClose()
              })
            }
          >
            Save correction
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Clock in">{(id) => <Input id={id} type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />}</Field>
          <Field label="Clock out" hint="Leave empty if still working">{(id) => <Input id={id} type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />}</Field>
        </div>
        <Field label="Reason" hint="Recorded with your name.">{(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Forgot to clock out" className="min-h-16" />}</Field>
        <p className="text-[13px] text-ink-faint">Task timers outside the new times are trimmed to fit.</p>
        {history.data && history.data.corrections.length > 0 && (
          <div>
            <h3 className="mb-2 text-[13px] font-medium text-ink-soft">Earlier corrections</h3>
            <ul className="grid gap-2 text-[13px]">
              {history.data.corrections.map((c) => (
                <li key={c.id} className="rounded-md bg-subtle px-3 py-2">
                  {formatTime(c.old_clock_in)}–{c.old_clock_out ? formatTime(c.old_clock_out) : 'open'} → {formatTime(c.new_clock_in)}–{c.new_clock_out ? formatTime(c.new_clock_out) : 'open'}
                  <span className="block text-ink-soft">
                    “{c.reason}” · {c.editor?.name} · {formatDateTime(c.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  )
}

/** A person's sessions with optional correction. */
function Sessions({ userId, days }: { userId?: number; days: number }) {
  const range = lastDays(days)
  const state = useApi(() => timeApi.sessions({ user_id: userId, ...range }), `sessions-${userId}-${days}`)
  const [editing, setEditing] = useState<Session | null>(null)
  const now = useNow(60_000)
  return (
    <DataState state={state} isEmpty={(d) => d.sessions.length === 0} empty="No work sessions in this period.">
      {(d) => (
        <>
          <div className="hidden rounded-lg border border-line bg-surface sm:block">
            <TableWrap>
              <table className="data-table min-w-[640px]">
                <thead>
                  <tr>
                    <th scope="col">Day</th><th scope="col">Clock in</th><th scope="col">Clock out</th>
                    <th scope="col" className="num">Worked</th><th scope="col" className="num">On tasks</th>
                    <th scope="col">Notes</th>{d.can_correct && <th scope="col"><span className="sr-only">Actions</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {d.sessions.map((s) => (
                    <tr key={s.id}>
                      <th scope="row" className="font-medium">{formatDate(s.clock_in)}</th>
                      <td>{formatTime(s.clock_in)}</td>
                      <td>{s.clock_out ? formatTime(s.clock_out) : <Dot live color="var(--success)" label={`Working · ${since(s.clock_in, now)}`} />}</td>
                      <td className="num">{formatMinutes(s.minutes)}</td><td className="num">{formatMinutes(s.task_minutes)}</td>
                      <td className="text-[13px] text-ink-soft">{s.corrections > 0 ? 'Corrected' : ''}</td>
                      {d.can_correct && <td className="text-right"><Button size="sm" variant="ghost" onClick={() => setEditing(s)}>Correct</Button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>
          <ul className="mobile-records sm:hidden">
            {d.sessions.map((s) => (
              <li key={s.id} className="mobile-record">
                <div className="flex items-start justify-between gap-3">
                  <strong>{formatDate(s.clock_in)}</strong>
                  {s.corrections > 0 && <span className="text-[12px] font-medium text-warning">Corrected</span>}
                </div>
                <div className="mobile-record-grid">
                  <div><span className="mobile-record-label">Clocked in</span><span className="mobile-record-value">{formatTime(s.clock_in)}</span></div>
                  <div><span className="mobile-record-label">Clocked out</span><span className="mobile-record-value">{s.clock_out ? formatTime(s.clock_out) : <Dot live color="var(--success)" label={`Working · ${since(s.clock_in, now)}`} />}</span></div>
                  <div><span className="mobile-record-label">Worked</span><span className="mobile-record-value">{formatMinutes(s.minutes)}</span></div>
                  <div><span className="mobile-record-label">On tasks</span><span className="mobile-record-value">{formatMinutes(s.task_minutes)}</span></div>
                </div>
                {d.can_correct && <div className="mt-3 flex justify-end"><Button size="sm" onClick={() => setEditing(s)}>Correct session</Button></div>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-ink-faint">Session durations are rounded to the nearest minute.</p>
          {editing && <CorrectDialog session={editing} onClose={() => setEditing(null)} onSaved={state.reload} />}
        </>
      )}
    </DataState>
  )
}

/** Team attendance: who's in now and hours per person per day. */
function Attendance({ days }: { days: number }) {
  const range = lastDays(days)
  const state = useApi(() => timeApi.attendance(range), `attendance-${days}`)
  const now = useNow(60_000)
  return (
    <DataState state={state}>
      {(d) => {
        const dayList = Array.from({ length: days }, (_, i) => lastDays(days - i).from)
        return (
          <div className="grid gap-6">
            <Panel title={`Clocked in now · ${d.clocked_in_now.length}`}>
              {d.clocked_in_now.length === 0 ? (
                <p className="text-ink-soft">Nobody is clocked in.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {d.clocked_in_now.map((c) => (
                    <li key={c.session_id} className="rounded-md border border-line px-3 py-2">
                      <Dot live color="var(--success)" label={<a href={href('people', c.user_id)} className="font-medium">{c.name}</a>} />
                      <span className="block pl-3.5 text-[12px] text-ink-faint">
                        since {formatTime(c.clock_in)} · {since(c.clock_in, now)}
                        {c.working_on ? ` · ${c.working_on.key}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Hours per day">
              <p className="mb-4 text-[13px] text-ink-soft">Only recorded clock-in sessions appear here. A blank day means no time was logged.</p>
              <ul className="grid gap-3">
                {d.people.map((p) => {
                  const hours = dayList.map((day) => ({ day, hours: d.daily_hours.find((h) => h.user_id === p.id && h.day === day)?.hours_clocked ?? 0 }))
                  return (
                    <li key={p.id} className="grid gap-2 rounded-md border border-line p-3 sm:grid-cols-[minmax(120px,0.8fr)_minmax(0,2fr)_auto] sm:items-center">
                      <div className="min-w-0">
                        <a href={href('people', p.id)} className="font-medium">{p.name}</a>
                        <span className="block text-[12px] text-ink-faint">{p.department_name ?? 'No department'}</span>
                      </div>
                      <div className="max-w-full overflow-x-auto"><HoursStrip days={hours} /></div>
                      <strong className="text-sm tabular-nums">{formatHours(hours.reduce((a, h) => a + h.hours, 0))}</strong>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          </div>
        )
      }}
    </DataState>
  )
}

/** The Time page. */
export function Time() {
  const me = useMe()
  const clock = useClock()
  const manages = can(me, 'time.manage')
  const seesTeam = manages || can(me, 'people.view') || can(me, 'dashboard.view')
  const tracks = can(me, 'time.track')
  const [tab, setTab] = useState<'mine' | 'team' | 'corrections'>(tracks ? 'mine' : 'team')
  const [days, setDays] = useState<'7' | '14' | '30'>('14')
  const [person, setPerson] = useState<number | ''>('')
  const people = useApi(() => (manages ? usersApi.options() : Promise.resolve({ users: [] })), 'time-people')

  return (
    <>
      <PageHeader
        title="Time"
        lede="Hours come from clocking in and out. Task timers run inside a work session."
        actions={
          tracks &&
          clock.status &&
          (clock.status.session ? (
            <Button busy={clock.busy} onClick={clock.clockOut}>
              Clock out
            </Button>
          ) : (
            <Button variant="primary" busy={clock.busy} onClick={clock.clockIn}>
              Clock in
            </Button>
          ))
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ...(tracks ? [{ value: 'mine' as const, label: 'My sessions' }] : []),
          ...(seesTeam ? [{ value: 'team' as const, label: 'Attendance' }] : []),
          ...(manages ? [{ value: 'corrections' as const, label: 'Corrections' }] : []),
        ]}
      />
      <Toolbar>
        <Segmented label="Period" value={days} onChange={setDays} options={[{ value: '7', label: '7 days' }, { value: '14', label: '14 days' }, { value: '30', label: '30 days' }]} />
        {tab === 'corrections' && (
          <Select aria-label="Person" value={person} onChange={(e) => setPerson(e.target.value ? Number(e.target.value) : '')} className="w-56">
            <option value="">Choose a person</option>
            {people.data?.users.filter((u) => u.id !== me.id || me.role.is_system).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        )}
      </Toolbar>
      {tab === 'mine' && <Sessions days={Number(days)} />}
      {tab === 'team' && <Attendance days={Number(days)} />}
      {tab === 'corrections' && (person ? <Sessions userId={person} days={Number(days)} /> : <p className="text-ink-soft">Choose a person to see and correct their sessions. Every correction is recorded with a reason.</p>)}
    </>
  )
}
