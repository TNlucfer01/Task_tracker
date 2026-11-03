import { useState } from 'react'
import { DataState, LiveDot, Muted, PageHeader, RangePicker, Section, SectionHead, Toolbar } from '../../components/ui'
import { daysBetween, formatDay, formatHours, formatMinutes, formatTime, lastDays, minutesSince } from '../../lib/format'
import { href } from '../../lib/router'
import { useApi, useNow } from '../../lib/useApi'
import { getAttendance, getPeople, type DayRange } from '../../utils/api'

// Timesheet shading. An 8-hour day lands in the third band.
const shades = [
  { min: 9, cell: 'bg-shade-4 text-white', label: 'Over 9h' },
  { min: 7, cell: 'bg-shade-3 text-white', label: '7–9h' },
  { min: 4, cell: 'bg-shade-2 text-ink', label: '4–7h' },
  { min: 0.01, cell: 'bg-shade-1 text-ink', label: 'Under 4h' },
]

function cellClass(hours: number) {
  return shades.find((s) => hours >= s.min)?.cell ?? 'bg-panel'
}

export function Attendance() {
  const [range, setRange] = useState<DayRange>(() => lastDays(7))
  const key = `${range.from}-${range.to}`
  const attendance = useApi(() => getAttendance(range), `attendance-${key}`)
  const people = useApi(() => getPeople(range, 'user'), `attendance-people-${key}`)
  const now = useNow(15_000)

  return (
    <>
      <PageHeader title="Attendance" lede="Clocked hours per person per day, in India time." />
      <Toolbar>
        <RangePicker value={range} onChange={setRange} />
      </Toolbar>

      <Section labelledBy="now-title">
        <SectionHead id="now-title" title="Clocked in now" />
        <DataState state={attendance}>
          {(data) =>
            data.clocked_in_now.length === 0 ? (
              <Muted>Nobody is clocked in right now.</Muted>
            ) : (
              <ul className="flex flex-wrap gap-x-8 gap-y-2">
                {data.clocked_in_now.map((e) => (
                  <li key={e.user_id} className="flex items-center gap-2">
                    <LiveDot />
                    <a href={href('people', e.user_id)} className="font-medium">
                      {e.name ?? `User ${e.user_id}`}
                    </a>
                    <span className="text-ink-soft">
                      {formatMinutes(minutesSince(e.clock_in, now))}, since {formatTime(e.clock_in)}
                    </span>
                  </li>
                ))}
              </ul>
            )
          }
        </DataState>
      </Section>

      <Section labelledBy="sheet-title">
        <SectionHead id="sheet-title" title="Timesheet">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft" aria-label="Legend">
            {[...shades].reverse().map((s) => (
              <li key={s.label} className="flex items-center gap-1.5">
                <i className={`size-3 rounded-sm ${s.cell}`} aria-hidden="true" />
                {s.label}
              </li>
            ))}
          </ul>
        </SectionHead>
        <DataState state={attendance}>
          {(data) => {
            const days = daysBetween(range)
            const hours = new Map(data.daily_hours.map((r) => [`${r.user_id}:${r.day}`, r.hours_clocked]))
            const rows = people.data?.users ?? []
            if (rows.length === 0) {
              return <Muted>{people.loading ? 'Loading people…' : 'No people to show yet.'}</Muted>
            }
            return (
              <div className="overflow-x-auto rounded-md border border-line-strong bg-panel">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line-strong">
                      <th scope="col" className="sticky left-0 z-[1] bg-panel px-4 py-2.5 text-left font-medium text-ink-soft">
                        Person
                      </th>
                      {days.map((d) => (
                        <th scope="col" key={d} className="min-w-14 px-1 py-2.5 text-center font-medium whitespace-nowrap text-ink-soft">
                          {formatDay(d)}
                        </th>
                      ))}
                      <th scope="col" className="px-4 py-2.5 text-right font-medium text-ink-soft">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((u) => {
                      const total = days.reduce((sum, d) => sum + (hours.get(`${u.id}:${d}`) ?? 0), 0)
                      return (
                        <tr key={u.id} className="border-b border-line last:border-b-0">
                          <th scope="row" className="sticky left-0 z-[1] bg-panel px-4 py-2 text-left font-medium whitespace-nowrap">
                            <a href={href('people', u.id)}>{u.name}</a>
                          </th>
                          {days.map((d) => {
                            const h = hours.get(`${u.id}:${d}`) ?? 0
                            return (
                              <td
                                key={d}
                                className={`h-11 border-l border-paper text-center font-medium ${cellClass(h)}`}
                                title={`${u.name}, ${formatDay(d)}: ${formatHours(h)}`}
                              >
                                {h > 0 ? h.toFixed(1) : ''}
                              </td>
                            )
                          })}
                          <td className="px-4 py-2 text-right font-semibold whitespace-nowrap">{formatHours(total)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          }}
        </DataState>
      </Section>
    </>
  )
}
