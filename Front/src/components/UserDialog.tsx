import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useApi } from '../lib/useApi'
import { ApiError } from '../api/client'
import { createUser, deleteUser, getDepartments, updateUser, type ManagedUser, type UserChanges } from '../api/admin/users'
import type { Role } from '../api/types'
import { Button } from './ui'

export type EditableUser = {
  id: number
  name: string
  email: string
  role: Role
  is_active: boolean
  department: { id: number; name: string } | null
}

type Props = {
  // Omit `user` to add a new person.
  user?: EditableUser
  isSelf?: boolean
  onClose: () => void
  onSaved: (user: ManagedUser, message: string) => void
  onDeleted?: (name: string) => void
}

const inputClass =
  'min-h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-ink focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/15 disabled:bg-canvas disabled:text-ink-soft'

// Add or edit a person. Rendered only while open; it opens itself as a modal on mount.
export function UserDialog({ user, isSelf = false, onClose, onSaved, onDeleted }: Props) {
  const editing = Boolean(user)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const departments = useApi(getDepartments, 'departments')

  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [role, setRole] = useState<Role>(user?.role ?? 'user')
  const [departmentId, setDepartmentId] = useState<number | null>(user?.department?.id ?? null)
  const [active, setActive] = useState(user?.is_active ?? true)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!user) {
      setSaving(true)
      try {
        const { user: created } = await createUser({ name, email, password, role, department_id: departmentId })
        onSaved(created, `${created.name} was added. They can sign in with the password you set.`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not add this person.')
        setSaving(false)
      }
      return
    }

    // Send only what changed.
    const changes: UserChanges = {}
    if (name.trim() !== user.name) changes.name = name
    if (email.trim().toLowerCase() !== user.email.toLowerCase()) changes.email = email
    if (role !== user.role) changes.role = role
    if (departmentId !== (user.department?.id ?? null)) changes.department_id = departmentId
    if (active !== user.is_active) changes.is_active = active
    if (password) changes.password = password

    if (Object.keys(changes).length === 0) {
      onClose()
      return
    }

    setSaving(true)
    try {
      const { user: updated } = await updateUser(user.id, changes)
      onSaved(updated, `Changes to ${updated.name} were saved.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save these changes.')
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault()
        if (!saving) onClose()
      }}
      aria-labelledby="user-dialog-title"
      className="m-auto max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg bg-surface p-0 text-ink shadow-xl backdrop:bg-chrome/60"
    >
      <form onSubmit={handleSubmit} className="grid gap-5 p-6 sm:p-8">
        <header>
          <h2 id="user-dialog-title" className="text-2xl font-semibold">
            {editing ? `Edit ${user!.name}` : 'Add a person'}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {editing
              ? 'Changes apply the next time they load a page.'
              : 'They sign in with their name or email and the password you set here.'}
          </p>
        </header>

        <Field label="Name" hint="Also their username for signing in.">
          {(id) => (
            <input
              id={id}
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={60}
              pattern="[^@]*"
              title="Name can't contain @"
              autoComplete="off"
            />
          )}
        </Field>

        <Field label="Email">
          {(id) => (
            <input
              id={id}
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
              autoComplete="off"
            />
          )}
        </Field>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Role</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { value: 'user', label: 'Team member', hint: 'Sees their own tasks' },
                { value: 'admin', label: 'Admin', hint: 'Sees and manages everyone' },
              ] as const
            ).map((option) => (
              <label
                key={option.value}
                className={`flex gap-2.5 rounded-md border border-line-strong px-3 py-2.5 has-checked:border-primary has-checked:bg-primary-tint ${isSelf ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                <input
                  type="radio"
                  name="role"
                  value={option.value}
                  checked={role === option.value}
                  onChange={() => setRole(option.value)}
                  disabled={isSelf}
                  className="mt-1 accent-primary"
                />
                <span>
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="block text-xs text-ink-soft">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {isSelf && <p className="mt-1.5 text-xs text-ink-soft">You can't change your own role.</p>}
        </fieldset>

        <Field
          label="Department"
          hint={
            departments.loading && !departments.data
              ? 'Loading departments…'
              : departments.data?.departments.length === 0
                ? 'No departments exist yet, so this person will have none for now.'
                : undefined
          }
        >
          {(id) => (
            <>
              <select
                id={id}
                className={inputClass}
                value={departmentId ?? ''}
                onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : null)}
                disabled={!departments.data}
              >
                <option value="">No department</option>
                {departments.data?.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              {departments.error && (
                <p className="flex flex-wrap items-center gap-x-3 text-xs text-danger" role="alert">
                  Couldn't load departments: {departments.error}
                  <button
                    type="button"
                    onClick={departments.reload}
                    className="cursor-pointer font-medium underline underline-offset-2"
                  >
                    Try again
                  </button>
                </p>
              )}
            </>
          )}
        </Field>

        <Field
          label={editing ? 'New password' : 'Password'}
          hint={editing ? 'Leave blank to keep their current password.' : 'At least 8 characters. Share it with them privately.'}
        >
          {(id) => (
            <input
              id={id}
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!editing}
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
            />
          )}
        </Field>

        {editing && (
          <label className={`flex items-start gap-2.5 ${isSelf ? 'opacity-60' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              className="mt-1 size-4 accent-primary"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={isSelf}
            />
            <span>
              <span className="block text-sm font-medium">Account active</span>
              <span className="block text-xs text-ink-soft">
                {isSelf
                  ? "You can't deactivate your own account."
                  : 'Deactivated people can’t sign in. Their tasks and hours are kept.'}
              </span>
            </span>
          </label>
        )}

        {error && (
          <p className="rounded-md border border-danger/30 bg-danger-tint px-3 py-2.5 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-5">
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add person'}
          </Button>
        </div>

        {editing && !isSelf && (
          <DeleteZone
            user={user!}
            disabled={saving}
            onDeleted={() => onDeleted?.(user!.name)}
            onDeactivated={(updated) => onSaved(updated, `${updated.name} was deactivated. Their history is kept.`)}
          />
        )}
      </form>
    </dialog>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = `field-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  )
}

// Permanent delete only works for people with no history; otherwise offer to deactivate.
function DeleteZone({
  user,
  disabled,
  onDeleted,
  onDeactivated,
}: {
  user: EditableUser
  disabled: boolean
  onDeleted: () => void
  onDeactivated: (user: ManagedUser) => void
}) {
  const [stage, setStage] = useState<'idle' | 'confirm' | 'working'>('idle')
  const [blocked, setBlocked] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    setStage('working')
    setError(null)
    try {
      await deleteUser(user.id)
      onDeleted()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setBlocked(err.message)
      else setError(err instanceof Error ? err.message : 'Could not delete this person.')
      setStage('idle')
    }
  }

  async function deactivate() {
    setStage('working')
    try {
      const { user: updated } = await updateUser(user.id, { is_active: false })
      onDeactivated(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not deactivate this person.')
      setStage('idle')
    }
  }

  return (
    <section aria-labelledby="delete-title" className="rounded-md border border-danger/25 p-4">
      <h3 id="delete-title" className="text-base font-semibold">
        Delete {user.name}
      </h3>

      {blocked ? (
        <>
          <p className="mt-1 text-sm text-ink" role="alert">
            {blocked}
          </p>
          {user.is_active && (
            <Button className="mt-3" onClick={deactivate} disabled={disabled || stage === 'working'}>
              {stage === 'working' ? 'Deactivating…' : `Deactivate ${user.name}`}
            </Button>
          )}
        </>
      ) : stage === 'idle' ? (
        <>
          <p className="mt-1 text-sm text-ink-soft">
            Only for people added by mistake. Anyone with tasks or hours should be deactivated instead.
          </p>
          <Button variant="dangerQuiet" className="mt-3" onClick={() => setStage('confirm')} disabled={disabled}>
            Delete person
          </Button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink">This removes {user.name} permanently and can't be undone.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button variant="danger" onClick={remove} disabled={stage === 'working'}>
              {stage === 'working' ? 'Deleting…' : 'Delete permanently'}
            </Button>
            <Button onClick={() => setStage('idle')} disabled={stage === 'working'}>
              Keep {user.name}
            </Button>
          </div>
        </>
      )}

      {error && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
