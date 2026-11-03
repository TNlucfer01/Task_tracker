// Settings for admins and managers: people accounts, roles with permissions, and departments.
import { useState } from 'react'
import { departments as departmentsApi, roles as rolesApi, users as usersApi } from '../api/endpoints'
import type { Department, Role, Scope, User } from '../api/types'
import { Chip as Badge, Button, Checkbox, ConfirmButton, DataState, Dialog, Empty, Field, Input, Notice, PageHeader, PersonLink, Select, TableWrap, Tabs, Textarea, Toolbar } from '../components/ui'
import { formatDate, scopeLabel } from '../lib/format'
import { go } from '../lib/router'
import { can, useMe } from '../lib/session'
import { toast } from '../lib/toast'
import { useAction, useApi } from '../lib/useApi'

/** Add or edit an account. */
function UserDialog({ user, roles, departments, onClose, onSaved }: { user?: User; roles: Role[]; departments: Department[]; onClose: () => void; onSaved: () => void }) {
  const me = useMe()
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    title: user?.title ?? '',
    role_id: user?.role_id ?? roles.find((r) => r.name === 'Employee')?.id ?? roles[0]?.id ?? 0,
    department_id: user?.department_id ?? ('' as number | ''),
    password: '',
    is_active: user?.is_active ?? true,
  })
  const { busy, error, run } = useAction()
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }))
  const self = user?.id === me.id
  const grantable = roles.filter((r) => !r.is_system || me.role.is_system)

  const save = () =>
    run(async () => {
      const body: Record<string, unknown> = { name: form.name, email: form.email, title: form.title, department_id: form.department_id === '' ? null : form.department_id }
      if (!self) Object.assign(body, { role_id: form.role_id, is_active: form.is_active })
      if (form.password) body.password = form.password
      if (user) await usersApi.update(user.id, body)
      else await usersApi.create({ ...body, role_id: form.role_id, password: form.password })
      toast(user ? `${form.name} saved` : `${form.name} was added`)
      onSaved()
      onClose()
    })

  return (
    <Dialog
      open
      onClose={onClose}
      title={user ? `Edit ${user.name}` : 'Add person'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy} onClick={save} disabled={!form.name || !form.email || (!user && form.password.length < 8)}>
            {user ? 'Save changes' : 'Add person'}
          </Button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={(e) => (e.preventDefault(), void save())}>
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username" hint="Used to sign in and for @mentions">{(id) => <Input id={id} value={form.name} onChange={(e) => set({ name: e.target.value })} required />}</Field>
          <Field label="Email">{(id) => <Input id={id} type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} required />}</Field>
          <Field label="Job title">{(id) => <Input id={id} value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Frontend developer" />}</Field>
          <Field label="Department">
            {(id) => (
              <Select id={id} value={form.department_id} onChange={(e) => set({ department_id: e.target.value ? Number(e.target.value) : '' })}>
                <option value="">No department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Role" hint={self ? "You can't change your own role." : scopeLabel[roles.find((r) => r.id === form.role_id)?.scope ?? 'own']}>
            {(id) => (
              <Select id={id} value={form.role_id} disabled={self} onChange={(e) => set({ role_id: Number(e.target.value) })}>
                {grantable.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={user ? 'New password' : 'Password'} hint={user ? 'Leave empty to keep the current one' : 'At least 8 characters; share it with them privately'}>
            {(id) => <Input id={id} type="password" autoComplete="new-password" value={form.password} onChange={(e) => set({ password: e.target.value })} required={!user} />}
          </Field>
        </div>
        {user && !self && <Checkbox label="Active" hint="Inactive people can't sign in; their history is kept." checked={form.is_active} onChange={(v) => set({ is_active: v })} />}
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}

/** The people accounts tab. */
function UsersTab() {
  const me = useMe()
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('')
  const [active, setActive] = useState('true')
  const [editing, setEditing] = useState<User | 'new' | null>(null)
  const list = useApi(() => usersApi.list({ q, department_id: dept, active }), `settings-users-${q}-${dept}-${active}`)
  const roles = useApi(() => rolesApi.list(), 'settings-user-roles')
  const depts = useApi(() => departmentsApi.list(), 'settings-user-depts')
  const ready = roles.data && depts.data
  return (
    <>
      <Toolbar>
        <Input type="search" aria-label="Search people" placeholder="Search name, email or title" value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-64" />
        <Select aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)} className="w-full sm:w-44">
          <option value="">All departments</option>
          {depts.data?.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Status" value={active} onChange={(e) => setActive(e.target.value)} className="w-full sm:w-32">
          <option value="true">Active</option>
          <option value="false">Inactive</option>
          <option value="">Everyone</option>
        </Select>
        <div className="ml-auto">
          <Button variant="primary" icon="plus" disabled={!ready} onClick={() => setEditing('new')}>
            Add person
          </Button>
        </div>
      </Toolbar>
      <DataState state={list} isEmpty={(d) => d.users.length === 0} empty="Nobody matches.">
        {(d) => (
          <>
            <div className="hidden rounded-lg border border-line bg-surface sm:block">
              <TableWrap>
                <table className="data-table min-w-[760px]">
                  <thead>
                    <tr>
                      <th scope="col">Person</th>
                      <th scope="col">Role</th>
                      <th scope="col">Department</th>
                      <th scope="col">Added</th>
                      <th scope="col"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.users.map((u) => (
                      <tr key={u.id} className={u.is_active ? '' : 'opacity-60'}>
                        <th scope="row" className="font-normal">
                          <PersonLink person={u} />
                          <span className="block pl-[30px] text-[12px] text-ink-faint">{u.email}{u.title ? ` · ${u.title}` : ''}</span>
                        </th>
                        <td><Badge>{u.role.name}</Badge></td>
                        <td>{u.department?.name ?? '—'}</td>
                        <td>{formatDate(u.created_at)}</td>
                        <td className="text-right whitespace-nowrap">
                          {can(me, 'people.view') && <Button size="sm" variant="ghost" onClick={() => go('people', u.id)}>Work</Button>}
                          <Button size="sm" variant="ghost" disabled={!ready} onClick={() => setEditing(u)}>Edit</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </div>
            <ul className="mobile-records sm:hidden">
              {d.users.map((u) => (
                <li key={u.id} className={`mobile-record ${u.is_active ? '' : 'opacity-60'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <PersonLink person={u} />
                      <p className="mt-1 break-all text-[13px] text-ink-faint">{u.email}</p>
                      {u.title && <p className="text-[13px] text-ink-faint">{u.title}</p>}
                    </div>
                    <Badge>{u.role.name}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13px] text-ink-soft">{u.department?.name ?? 'No department'} · Added {formatDate(u.created_at)}</span>
                    <span className="flex gap-1">
                      {can(me, 'people.view') && <Button size="sm" variant="ghost" onClick={() => go('people', u.id)}>Work</Button>}
                      <Button size="sm" variant="ghost" disabled={!ready} onClick={() => setEditing(u)}>Edit</Button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </DataState>
      {editing && ready && (
        <UserDialog user={editing === 'new' ? undefined : editing} roles={roles.data!.roles} departments={depts.data!.departments} onClose={() => setEditing(null)} onSaved={list.reload} />
      )}
    </>
  )
}

/** Create or edit a role: name, data scope and permission checkboxes by group. */
function RoleDialog({ role, onClose, onSaved }: { role?: Role; onClose: () => void; onSaved: () => void }) {
  const catalogue = useApi(() => rolesApi.permissions(), 'permission-catalogue')
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [scope, setScope] = useState<Scope>(role?.scope ?? 'own')
  const [perms, setPerms] = useState<Set<string>>(new Set(role?.permissions ?? ['time.track', 'tasks.create']))
  const { busy, error, run } = useAction()
  const locked = Boolean(role?.is_system)
  const groups = new Map<string, NonNullable<typeof catalogue.data>['permissions']>()
  for (const p of catalogue.data?.permissions ?? []) groups.set(p.group, [...(groups.get(p.group) ?? []), p])

  const save = () =>
    run(async () => {
      const body = locked ? { name, description } : { name, description, scope, permissions: [...perms] }
      if (role) await rolesApi.update(role.id, body)
      else await rolesApi.create(body)
      toast(role ? `${name} saved` : `${name} role created`)
      onSaved()
      onClose()
    })

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={role ? `Edit ${role.name}` : 'New role'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy} disabled={name.trim().length < 2} onClick={save}>
            {role ? 'Save role' : 'Create role'}
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        {error && <Notice tone="danger">{error}</Notice>}
        {locked && <Notice>The Admin role always has every permission and sees the whole company.</Notice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. QA lead" />}</Field>
          <Field label="Sees">
            {(id) => (
              <Select id={id} value={scope} disabled={locked} onChange={(e) => setScope(e.target.value as Scope)}>
                {(Object.keys(scopeLabel) as Scope[]).map((s) => (
                  <option key={s} value={s}>
                    {scopeLabel[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Description">{(id) => <Textarea id={id} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} className="min-h-16" />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          {[...groups.entries()].map(([group, list]) => (
            <fieldset key={group} className="rounded-md border border-line p-4">
              <legend className="px-1 text-[13px] font-medium text-ink-soft">{group}</legend>
              <div className="grid gap-3">
                {list.map((p) => (
                  <Checkbox
                    key={p.key}
                    label={p.label}
                    hint={p.description}
                    disabled={locked}
                    checked={locked || perms.has(p.key)}
                    onChange={(on) =>
                      setPerms((s) => {
                        const n = new Set(s)
                        if (on) n.add(p.key)
                        else n.delete(p.key)
                        return n
                      })
                    }
                  />
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </div>
    </Dialog>
  )
}

/** The roles tab. */
function RolesTab() {
  const list = useApi(() => rolesApi.list(), 'settings-roles')
  const catalogue = useApi(() => rolesApi.permissions(), 'settings-roles-catalogue')
  const [editing, setEditing] = useState<Role | 'new' | null>(null)
  const label = (key: string) => catalogue.data?.permissions.find((p) => p.key === key)?.label ?? key
  return (
    <>
      <Toolbar>
        <p className="max-w-[70ch] text-ink-soft">A role sets what someone can do and how much of the company they see. Give each person one role in their account.</p>
        <div className="ml-auto">
          <Button variant="primary" icon="plus" onClick={() => setEditing('new')}>
            New role
          </Button>
        </div>
      </Toolbar>
      <DataState state={list}>
        {(d) => (
          <ul className="grid gap-3 lg:grid-cols-2">
            {d.roles.map((r) => (
              <li key={r.id} className="rounded-lg border border-line bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[17px] font-semibold">
                      {r.name} {r.is_system && <Badge>System</Badge>}
                    </h3>
                    <p className="text-[13px] text-ink-soft">
                      {scopeLabel[r.scope]} · {r.members} {r.members === 1 ? 'person' : 'people'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setEditing(r)}>
                      Edit
                    </Button>
                    {!r.is_system && r.members === 0 && (
                      <ConfirmButton
                        size="sm"
                        label="Delete"
                        title={`Delete ${r.name}?`}
                        confirm="Nobody has this role, so it can be deleted."
                        onConfirm={async () => {
                          await rolesApi.remove(r.id)
                          toast(`${r.name} deleted`)
                          list.reload()
                        }}
                      />
                    )}
                  </div>
                </div>
                {r.description && <p className="mt-2 text-ink-soft">{r.description}</p>}
                {(() => {
                  const permissionKeys = r.is_system ? catalogue.data?.permissions.map((p) => p.key) ?? [] : r.permissions
                  const groups = new Map<string, string[]>()
                  for (const key of permissionKeys) {
                    const group = catalogue.data?.permissions.find((p) => p.key === key)?.group ?? 'Other'
                    groups.set(group, [...(groups.get(group) ?? []), key])
                  }
                  return permissionKeys.length ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {[...groups.entries()].map(([group, keys]) => (
                        <section key={group} className="min-w-0 rounded-md bg-subtle/60 p-3">
                          <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">{group}</h4>
                          <ul className="flex flex-wrap gap-1.5">
                            {keys.map((key) => <li key={key}><Badge>{label(key)}</Badge></li>)}
                          </ul>
                        </section>
                      ))}
                    </div>
                  ) : <p className="mt-4 text-[13px] text-ink-faint">No permissions — can only see their own work.</p>
                })()}
              </li>
            ))}
          </ul>
        )}
      </DataState>
      {editing && <RoleDialog role={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={list.reload} />}
    </>
  )
}

/** Create or edit a department. */
function DepartmentDialog({ department, onClose, onSaved }: { department?: Department; onClose: () => void; onSaved: () => void }) {
  const people = useApi(() => usersApi.options(), 'dept-people')
  const [name, setName] = useState(department?.name ?? '')
  const [description, setDescription] = useState(department?.description ?? '')
  const [head, setHead] = useState<number | ''>(department?.head_id ?? '')
  const { busy, error, run } = useAction()
  const save = () =>
    run(async () => {
      const body = { name, description, head_id: head === '' ? null : head }
      if (department) await departmentsApi.update(department.id, body)
      else await departmentsApi.create(body)
      toast(department ? `${name} saved` : `${name} created`)
      onSaved()
      onClose()
    })
  return (
    <Dialog
      open
      onClose={onClose}
      title={department ? `Edit ${department.name}` : 'New department'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy} disabled={name.trim().length < 2} onClick={save}>
            {department ? 'Save department' : 'Create department'}
          </Button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={(e) => (e.preventDefault(), void save())}>
        {error && <Notice tone="danger">{error}</Notice>}
        <Field label="Name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />}</Field>
        <Field label="Head" hint="Reviews work from this department when the project owner can't.">
          {(id) => (
            <Select id={id} value={head} onChange={(e) => setHead(e.target.value ? Number(e.target.value) : '')}>
              <option value="">No head</option>
              {people.data?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.department_name ? ` · ${u.department_name}` : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Description">{(id) => <Textarea id={id} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} className="min-h-16" />}</Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}

/** The departments tab. */
function DepartmentsTab() {
  const me = useMe()
  const list = useApi(() => departmentsApi.list(), 'settings-depts')
  const [editing, setEditing] = useState<Department | 'new' | null>(null)
  const manage = can(me, 'departments.manage')
  return (
    <>
      {manage && (
        <Toolbar>
          <div className="ml-auto">
            <Button variant="primary" icon="plus" onClick={() => setEditing('new')}>
              New department
            </Button>
          </div>
        </Toolbar>
      )}
      <DataState state={list} isEmpty={(d) => d.departments.length === 0} empty="No departments yet.">
        {(d) => (
          <>
            <div className="hidden rounded-lg border border-line bg-surface sm:block">
              <TableWrap>
                <table className="data-table min-w-[640px]">
                  <thead>
                    <tr>
                      <th scope="col">Department</th>
                      <th scope="col">Head</th>
                      <th scope="col" className="num">People</th>
                      <th scope="col" className="num">Projects</th>
                      {manage && <th scope="col"><span className="sr-only">Actions</span></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {d.departments.map((x) => (
                      <tr key={x.id}>
                        <th scope="row" className="font-normal"><span className="font-medium">{x.name}</span>{x.description && <span className="block text-[12px] text-ink-faint">{x.description}</span>}</th>
                        <td><PersonLink person={x.head} /></td>
                        <td className="num">{x.members}</td>
                        <td className="num">{x.projects}</td>
                        {manage && (
                          <td className="text-right whitespace-nowrap">
                            <Button size="sm" variant="ghost" onClick={() => setEditing(x)}>Edit</Button>
                            {x.members === 0 && x.projects === 0 && <ConfirmButton size="sm" variant="ghost" label="Delete" title={`Delete ${x.name}?`} confirm="This department is empty, so it can be deleted." onConfirm={async () => { await departmentsApi.remove(x.id); toast(`${x.name} deleted`); list.reload() }} />}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </div>
            <ul className="mobile-records sm:hidden">
              {d.departments.map((x) => (
                <li key={x.id} className="mobile-record">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><h2 className="font-semibold">{x.name}</h2>{x.description && <p className="mt-1 text-[13px] text-ink-soft">{x.description}</p>}</div>
                    {manage && <Button size="sm" variant="ghost" onClick={() => setEditing(x)}>Edit</Button>}
                  </div>
                  <div className="mobile-record-grid">
                    <div><span className="mobile-record-label">Department head</span><span className="mobile-record-value"><PersonLink person={x.head} /></span></div>
                    <div><span className="mobile-record-label">People · projects</span><span className="mobile-record-value">{x.members} · {x.projects}</span></div>
                  </div>
                  {manage && x.members === 0 && x.projects === 0 && <div className="mt-3"><ConfirmButton size="sm" variant="ghost" label="Delete department" title={`Delete ${x.name}?`} confirm="This department is empty, so it can be deleted." onConfirm={async () => { await departmentsApi.remove(x.id); toast(`${x.name} deleted`); list.reload() }} /></div>}
                </li>
              ))}
            </ul>
          </>
        )}
      </DataState>
      {editing && <DepartmentDialog department={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={list.reload} />}
    </>
  )
}

/** The Settings page; the tab comes from the URL (#/settings/roles). */
export function Settings({ tab }: { tab?: string }) {
  const me = useMe()
  const tabs = [
    ...(can(me, 'people.manage') ? [{ value: 'people', label: 'People' }] : []),
    ...(can(me, 'roles.manage') ? [{ value: 'roles', label: 'Roles & permissions' }] : []),
    ...(can(me, 'departments.manage') || can(me, 'people.manage') ? [{ value: 'departments', label: 'Departments' }] : []),
  ]
  const current = tabs.find((t) => t.value === tab)?.value ?? tabs[0]?.value
  if (!current) return <Empty>Your role doesn't include any settings.</Empty>
  return (
    <>
      <PageHeader title="Settings" />
      <Tabs value={current} onChange={(v) => go('settings', v)} tabs={tabs} />
      {current === 'people' && <UsersTab />}
      {current === 'roles' && <RolesTab />}
      {current === 'departments' && <DepartmentsTab />}
    </>
  )
}
