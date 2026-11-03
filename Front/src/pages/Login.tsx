// Sign in with a username or email.
import { useState } from 'react'
import { auth } from '../api/endpoints'
import type { Me } from '../api/types'
import { Icon } from '../components/icons'
import { Button, Field, Input, Notice } from '../components/ui'
import { useAction } from '../lib/useApi'

/** The sign-in screen. */
export function Login({ onSignedIn }: { onSignedIn: (me: Me) => void }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const { busy, error, run } = useAction()

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="hidden flex-col justify-between bg-chrome p-12 text-chrome-ink lg:flex">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-white">
          <span className="grid size-7 place-items-center rounded-md bg-[#6f95ff] text-[#0b1220]">
            <Icon name="check" size={16} strokeWidth={2.5} />
          </span>
          Task Tracker
        </p>
        <div className="max-w-md">
          <p className="text-[32px] leading-10 font-semibold tracking-[-0.01em] text-white">Every team's work, in one place.</p>
          <p className="mt-4 text-chrome-muted">Plan projects, hand work in for review, and see how each department is doing, without chasing anyone for an update.</p>
        </div>
        <ul className="grid gap-2 text-sm text-chrome-muted">
          <li>Tasks are Markdown pages with their own properties.</li>
          <li>Reviews keep quality visible: approve or send back with a note.</li>
          <li>Clock in and time your tasks; managers see hours by department.</li>
        </ul>
      </section>
      <section className="grid place-items-center px-4 py-12">
        <form
          className="grid w-full max-w-sm gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            void run(async () => onSignedIn((await auth.login(identifier, password)).user))
          }}
        >
          <p className="flex items-center gap-2 text-[15px] font-semibold lg:hidden">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-on-primary">
              <Icon name="check" size={16} strokeWidth={2.5} />
            </span>
            Task Tracker
          </p>
          <div>
            <h1 className="text-[26px] leading-8 font-semibold">Sign in</h1>
            <p className="mt-1 text-ink-soft">Use the username or email your admin gave you.</p>
          </div>
          {error && <Notice tone="danger">{error}</Notice>}
          <Field label="Username or email">{(id) => <Input id={id} autoComplete="username" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoFocus />}</Field>
          <Field label="Password">{(id) => <Input id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
          <Button type="submit" variant="primary" busy={busy} className="w-full">
            Sign in
          </Button>
          <p className="text-[13px] text-ink-faint">Forgot your password? Ask an admin to reset it from Settings.</p>
        </form>
      </section>
    </div>
  )
}
