import { useState } from 'react'
import { Check, DataState, LiveDot, PageHeader, RangePicker, Sub, TableWrap, Toolbar } from '../../components/ui'
import { formatHours, formatPct, formatRating, lastDays } from '../../lib/format'
import { href } from '../../lib/router'
import { useApi } from '../../lib/useApi'
import { getPeople, type DayRange } from '../../utils/api'

export function People() {
  const [range, setRange] = useState<DayRange>(() => lastDays(30))
  const [showAll, setShowAll] = useState(false)
  const people = useApi(() => getPeople(range, showAll ? 'all' : 'user'), `people-${range.from}-${range.to}-${showAll}`)

  return (
    <>
      <PageHeader
        title="People"
        lede="Hours clocked use the selected dates. Task counts, on-time rate and ratings cover all time."
      />
      <Toolbar>
        <RangePicker value={range} onChange={setRange} />
        <Check label="Include admins" checked={showAll} onChange={setShowAll} />
      </Toolbar>

      <DataState state={people} isEmpty={(d) => d.users.length === 0} empty="No people yet.">
        {(data) => (
          <TableWrap>
            <table className="data-table min-w-[820px]">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Right now</th>
                  <th scope="col" className="num">Hours</th>
                  <th scope="col" className="num">Done</th>
                  <th scope="col" className="num">Open</th>
                  <th scope="col" className="num">Overdue</th>
                  <th scope="col" className="num">On time</th>
                  <th scope="col" className="num">Rating</th>
                  <th scope="col" className="num">Reworks</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id} className={u.is_active ? 'hover:bg-panel' : 'text-ink-faint'}>
                    <th scope="row">
                      <a href={href('people', u.id)}>{u.name}</a>
                      <Sub>{u.department?.name ?? 'No department'}</Sub>
                    </th>
                    <td>
                      {!u.is_active ? (
                        'Deactivated'
                      ) : u.clocked_in ? (
                        <span className="inline-flex items-center gap-2 font-medium text-done">
                          <LiveDot /> Clocked in
                        </span>
                      ) : (
                        <span className="text-ink-soft">Off the clock</span>
                      )}
                    </td>
                    <td className="num">{formatHours(u.hours_clocked)}</td>
                    <td className="num">{u.tasks_done}</td>
                    <td className="num">{u.open_tasks}</td>
                    <td className={`num ${u.overdue_tasks ? 'font-semibold text-over' : ''}`}>{u.overdue_tasks}</td>
                    <td className="num">{formatPct(u.on_time_pct)}</td>
                    <td className="num">{formatRating(u.avg_rating)}</td>
                    <td className="num">{u.rework_bounces}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </DataState>
    </>
  )
}
