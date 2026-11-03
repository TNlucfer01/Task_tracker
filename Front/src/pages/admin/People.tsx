import { useState } from 'react'
import { UserDialog } from '../../components/UserDialog'
import { Button, Check, DataState, LiveDot, PageHeader, RangePicker, Sub, SuccessNotice, TableWrap, Toolbar } from '../../components/ui'
import { takeFlash } from '../../lib/flash'
import { formatHours, formatPct, formatRating, lastDays } from '../../lib/format'
import { href } from '../../lib/router'
import { useApi } from '../../lib/useApi'
import { getPeople, type DayRange } from '../../utils/api'

export function People() {
  const [range, setRange] = useState<DayRange>(() => lastDays(30))
  const [showAll, setShowAll] = useState(false)
  const people = useApi(() => getPeople(range, showAll ? 'all' : 'user'), `people-${range.from}-${range.to}-${showAll}`)
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState<string | null>(takeFlash)

  return (
    <>
      <PageHeader
        title="People"
        lede="Hours clocked use the selected dates. Task counts, on-time rate and ratings cover all time."
        actions={
          <Button variant="primary" onClick={() => setAdding(true)}>
            Add person
          </Button>
        }
      />
      {notice && <SuccessNotice message={notice} onDismiss={() => setNotice(null)} />}
      {adding && (
        <UserDialog
          onClose={() => setAdding(false)}
          onSaved={(user, message) => {
            setAdding(false)
            setNotice(message)
            // New admins are hidden by the default filter, so show them.
            if (user.role === 'admin') setShowAll(true)
            people.reload()
          }}
        />
      )}
      <Toolbar>
        <RangePicker value={range} onChange={setRange} />
        <Check label="Include admins" checked={showAll} onChange={setShowAll} />
      </Toolbar>

      <DataState state={people} isEmpty={(d) => d.users.length === 0} empty="No people yet. Add your first team member to start tracking their work.">
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
                      <Sub>
                        {u.role === 'admin' ? 'Admin, ' : ''}
                        {u.department?.name ?? 'No department'}
                      </Sub>
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
