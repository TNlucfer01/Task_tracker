import { useState, type FormEvent } from 'react'
import { ClockMark } from '../components/AppShell'
import { Button } from '../components/ui'
import { login, type User } from '../utils/api'

const inputClass =
  'min-h-11 w-full rounded-md border border-line-strong bg-panel px-3 text-ink focus:border-stamp focus:outline-none focus:ring-3 focus:ring-stamp/15'

export function Login({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const { user } = await login(identifier, password)
      setPassword('')
      onSignedIn(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="hidden flex-col justify-between bg-stamp-deep p-12 text-white lg:flex">
        <p className="flex items-center gap-2.5 font-display text-lg font-semibold [&_svg]:text-white">
          <ClockMark />
          Task Tracker
        </p>
        <p className="max-w-md font-display text-[40px] leading-[1.1] font-semibold tracking-tight">
          Clock in, do the work, and let the hours speak for themselves.
        </p>
        <p className="text-white/70">Time tracking and task management for your team.</p>
      </div>

      <section aria-labelledby="login-title" className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <p className="mb-10 flex items-center gap-2.5 font-display text-lg font-semibold lg:hidden">
            <ClockMark />
            Task Tracker
          </p>
          <h1 className="text-[34px] leading-tight font-bold tracking-tight">Sign in</h1>
          <p className="mt-2 mb-8 text-ink-soft">
            Admins see the team dashboard. Everyone else sees the tasks assigned to them.
          </p>

          <form className="grid gap-2" onSubmit={handleSubmit}>
            <label htmlFor="identifier" className="text-sm font-medium">
              Username or email
            </label>
            <input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              className={inputClass}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              maxLength={320}
            />

            <label htmlFor="password" className="mt-3 text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              maxLength={1024}
            />

            {error && (
              <p className="mt-3 rounded-md border border-over/30 bg-over-tint px-3 py-2.5 text-sm text-over" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" variant="primary" className="mt-5" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </section>
    </main>
  )
}
