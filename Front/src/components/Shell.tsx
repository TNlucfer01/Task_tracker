// The app frame: navy sidebar (top bar on small screens) with navigation filtered by permission,
// the clock, notifications and the account menu.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { notifications as notificationsApi } from '../api/endpoints'
import type { Notification } from '../api/types'
import { useClock } from '../lib/clock'
import { relative, since } from '../lib/format'
import { href } from '../lib/router'
import { can, useSession } from '../lib/session'
import { applyTheme, savedTheme, type Theme } from '../lib/theme'
import { useNow } from '../lib/useApi'
import { Icon, type IconName } from './icons'
import { Avatar, cx } from './ui'

type NavItem = { to: string; label: string; icon: IconName; show: boolean; match: string }

/** Builds the navigation for the signed-in person's permissions. */
function useNav(): NavItem[] {
  const { me } = useSession()
  const settings = can(me, 'people.manage') || can(me, 'roles.manage') || can(me, 'departments.manage')
  const items: NavItem[] = [
    { to: href(), label: 'Home', icon: 'home', show: true, match: '' },
    { to: href('tasks'), label: 'Tasks', icon: 'tasks', show: true, match: 'tasks' },
    { to: href('projects'), label: 'Projects', icon: 'projects', show: true, match: 'projects' },
    { to: href('dashboard'), label: 'Dashboard', icon: 'dashboard', show: can(me, 'dashboard.view'), match: 'dashboard' },
    { to: href('people'), label: 'People', icon: 'people', show: can(me, 'people.view'), match: 'people' },
    { to: href('time'), label: 'Time', icon: 'clock', show: can(me, 'time.track') || can(me, 'time.manage') || can(me, 'people.view'), match: 'time' },
    { to: href('reports'), label: 'Reports', icon: 'report', show: can(me, 'reports.export'), match: 'reports' },
    { to: href('settings'), label: 'Settings', icon: 'settings', show: settings, match: 'settings' },
  ]
  return items.filter((n) => n.show)
}

/** Sidebar clock: clock in/out and the running timer. */
function ClockCard() {
  const { status, busy, clockIn, clockOut, stopTimer } = useClock()
  const now = useNow(30_000)
  if (!status) return null
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-[13px]">
      {status.session ? (
        <>
          <p className="flex items-center gap-2 text-chrome-ink">
            <span className="live-dot size-2 rounded-full bg-[#4cc382]" aria-hidden />
            Clocked in · {since(status.session.clock_in, now)}
          </p>
          {status.timer ? (
            <div className="mt-2 flex items-center justify-between gap-2">
              <a href={href('tasks', status.timer.task_id)} className="min-w-0 truncate text-chrome-muted hover:text-chrome-ink">
                {status.timer.task_key} · {since(status.timer.started_at, now)}
              </a>
              <button type="button" onClick={stopTimer} disabled={busy} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-chrome-ink hover:bg-white/10" aria-label="Stop timer">
                <Icon name="stop" size={13} />
                Stop
              </button>
            </div>
          ) : (
            <p className="mt-1 text-chrome-muted">No timer running</p>
          )}
          <button type="button" onClick={clockOut} disabled={busy} className="mt-2.5 h-8 w-full rounded-md border border-white/20 font-medium text-chrome-ink hover:bg-white/10">
            Clock out
          </button>
        </>
      ) : (
        <>
          <p className="text-chrome-muted">You're not clocked in.</p>
          <button type="button" onClick={clockIn} disabled={busy} className="mt-2 h-8 w-full rounded-md bg-[#6f95ff] font-medium text-[#0b1220] hover:bg-[#9bb4ff]">
            Clock in
          </button>
        </>
      )}
    </div>
  )
}

