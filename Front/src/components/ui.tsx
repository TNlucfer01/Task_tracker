// The shared component kit, built on the design system tokens. Pages compose these.
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import type { Priority, ProjectStatus, TaskStatus } from '../api/types'
import { initials, priorityLabel, projectStatusLabel, taskStatusLabel } from '../lib/format'
import type { Loadable } from '../lib/useApi'
import { Icon, type IconName } from './icons'

/** Joins class names, skipping falsy values. */
export function cx(...parts: (string | number | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; size?: 'sm' | 'md'; icon?: IconName; busy?: boolean }

/** A button in one of four variants, with an optional leading icon. */
export function Button({ variant = 'secondary', size = 'md', icon, busy, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  const styles = {
    primary: 'bg-primary text-on-primary border-primary hover:bg-primary-strong hover:border-primary-strong',
    secondary: 'bg-surface text-ink border-line-strong hover:bg-subtle',
    danger: 'bg-surface text-danger border-danger hover:bg-danger-tint',
    ghost: 'bg-transparent text-ink-soft border-transparent hover:bg-subtle hover:text-ink',
  }[variant]
  return (
    <button
      type={type}
      disabled={disabled || busy}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-55',
        size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm',
        styles,
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 16} />}
      {busy ? 'Working…' : children}
    </button>
  )
}

/** A square icon-only button with an accessible label. */
export function IconButton({ icon, label, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className={cx('inline-grid size-9 place-items-center rounded-md text-ink-soft hover:bg-subtle hover:text-ink', className)} {...rest}>
      <Icon name={icon} />
    </button>
  )
}

/** A labelled form control wrapper with hint and error text. */
export function Field({ label, hint, error, children, className }: { label: string; hint?: ReactNode; error?: string | null; children: (id: string) => ReactNode; className?: string }) {
  const id = useId()
  return (
    <div className={cx('grid content-start gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink-soft">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="text-[13px] text-ink-faint">{hint}</p>}
      {error && <p className="text-[13px] text-danger">{error}</p>}
    </div>
  )
}

const control = 'w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-faint disabled:bg-subtle disabled:text-ink-soft'

/** A text input. */
export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(control, 'h-9', className)} {...rest} />
}

/** A native select. */
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(control, 'h-9 pr-8', className)} {...rest}>
      {children}
    </select>
  )
}

/** A multi-line text input. */
export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(control, 'min-h-24 py-2 leading-6', className)} {...rest} />
}

/** A checkbox with its label. */
export function Checkbox({ label, checked, onChange, disabled, hint }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: string }) {
  return (
    <label className={cx('flex items-start gap-2.5 text-sm', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}>
      <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <span className="block text-[13px] text-ink-faint">{hint}</span>}
      </span>
    </label>
  )
}

/** A bordered panel with an optional title row and actions. */
export function Panel({ title, actions, children, className, padded = true, id }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean; id?: string }) {
  return (
    <section id={id} className={cx('min-w-0 rounded-lg border border-line bg-surface', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
          {title && <h2 className="text-[17px] leading-6 font-semibold">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'p-4 sm:p-5' : ''}>{children}</div>
    </section>
  )
}

/** The page title row: title, optional lede and actions. */
export function PageHeader({ title, lede, actions, back }: { title: ReactNode; lede?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <a href={back.href} className="mb-2 inline-flex items-center gap-1 text-[13px] text-ink-soft hover:text-ink">
            <Icon name="back" size={14} />
            {back.label}
          </a>
        )}
        <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.01em] break-words">{title}</h1>
        {lede && <p className="mt-1 max-w-[70ch] text-ink-soft">{lede}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

const statusColor: Record<TaskStatus, string> = {
  todo: 'var(--status-todo)',
  in_progress: 'var(--status-progress)',
  in_review: 'var(--status-review)',
  rework: 'var(--status-rework)',
  done: 'var(--status-done)',
}

/** A coloured dot and a word. */
export function Dot({ color, label, live }: { color: string; label: ReactNode; live?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]">
      <span className={cx('size-2 shrink-0 rounded-full', live && 'live-dot')} style={{ background: color }} aria-hidden />
      {label}
    </span>
  )
}

/** Task status: dot + word, using the fixed status colours. */
export function StatusBadge({ status }: { status: TaskStatus }) {
  return <Dot color={statusColor[status]} label={taskStatusLabel[status]} />
}

/** Project status: dot + word. */
export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const color = { planned: 'var(--status-todo)', active: 'var(--status-progress)', on_hold: 'var(--warning)', completed: 'var(--success)' }[status]
  return <Dot color={color} label={projectStatusLabel[status]} />
}

