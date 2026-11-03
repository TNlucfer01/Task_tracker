import type { ReactNode } from 'react'
import { href } from '../lib/router'
import type { User } from '../api/types'
import { Button } from './ui'

const nav = [
  { key: '', label: 'Overview', permission: 'dashboard.view', icon: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z' },
  { key: 'people', label: 'People', permission: 'people.view', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
  { key: 'projects', label: 'Projects', permission: 'dashboard.view', icon: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
  { key: 'tasks', label: 'Tasks', permission: 'dashboard.view', icon: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9' },
  { key: 'attendance', label: 'Attendance', permission: 'dashboard.view', icon: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0' },
]

function NavIcon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[18px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

export function AppShell({
  user,
  section,
  onSignOut,
  signingOut,
  children,
}: {
  user: User
  section: string
  onSignOut: () => void
  signingOut: boolean
  children: ReactNode
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="sticky top-0 z-20 flex flex-col bg-chrome text-chrome-ink lg:h-screen">
        <div className="flex items-center justify-between gap-4 px-4 pt-4 lg:px-5 lg:pt-6">
          <Brand onChrome />
          <Button variant="onDark" className="lg:hidden" onClick={onSignOut} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
        <nav aria-label="Admin" className="overflow-x-auto px-2 lg:mt-8 lg:px-3">
          <ul className="flex gap-1 py-2 lg:flex-col lg:py-0">
            {nav.filter((item) => user.permissions.includes(item.permission)).map((item) => (
              <li key={item.key}>
                <a
                  href={href(item.key)}
                  aria-current={section === item.key ? 'page' : undefined}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-chrome-muted no-underline hover:bg-white/8 hover:text-chrome-ink aria-[current=page]:bg-white/12 aria-[current=page]:text-chrome-ink"
                >
                  <NavIcon d={item.icon} />
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-auto hidden border-t border-white/10 px-5 py-5 lg:block">
          <p className="mb-3 flex items-center gap-3">
            <span
              className="grid size-9 place-items-center rounded-full bg-white/12 text-sm font-semibold text-chrome-ink"
              aria-hidden="true"
            >
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong className="block text-sm font-medium">{user.name}</strong>
              <span className="text-xs text-chrome-muted">{user.role_name}</span>
            </span>
          </p>
          <Button variant="onDark" onClick={onSignOut} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-[1280px] px-4 pt-8 pb-16 sm:px-8 lg:px-10 lg:pt-10">{children}</main>
    </div>
  )
}

export function Brand({ onChrome = false }: { onChrome?: boolean }) {
  return (
    <a
      href={href()}
      className={`flex items-center gap-2.5 text-base font-semibold no-underline ${onChrome ? 'text-chrome-ink hover:text-chrome-ink' : 'text-ink hover:text-ink'}`}
    >
      <ClockMark onChrome={onChrome} />
      Task Tracker
    </a>
  )
}

export function ClockMark({ onChrome = false }: { onChrome?: boolean }) {
  return (
    <svg className={`size-7 ${onChrome ? 'text-chrome-ink' : 'text-primary'}`} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="7" fill="currentColor" opacity={onChrome ? 0.14 : 0.12} />
      <circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path d="M16 11v5l3.5 2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}