/** The bell: unread count and a popover with the latest notifications. */
function Bell({ onChrome = true }: { onChrome?: boolean }) {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<Notification[] | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = () => notificationsApi.count().then((r) => setUnread(r.unread)).catch(() => {})
    load()
    const id = window.setInterval(load, 60_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!open) return
    notificationsApi.list().then((r) => {
      setItems(r.notifications)
      setUnread(r.unread)
    }).catch(() => setItems([]))
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  /** Marks one notification read and follows it. */
  const openItem = async (n: Notification) => {
    if (!n.read_at) {
      await notificationsApi.read({ ids: [n.id] }).catch(() => {})
      setUnread((u) => Math.max(0, u - 1))
    }
    setOpen(false)
    if (n.task_id) window.location.hash = href('tasks', n.task_id)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cx('relative inline-grid size-9 place-items-center rounded-md', onChrome ? 'text-chrome-ink hover:bg-white/10' : 'text-ink-soft hover:bg-subtle')}
      >
        <Icon name="bell" />
        {unread > 0 && <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#f2786c] px-1 text-[10px] font-semibold text-[#0b1220]">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="fixed inset-x-4 top-16 z-50 max-h-[70dvh] overflow-hidden rounded-lg border border-line bg-surface text-ink shadow-overlay sm:absolute sm:inset-x-auto sm:top-11 sm:left-0 sm:w-[380px] lg:top-0 lg:left-11">
          <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <h2 className="font-semibold">Notifications</h2>
            {unread > 0 && (
              <button
                type="button"
                className="text-[13px] text-primary hover:underline"
                onClick={async () => {
                  await notificationsApi.read({ all: true })
                  setUnread(0)
                  setItems((list) => list?.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) ?? null)
                }}
              >
                Mark all read
              </button>
            )}
          </header>
          <ul className="max-h-[calc(70dvh-48px)] overflow-y-auto">
            {items === null && <li className="px-4 py-6 text-center text-ink-faint">Loading…</li>}
            {items?.length === 0 && <li className="px-4 py-6 text-center text-ink-soft">You're all caught up. New assignments, reviews and comments will show here.</li>}
            {items?.map((n) => (
              <li key={n.id} className="border-b border-line last:border-0">
                <button type="button" onClick={() => openItem(n)} className={cx('flex w-full gap-3 px-4 py-3 text-left hover:bg-subtle', !n.read_at && 'bg-primary-tint/50')}>
                  <span className={cx('mt-1.5 size-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-primary')} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{n.title}</span>
                    {n.body && <span className="line-clamp-2 block text-[13px] text-ink-soft">{n.body}</span>}
                    <span className="block text-[12px] text-ink-faint">{relative(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Cycles system → light → dark. */
function ThemeButton() {
  const [theme, setTheme] = useState<Theme>(savedTheme)
  const next: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
  const icon: Record<Theme, IconName> = { system: 'monitor', light: 'sun', dark: 'moon' }
  const label = { system: 'Theme: match system', light: 'Theme: light', dark: 'Theme: dark' }[theme]
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        const t = next[theme]
        applyTheme(t)
        setTheme(t)
      }}
      className="inline-grid size-9 place-items-center rounded-md text-chrome-muted hover:bg-white/10 hover:text-chrome-ink"
    >
      <Icon name={icon[theme]} />
    </button>
  )
}

/** The whole signed-in frame around a page. */
export function Shell({ section, children }: { section: string; children: ReactNode }) {
  const { me, signOut } = useSession()
  const nav = useNav()
  const tracks = can(me, 'time.track')
  const [menu, setMenu] = useState(false)
  useEffect(() => setMenu(false), [section])

  const links = (
    <ul className="grid gap-0.5">
      {nav.map((n) => {
        const active = n.match === section
        return (
          <li key={n.label}>
            <a
              href={n.to}
              aria-current={active ? 'page' : undefined}
              className={cx('flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium hover:no-underline', active ? 'bg-white/12 text-white' : 'text-chrome-muted hover:bg-white/6 hover:text-chrome-ink')}
            >
              <Icon name={n.icon} />
              {n.label}
            </a>
          </li>
        )
      })}
    </ul>
  )

  const account = (
    <div className="flex items-center gap-2.5">
      <a href={href('account')} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md p-1 hover:bg-white/6 hover:no-underline">
        <Avatar name={me.name} size={32} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-chrome-ink">{me.name}</span>
          <span className="block truncate text-[12px] text-chrome-muted">{me.role.name}{me.department_name ? ` · ${me.department_name}` : ''}</span>
        </span>
      </a>
      <button type="button" onClick={signOut} aria-label="Sign out" title="Sign out" className="inline-grid size-9 place-items-center rounded-md text-chrome-muted hover:bg-white/10 hover:text-chrome-ink">
        <Icon name="logout" />
      </button>
    </div>
  )

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-5 bg-chrome px-3 py-4 lg:flex">
        <div className="flex items-center justify-between px-2">
          <a href={href()} className="flex items-center gap-2 text-[15px] font-semibold text-white hover:no-underline">
            <span className="grid size-7 place-items-center rounded-md bg-[#6f95ff] text-[#0b1220]">
              <Icon name="check" size={16} strokeWidth={2.5} />
            </span>
            Task Tracker
          </a>
          <Bell />
        </div>
        <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto">{links}</nav>
        {tracks && <ClockCard />}
        <div className="flex items-center justify-between gap-1 border-t border-white/10 pt-3">
          <div className="min-w-0 flex-1">{account}</div>
          <ThemeButton />
        </div>
      </aside>

      {/* Phone and tablet top bar */}
      <header className="sticky top-0 z-40 bg-chrome lg:hidden">
        <div className="flex h-14 items-center justify-between gap-2 px-4">
          <a href={href()} className="flex items-center gap-2 text-[15px] font-semibold text-white hover:no-underline">
            <span className="grid size-7 place-items-center rounded-md bg-[#6f95ff] text-[#0b1220]">
              <Icon name="check" size={16} strokeWidth={2.5} />
            </span>
            Task Tracker
          </a>
          <div className="flex items-center gap-1">
            <Bell />
            <ThemeButton />
            <button type="button" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)} className="inline-grid size-9 place-items-center rounded-md text-chrome-ink hover:bg-white/10">
              <Icon name={menu ? 'x' : 'menu'} />
            </button>
          </div>
        </div>
        {menu && (
          <div className="grid gap-4 border-t border-white/10 px-3 pt-3 pb-4">
            <nav aria-label="Main">{links}</nav>
            {tracks && <ClockCard />}
            {account}
          </div>
        )}
      </header>

      <main id="main" className="mx-auto w-full max-w-[1280px] min-w-0 px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-10">
        {children}
      </main>
    </div>
  )
}

/** A quiet floating confirmation. */
export function ToastHost({ message }: { message: string | null }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex justify-center px-4">
      {message && <div className="pointer-events-auto rounded-md bg-chrome px-4 py-2.5 text-sm text-chrome-ink shadow-overlay">{message}</div>}
    </div>
  )
}

