// Small SVG charts: a multi-series line chart with hover, and an hours-per-day bar strip.
import { useState } from 'react'
import { formatDate, formatHours } from '../lib/format'

/** Department colours in a fixed order by name; people with no department use series-other. */
export function departmentColor(departments: { id: number; name: string }[], id: number | null) {
  if (id === null) return 'var(--series-other)'
  const order = [...departments].sort((a, b) => a.name.localeCompare(b.name)).map((d) => d.id)
  const i = order.indexOf(id)
  return i >= 0 && i < 4 ? `var(--series-${i + 1})` : 'var(--series-other)'
}

type Series = { name: string; color: string; values: number[] }

/** A line chart of hours per day, one line per series, with a crosshair tooltip. */
export function LineChart({ days, series, height = 220 }: { days: string[]; series: Series[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 720
  const H = height
  const pad = { l: 36, r: 12, t: 12, b: 26 }
  const max = Math.max(4, ...series.flatMap((s) => s.values))
  const niceMax = Math.ceil(max / 4) * 4
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, days.length - 1)
  const y = (v: number) => pad.t + (1 - v / niceMax) * (H - pad.t - pad.b)
  const ticks = [0, niceMax / 4, niceMax / 2, (3 * niceMax) / 4, niceMax]

  if (!series.length) return <p className="py-10 text-center text-ink-faint">No hours clocked in this period.</p>

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Hours clocked per day by department" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--ink-faint)">
                {t}h
              </text>
            </g>
          ))}
          {days.map((d, i) =>
            i % Math.ceil(days.length / 7) === 0 || i === days.length - 1 ? (
              <text key={d} x={x(i)} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--ink-faint)">
                {formatDate(d)}
              </text>
            ) : null,
          )}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--line-strong)" strokeWidth={1} />}
          {series.map((s) => (
            <g key={s.name}>
              <polyline fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
              {hover !== null && <circle cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />}
            </g>
          ))}
          {days.map((d, i) => (
            <rect key={d} x={x(i) - (W - pad.l - pad.r) / days.length / 2} y={0} width={(W - pad.l - pad.r) / days.length} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
        </svg>
        {hover !== null && (
          <div className="pointer-events-none absolute top-2 rounded-md border border-line bg-surface px-3 py-2 text-[12px] shadow-overlay" style={{ left: `min(calc(${(x(hover) / W) * 100}% + 12px), calc(100% - 180px))` }}>
            <p className="mb-1 font-medium">{formatDate(days[hover])}</p>
            {series.map((s) => (
              <p key={s.name} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </span>
                <span className="tabular-nums">{formatHours(s.values[hover])}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-soft">
        {series.map((s) => (
          <li key={s.name} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} aria-hidden />
            {s.name} · {formatHours(s.values.reduce((a, b) => a + b, 0))}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Hours per day as small bars (shade by how full the day was). */
export function HoursStrip({ days }: { days: { day: string; hours: number }[] }) {
  const shade = (h: number) => (h <= 0 ? 'var(--subtle)' : h < 3 ? 'var(--shade-1)' : h < 6 ? 'var(--shade-2)' : h < 9 ? 'var(--shade-3)' : 'var(--shade-4)')
  return (
    <ul className="flex flex-wrap gap-1">
      {days.map((d) => (
        <li key={d.day} title={`${formatDate(d.day)}: ${formatHours(d.hours)}`} className="grid size-7 place-items-center rounded-sm text-[10px] tabular-nums" style={{ background: shade(d.hours), color: d.hours >= 6 ? 'var(--on-primary)' : 'var(--ink-soft)' }}>
          {d.hours > 0 ? Math.round(d.hours) : ''}
        </li>
      ))}
    </ul>
  )
}
