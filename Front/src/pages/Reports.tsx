// Reports: CSV downloads limited to what you can see.
import { useState } from 'react'
import { apiHref } from '../api/client'
import { reports } from '../api/endpoints'
import { Button, Field, Input, PageHeader, Panel } from '../components/ui'
import { lastDays } from '../lib/format'

/** The Reports page. */
export function Reports() {
  const [range, setRange] = useState(lastDays(30))
  const items = [
    { title: 'People', body: 'Tasks done, on-time rate, rating, open and overdue work, and hours for each person.', path: reports.people(range), dated: true },
    { title: 'Departments', body: 'Headcount, open, done and overdue tasks, hours and average rating per department.', path: reports.departments(range), dated: true },
    { title: 'Time', body: 'Every work session with clock in and out, minutes and whether it was corrected.', path: reports.time(range), dated: true },
    { title: 'Tasks', body: 'Every task with status, assignee, deadline, estimate, time spent and rating.', path: reports.tasks(), dated: false },
    { title: 'Projects', body: 'Project status, owner, deadline and progress.', path: reports.projects(), dated: false },
  ]
  return (
    <>
      <PageHeader title="Reports" lede="Downloads open in Excel or Google Sheets. Dates are in India time." />
      <div className="mb-6 flex flex-wrap gap-4">
        <Field label="From">{(id) => <Input id={id} type="date" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} />}</Field>
        <Field label="To">{(id) => <Input id={id} type="date" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} />}</Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((r) => (
          <Panel key={r.title} title={r.title}>
            <p className="text-ink-soft">{r.body}</p>
            <p className="mt-1 text-[13px] text-ink-faint">{r.dated ? 'Uses the dates above.' : 'Current state, all dates.'}</p>
            <a href={apiHref(r.path)} className="mt-4 inline-block">
              <Button icon="download">Download CSV</Button>
            </a>
          </Panel>
        ))}
      </div>
    </>
  )
}
