// Your account: details and changing your password.
import { useState } from 'react'
import { auth } from '../api/endpoints'
import { Button, Field, Input, Notice, PageHeader, Panel, Prop } from '../components/ui'
import { scopeLabel } from '../lib/format'
import { useMe } from '../lib/session'
import { toast } from '../lib/toast'
import { useAction } from '../lib/useApi'

/** The Account page. */
export function Account() {
  const me = useMe()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const { busy, error, setError, run } = useAction()
  return (
    <>
      <PageHeader title="Your account" />
      <div className="grid max-w-3xl gap-6">
        <Panel title="Details">
          <dl className="divide-y divide-line">
            <Prop label="Name">{me.name}</Prop>
            <Prop label="Email">{me.email}</Prop>
            <Prop label="Job title">{me.title || '—'}</Prop>
            <Prop label="Department">{me.department_name ?? '—'}</Prop>
            <Prop label="Role">{me.role.name}</Prop>
            <Prop label="Sees">{scopeLabel[me.role.scope]}</Prop>
          </dl>
          <p className="mt-3 text-[13px] text-ink-faint">Ask an admin to change your name, email, role or department.</p>
        </Panel>
        <Panel title="Change password">
          <form
            className="grid max-w-sm gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (next !== confirm) return setError('The new passwords don’t match.')
              void run(async () => {
                await auth.changePassword(current, next)
                setCurrent('')
                setNext('')
                setConfirm('')
                toast('Password changed')
              })
            }}
          >
            {error && <Notice tone="danger">{error}</Notice>}
            <Field label="Current password">{(id) => <Input id={id} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />}</Field>
            <Field label="New password" hint="At least 8 characters.">{(id) => <Input id={id} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />}</Field>
            <Field label="Repeat new password">{(id) => <Input id={id} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />}</Field>
            <div>
              <Button type="submit" variant="primary" busy={busy}>
                Change password
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </>
  )
}
