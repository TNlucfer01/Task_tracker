import type { ReactNode } from 'react'
import { href } from '../lib/router'
import type { User } from '../utils/api'
import { Button } from './ui'

const nav = [
  { key: '', label: 'Overview' },
  { key: 'people', label: 'People' },
  { key: 'projects', label: 'Projects' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'attendance', label: 'Attendance' },
]

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
    <div className="min-h-screen lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="sticky top-0 z-10 flex flex-col border-b border-line bg-panel lg:h-screen lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-4 px-4 pt-4 lg:px-6 lg:pt-7">
          <Brand />
          <Button className="lg:hidden" onClick={onSignOut} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
        <nav aria-label="Admin" className="overflow-x-auto px-2 lg:mt-8 lg:px-3">
          <ul className="flex gap-1 py-2 lg:flex-col lg:py-0">
            {nav.map((item) => (
              <li key={item.key}>
                <a
                  href={href(item.key)}
                  aria-current={section === item.key ? 'page' : undefined}
                  className="block rounded-md px-3 py-2 whitespace-nowrap text-ink-soft no-underline hover:bg-paper hover:text-ink aria-[current=page]:bg-stamp-tint aria-[current=page]:font-medium aria-[current=page]:text-stamp"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-auto hidden border-t border-line px-6 py-5 lg:block">
          <p className="mb-3">
            <strong className="block font-medium">{user.name}</strong>
            <span className="text-sm text-ink-soft">Admin</span>
          </p>
          <Button onClick={onSignOut} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-[1180px] px-4 pt-8 pb-16 sm:px-8 lg:px-12 lg:pt-12">{children}</main>
    </div>
  )
}

export function Brand() {
  return (
    <a href={href()} className="flex items-center gap-2.5 font-display text-lg font-semibold text-ink no-underline">
      <ClockMark />
      Task Tracker
    </a>
  )
}

export function ClockMark() {
  return (
    <svg className="size-7 text-stamp" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M16 8.5V16l5 3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
