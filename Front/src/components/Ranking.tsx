import { useState } from 'react'
import { getRanking, type RankMetric, type RankedUser } from '../api/admin/dashboard'
import { formatHours, formatPct, formatRating, lastDays, plural } from '../lib/format'
import { href } from '../lib/router'
import { useApi } from '../lib/useApi'
import { DataState, Section, SectionHead, Select } from './ui'

const metrics: { key: RankMetric; label: string; show: (u: RankedUser) => string }[] = [
  { key: 'tasks_done', label: 'Tasks done', show: (u) => plural(u.tasks_done, 'task') },
  { key: 'on_time_pct', label: 'On time', show: (u) => formatPct(u.on_time_pct) },
  { key: 'avg_rating', label: 'Average rating', show: (u) => formatRating(u.avg_rating) },
  { key: 'hours_clocked', label: 'Hours clocked', show: (u) => formatHours(u.hours_clocked) },
  { key: 'rework_bounces', label: 'Fewest reworks', show: (u) => plural(u.rework_bounces, 'rework') },
]

// Active team members ordered by one metric over the last 30 days.
export function Ranking() {
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
          <ol className="max-w-2xl overflow-hidden rounded-lg border border-line bg-surface">
            {data.users.map((u) => (
              <li key={u.id} className="flex items-baseline gap-4 border-b border-line px-4 py-3 last:border-b-0">
                <span className="w-6 text-base font-semibold text-ink-faint">{u.rank ?? '–'}</span>
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
