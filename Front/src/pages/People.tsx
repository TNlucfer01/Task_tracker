// People: performance across the team — delivery, quality, workload and hours — for a date range.
import { useState } from 'react'
import { people as peopleApi, reports } from '../api/endpoints'
import { apiHref } from '../api/client'
import type { PersonStats } from '../api/types'
import { Button, DataState, Dot, Input, PageHeader, PersonLink, Segmented, Stars, TableWrap, Toolbar } from '../components/ui'
import { formatHours, lastDays } from '../lib/format'
import { href } from '../lib/router'
import { can, useMe } from '../lib/session'
import { useApi } from '../lib/useApi'

type SortKey = 'name' | 'tasks_done' | 'on_time_pct' | 'avg_rating' | 'open_tasks' | 'overdue_tasks' | 'hours_clocked'

/** The People page. */
export function People() {
  const me = useMe()
  const [days, setDays] = useState<'7' | '30' | '90'>('30')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('name')
  const [desc, setDesc] = useState(false)
  const range = lastDays(Number(days))
  const state = useApi(() => peopleApi.list(range), `people-${days}`)

  /** Header button that sorts by a column. */
  const SortTh = ({ k, children, num }: { k: SortKey; children: string; num?: boolean }) => (
    <th scope="col" className={num ? 'num' : ''} aria-sort={sort === k ? (desc ? 'descending' : 'ascending') : 'none'}>
      <button type="button" className="font-medium hover:text-ink" onClick={() => (sort === k ? setDesc(!desc) : (setSort(k), setDesc(k !== 'name')))}>
        {children}
        {sort === k ? (desc ? ' ↓' : ' ↑') : ''}
      </button>
    </th>
  )

  /** Sorts people, keeping empty values last. */
  const sorted = (list: PersonStats[]) =>
    list
      .filter((p) => !q || `${p.name} ${p.email} ${p.title} ${p.department?.name ?? ''}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name) * (desc ? -1 : 1)
        const x = a[sort] ?? -1
        const y = b[sort] ?? -1
        return (Number(x) - Number(y)) * (desc ? -1 : 1)
      })

  return (
    <>
      <PageHeader
        title="People"
        lede={`How work is going for ${me.role.scope === 'department' ? `${me.department_name ?? 'your department'}` : 'everyone'}. On time is the share of finished tasks done by their deadline.`}
        actions={can(me, 'reports.export') && <a href={apiHref(reports.people(range))}><Button icon="download">Export CSV</Button></a>}
      />
      <Toolbar>
        <Input type="search" aria-label="Search people" placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
        <Segmented label="Period" value={days} onChange={setDays} options={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} />
      </Toolbar>
      <DataState state={state} isEmpty={(d) => d.people.length === 0} empty="Nobody to show yet.">
        {(d) => {
          const rows = sorted(d.people)
          return (
            <>
              <div className="hidden rounded-lg border border-line bg-surface sm:block">
                <TableWrap>
                  <table className="data-table min-w-[980px]">
                    <thead>
                      <tr>
                        <SortTh k="name">Person</SortTh>
                        <th scope="col">Department</th>
                        <SortTh k="tasks_done" num>Done</SortTh>
                        <SortTh k="on_time_pct" num>On time</SortTh>
                        <SortTh k="avg_rating">Rating</SortTh>
                        <SortTh k="open_tasks" num>Open</SortTh>
                        <SortTh k="overdue_tasks" num>Overdue</SortTh>
                        <SortTh k="hours_clocked" num>Hours</SortTh>
                        <th scope="col" className="num">On tasks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((p) => (
                        <tr key={p.id} className={p.is_active ? '' : 'opacity-60'}>
                          <th scope="row" className="font-normal">
                            <PersonLink person={p} to={href('people', p.id)} />
                            <span className="block pl-[30px] text-[12px] text-ink-faint">{p.title || p.role.name}{!p.is_active && ' · Inactive'}</span>
                          </th>
                          <td>{p.clocked_in_since ? <Dot live color="var(--success)" label={p.department?.name ?? '—'} /> : p.department?.name ?? '—'}</td>
                          <td className="num">{p.tasks_done}</td>
                          <td className="num">{p.on_time_pct === null ? '—' : `${Math.round(p.on_time_pct)}%`}</td>
                          <td><Stars value={p.avg_rating} /></td>
                          <td className="num">{p.open_tasks}</td>
                          <td className={p.overdue_tasks ? 'num font-medium text-danger' : 'num'}>{p.overdue_tasks}</td>
                          <td className="num">{formatHours(p.hours_clocked)}</td>
                          <td className="num">{p.hours_clocked > 0 ? `${Math.min(100, Math.round((100 * p.task_hours) / p.hours_clocked))}%` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              </div>
              <ul className="mobile-records sm:hidden">
                {rows.map((p) => (
                  <li key={p.id} className={`mobile-record ${p.is_active ? '' : 'opacity-60'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <PersonLink person={p} to={href('people', p.id)} />
                        <p className="truncate text-[13px] text-ink-faint">{p.title || p.role.name}{!p.is_active && ' · Inactive'}</p>
                      </div>
                      {p.clocked_in_since && <Dot live color="var(--success)" label="Working" />}
                    </div>
                    <p className="mt-3 text-[13px] text-ink-soft">{p.department?.name ?? 'No department'}</p>
                    <div className="mobile-record-grid">
                      <div><span className="mobile-record-label">Done · on time</span><span className="mobile-record-value">{p.tasks_done} · {p.on_time_pct === null ? '—' : `${Math.round(p.on_time_pct)}%`}</span></div>
                      <div><span className="mobile-record-label">Rating</span><Stars value={p.avg_rating} /></div>
                      <div><span className="mobile-record-label">Open · overdue</span><span className="mobile-record-value">{p.open_tasks} · <span className={p.overdue_tasks ? 'font-medium text-danger' : ''}>{p.overdue_tasks}</span></span></div>
                      <div><span className="mobile-record-label">Hours · on tasks</span><span className="mobile-record-value">{formatHours(p.hours_clocked)} · {p.hours_clocked > 0 ? `${Math.min(100, Math.round((100 * p.task_hours) / p.hours_clocked))}%` : '—'}</span></div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )
        }}
      </DataState>
    </>
  )
}
