import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { lastDays, projectStatusLabel, taskStatusLabel } from '../lib/format'
import { projectStatusDot, taskStatusDot, taskStatusText } from '../lib/status'
import type { DayRange, ProjectStatus } from '../api/admin/dashboard'
import type { TaskStatus } from '../api/types'


const buttonStyles = {
  primary: 'bg-primary text-on-primary hover:bg-primary-strong min-h-9 px-4',
  quiet: 'border border-line-strong bg-surface text-ink hover:bg-canvas min-h-9 px-3.5',
  onDark: 'border border-chrome-muted/50 text-chrome-ink hover:bg-white/10 min-h-9 px-3.5',
  danger: 'bg-danger text-on-primary hover:bg-danger/90 min-h-9 px-3.5',
  dangerQuiet: 'border border-danger/40 bg-surface text-danger hover:bg-danger-tint min-h-9 px-3.5',
}

export function Button({
  variant = 'quiet',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonStyles }) {
  return (
    <button
      type="button"
      className={`inline-flex cursor-pointer items-center justify-center rounded-md text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-60 ${buttonStyles[variant]} ${className}`}
      {...props}
    />
  )
}

export function PageHeader({ title, lede, actions }: { title: string; lede?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] leading-8 font-semibold tracking-tight">{title}</h1>
        {lede && <p className="mt-1.5 max-w-[65ch] text-ink-soft">{lede}</p>}
      </div>
      {actions}
    </header>
  )
}

export function SectionHead({ id, title, children }: { id: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <h2 id={id} className="text-[17px] leading-6 font-semibold">
        {title}
      </h2>
      {children}
    </div>
  )
}

export function Section({ labelledBy, children }: { labelledBy: string; children: ReactNode }) {
  return (
    <section aria-labelledby={labelledBy} className="border-t border-line-strong pt-6 pb-10">
      {children}
    </section>
  )
}

export function TaskStatusPill({ status }: { status: TaskStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap ${taskStatusText[status]}`}>
      <i className={`size-2 rounded-full ${taskStatusDot[status]}`} aria-hidden="true" />
      {taskStatusLabel[status]}
    </span>
  )
}

export function ProjectStatusPill({ status }: { status: ProjectStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap text-ink">
      <i className={`size-2 rounded-full ${projectStatusDot[status]}`} aria-hidden="true" />
      {projectStatusLabel[status]}
    </span>
  )
}

export function OverdueTag() {
  return (
    <span className="ml-1 inline-block rounded-sm bg-danger-tint px-1.5 py-px text-xs font-semibold whitespace-nowrap text-danger">
      Overdue
    </span>
  )
}

export function LiveDot({ light = false }: { light?: boolean }) {
  return (
    <i
      className={`inline-block size-2 shrink-0 animate-live rounded-full ${light ? 'bg-chrome-ink' : 'bg-success'}`}
      aria-hidden="true"
    />
  )
}

export function Muted({ children }: { children: ReactNode }) {
  return <p className="text-ink-soft">{children}</p>
}

export function Sub({ children }: { children: ReactNode }) {
  return <span className="mt-0.5 block text-[13px] font-normal text-ink-soft">{children}</span>
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-lg border border-line bg-surface">{children}</div>
}

// Loading / error / empty handling, so each page only describes its happy path.
export function DataState<T>({
  state,
  empty,
  isEmpty,
  children,
}: {
  state: { data: T | null; error: string | null; loading: boolean; reload: () => void }
  empty?: ReactNode
  isEmpty?: (data: T) => boolean
  children: (data: T) => ReactNode
}) {
  if (state.error) {
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger/30 bg-danger-tint px-4 py-3 text-danger"
        role="alert"
      >
        <p>{state.error}</p>
        <Button onClick={state.reload}>Try again</Button>
      </div>
    )
  }
  if (!state.data) {
    return (
      <p className="py-6 text-ink-soft" role="status">
        Loading…
      </p>
    )
  }
  if (isEmpty?.(state.data)) {
    return <div className="rounded-md border border-dashed border-line-strong px-4 py-6 text-ink-soft">{empty}</div>
  }
  return <div className={state.loading ? 'opacity-60 transition-opacity' : undefined}>{children(state.data)}</div>
}

export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T | undefined
  onChange: (value: T) => void
}) {
  return (
    <div className="inline-flex flex-wrap rounded-md border border-line-strong bg-surface p-0.5" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className="cursor-pointer rounded px-3 py-1.5 text-sm text-ink-soft hover:text-ink aria-pressed:bg-primary aria-pressed:text-on-primary"
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const presets = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
]

const fieldClass =
  'min-h-9 rounded-md border border-line-strong bg-surface px-2.5 text-sm text-ink focus:border-primary focus:outline-none'

export function RangePicker({ value, onChange }: { value: DayRange; onChange: (range: DayRange) => void }) {
  const active = presets.find((p) => {
    const r = lastDays(p.value)
    return r.from === value.from && r.to === value.to
  })

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Segmented label="Date range" options={presets} value={active?.value} onChange={(d) => onChange(lastDays(d))} />
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        From
        <input
          type="date"
          className={fieldClass}
          value={value.from}
          max={value.to}
          onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        To
        <input
          type="date"
          className={fieldClass}
          value={value.to}
          min={value.from}
          onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
        />
      </label>
    </div>
  )
}

export function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string | number
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-soft">
      {label}
      <select className={fieldClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  )
}

export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
      <input
        type="checkbox"
        className="size-4 accent-primary"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  )
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-3">{children}</div>
}

// Horizontal bar for a 0–100 value.
export function Meter({ value, label, over = false }: { value: number; label: string; over?: boolean }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line" role="img" aria-label={label}>
      <span
        className={`block h-full rounded-full ${over ? 'bg-danger' : 'bg-primary'}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

// A row of headline numbers in one bordered strip (design system: KpiStrip). `alert` marks one in danger.
export function Tally({ items }: { items: { label: string; value: ReactNode; alert?: boolean }[] }) {
  return (
    <dl className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
      {items.map((item) => (
        <div key={item.label} className="bg-surface px-5 py-4">
          <dt className="text-[13px] font-medium text-ink-soft">{item.label}</dt>
          <dd className={`mt-0.5 text-[26px] leading-8 font-semibold tracking-tight ${item.alert ? 'text-danger' : ''}`}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

// Confirms something the admin just did. Dismissible; announced to screen readers.
export function SuccessNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-status-done/30 bg-status-done/8 px-4 py-3 text-status-done"
    >
      <p>{message}</p>
      <button type="button" onClick={onDismiss} className="cursor-pointer text-sm font-medium underline underline-offset-3">
        Dismiss
      </button>
    </div>
  )
}