/** The red "Overdue" tag shown next to a status or date. */
export function OverdueTag() {
  return <span className="ml-1.5 inline-flex rounded-sm bg-danger-tint px-1.5 py-px text-[12px] font-medium whitespace-nowrap text-danger">Overdue</span>
}

/** Priority as a small flag; urgent and high stand out. */
export function PriorityTag({ priority, quiet }: { priority: Priority; quiet?: boolean }) {
  const color = { urgent: 'text-danger', high: 'text-warning', medium: 'text-ink-soft', low: 'text-ink-faint' }[priority]
  if (quiet && (priority === 'medium' || priority === 'low')) return null
  return (
    <span className={cx('inline-flex items-center gap-1 text-[13px] whitespace-nowrap', color)}>
      <Icon name="flag" size={13} />
      {priorityLabel[priority]}
    </span>
  )
}

/** A small neutral chip for labels and tags. */
export function Chip({ children, onRemove }: { children: ReactNode; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-subtle px-1.5 py-px text-[12px] text-ink-soft">
      {children}
      {onRemove && (
        <button type="button" aria-label="Remove" onClick={onRemove} className="text-ink-faint hover:text-ink">
          <Icon name="x" size={12} />
        </button>
      )}
    </span>
  )
}

/** A round avatar with initials. */
export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) | 0
  const hue = Math.abs(hash) % 360
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4, background: `oklch(0.5 0.12 ${hue})` }}
    >
      {initials(name)}
    </span>
  )
}

/** A person's name with avatar, linking to their page when given. */
export function PersonLink({ person, to }: { person: { id: number; name: string } | null; to?: string }) {
  if (!person) return <span className="text-ink-faint">Unassigned</span>
  const inner = (
    <span className="inline-flex items-center gap-2">
      <Avatar name={person.name} size={22} />
      {person.name}
    </span>
  )
  return to ? <a href={to} className="text-ink hover:text-primary">{inner}</a> : inner
}

/** A thin progress track; segments split it by colour. */
export function ProgressBar({ value, label, segments }: { value: number; label: string; segments?: { value: number; color: string; label: string }[] }) {
  return (
    <div role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-subtle">
      {segments ? (
        segments.filter((s) => s.value > 0).map((s, i) => <span key={i} title={s.label} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${s.value}%`, background: s.color }} />)
      ) : (
        <span className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, value)}%` }} />
      )}
    </div>
  )
}

/** The headline numbers in one bordered strip. */
export function KpiStrip({ items }: { items: { label: string; value: ReactNode; hint?: ReactNode; href?: string; tone?: 'danger' | 'success' }[] }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
      {items.map((k) => {
        const body = (
          <>
            <dt className="text-[13px] text-ink-soft">{k.label}</dt>
            <dd className={cx('mt-1 text-[30px] leading-9 font-semibold tracking-[-0.01em]', k.tone === 'danger' && 'text-danger', k.tone === 'success' && 'text-success')}>{k.value}</dd>
            {k.hint && <dd className="mt-0.5 text-[13px] text-ink-faint">{k.hint}</dd>}
          </>
        )
        return (
          <div key={k.label} className="-mb-px -ml-px border-b border-l border-line">
            {k.href ? (
              <a href={k.href} className="block h-full px-4 py-4 text-ink hover:bg-subtle hover:no-underline sm:px-5">
                {body}
              </a>
            ) : (
              <div className="px-4 py-4 sm:px-5">{body}</div>
            )}
          </div>
        )
      })}
    </dl>
  )
}

/** Shows loading, error and empty states around loaded data. */
export function DataState<T>({ state, children, isEmpty, empty }: { state: Loadable<T>; children: (data: T) => ReactNode; isEmpty?: (data: T) => boolean; empty?: ReactNode }) {
  if (state.error && !state.data)
    return (
      <Notice tone="danger" action={<Button size="sm" onClick={state.reload}>Try again</Button>}>
        {state.error}
      </Notice>
    )
  if (!state.data) return <Skeleton />
  if (isEmpty?.(state.data)) return <Empty>{empty}</Empty>
  return <>{children(state.data)}</>
}

/** A quiet loading placeholder. */
export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-md bg-subtle motion-reduce:animate-none" style={{ opacity: 1 - i * 0.18 }} />
      ))}
    </div>
  )
}

/** An empty state: what will appear and how to make it appear. */
export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-lg border border-dashed border-line px-6 py-10 text-center text-ink-soft">
      <p className="max-w-[48ch]">{children}</p>
      {action}
    </div>
  )
}

/** An inline notice in info, success, warning or danger tone. */
export function Notice({ tone = 'info', children, action }: { tone?: 'info' | 'success' | 'warning' | 'danger'; children: ReactNode; action?: ReactNode }) {
  const styles = { info: 'bg-primary-tint text-ink', success: 'bg-success-tint text-ink', warning: 'bg-warning-tint text-ink', danger: 'bg-danger-tint text-danger' }[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cx('flex flex-wrap items-center justify-between gap-3 rounded-md px-3.5 py-2.5 text-sm', styles)}>
      <div className="min-w-0">{children}</div>
      {action}
    </div>
  )
}

/** A segmented control for a small set of choices. */
export function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line-strong bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx('inline-flex h-7 items-center gap-1.5 rounded-[5px] px-2.5 text-[13px] font-medium whitespace-nowrap', o.value === value ? 'bg-primary-tint text-primary' : 'text-ink-soft hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** A horizontally scrolling wrapper so wide tables never widen the page. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="max-w-full overflow-x-auto">{children}</div>
}

/** A row of filters above a list. */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-end gap-3">{children}</div>
}

/** A native modal dialog: focus stays inside and Escape closes it. */
export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className={cx('m-auto max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] rounded-lg border border-line bg-surface p-0 shadow-overlay', wide ? 'max-w-3xl' : 'max-w-lg')}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-32px)] flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <h2 className="text-[17px] font-semibold">{title}</h2>
            <IconButton icon="x" label="Close" onClick={onClose} />
          </header>
          <div className="min-h-0 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}

/** Asks before doing something that can't be undone. */
export function ConfirmButton({ label, confirm, title, onConfirm, variant = 'danger', icon, size }: { label: string; confirm: ReactNode; title: string; onConfirm: () => Promise<unknown>; variant?: ButtonProps['variant']; icon?: IconName; size?: ButtonProps['size'] }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <Button variant={variant} icon={icon} size={size} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              busy={busy}
              onClick={async () => {
                setBusy(true)
                setError(null)
                try {
                  await onConfirm()
                  setOpen(false)
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Something went wrong.')
                } finally {
                  setBusy(false)
                }
              }}
            >
              {label}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <p>{confirm}</p>
          {error && <Notice tone="danger">{error}</Notice>}
        </div>
      </Dialog>
    </>
  )
}

/** Tabs that switch content within a page. */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="tabs-strip mb-5 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          type="button"
          aria-selected={t.value === value}
          onClick={() => onChange(t.value)}
          className={cx('-mb-px inline-flex h-10 items-center gap-1.5 border-b-2 px-3 text-sm font-medium whitespace-nowrap', t.value === value ? 'border-primary text-primary' : 'border-transparent text-ink-soft hover:text-ink')}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/** A definition list row used in property panels. */
export function Prop({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 py-1.5">
      <dt className="text-[13px] text-ink-soft">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

/** Rating as filled stars, with the number for screen readers. */
export function Stars({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-ink-faint">—</span>
  const rounded = Math.round(value)
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${value} out of 5`}>
      <span className="inline-flex text-warning" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <Icon key={i} name="star" size={13} fill={i < rounded ? 'currentColor' : 'none'} />
        ))}
      </span>
      <span className="text-[13px] text-ink-soft">{Number(value).toFixed(1)}</span>
    </span>
  )
}
