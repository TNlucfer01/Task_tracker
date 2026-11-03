// Projects: every project you can see with progress, plus creating a project.
import { useState } from 'react'
import { departments as departmentsApi, projects as projectsApi, users as usersApi } from '../api/endpoints'
import type { ProjectStatus } from '../api/types'
import { MarkdownEditor } from '../components/MarkdownEditor'
import { Button, DataState, Dialog, Field, Input, Notice, OverdueTag, PageHeader, ProgressBar, ProjectStatusBadge, Segmented, Select, Toolbar } from '../components/ui'
import { formatDate, plural, projectStatusLabel, projectStatuses } from '../lib/format'
import { go, href } from '../lib/router'
import { can, useMe } from '../lib/session'
import { toast } from '../lib/toast'
import { useAction, useApi } from '../lib/useApi'

/** Create or edit a project's basics. */
export function ProjectDialog({ open, onClose, project, onSaved }: { open: boolean; onClose: () => void; project?: import('../api/types').Project; onSaved?: () => void }) {
  const me = useMe()
  const depts = useApi(() => departmentsApi.list(), `pd-depts-${open}`)
  const people = useApi(() => usersApi.options(), `pd-people-${open}`)
  const [form, setForm] = useState(() => ({
    key: project?.key ?? '',
    name: project?.name ?? '',
    description_md: project?.description_md ?? '',
    status: project?.status ?? ('active' as ProjectStatus),
    department_id: project?.department_id ?? (me.role.scope === 'department' ? me.department_id : null) ?? ('' as number | ''),
    owner_id: project?.owner_id ?? me.id,
    start_date: project?.start_date ?? '',
    deadline: project?.deadline ? new Date(project.deadline).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '',
  }))
  const { busy, error, run } = useAction()
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const save = () =>
    run(async () => {
      const body = {
        ...form,
        key: form.key.toUpperCase(),
        department_id: form.department_id === '' ? null : form.department_id,
        owner_id: form.owner_id || null,
        start_date: form.start_date || null,
        deadline: form.deadline ? new Date(`${form.deadline}T18:00:00+05:30`).toISOString() : null,
      }
      if (project) {
        await projectsApi.update(project.id, body)
        toast('Project saved')
        onSaved?.()
        onClose()
      } else {
        const { project: p } = await projectsApi.create(body)
        toast(`${p.name} created`)
        onClose()
        go('projects', p.id)
      }
    })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title={project ? 'Edit project' : 'New project'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy} onClick={save} disabled={!form.name.trim() || !form.key.trim()}>
            {project ? 'Save changes' : 'Create project'}
          </Button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={(e) => (e.preventDefault(), void save())}>
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
          <Field label="Key" hint="Starts task numbers, e.g. CPR-12">
            {(id) => <Input id={id} value={form.key} maxLength={10} onChange={(e) => set({ key: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} required />}
          </Field>
          <Field label="Name">{(id) => <Input id={id} value={form.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} required />}</Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Status">
            {(id) => (
              <Select id={id} value={form.status} onChange={(e) => set({ status: e.target.value as ProjectStatus })}>
                {projectStatuses.map((s) => (
                  <option key={s} value={s}>
                    {projectStatusLabel[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Department">
            {(id) => (
              <Select id={id} value={form.department_id ?? ''} disabled={me.role.scope === 'department'} onChange={(e) => set({ department_id: e.target.value ? Number(e.target.value) : '' })}>
                <option value="">Cross-department</option>
                {depts.data?.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Owner">
            {(id) => (
              <Select id={id} value={form.owner_id ?? ''} onChange={(e) => set({ owner_id: Number(e.target.value) || me.id })}>
                {people.data?.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Start date">{(id) => <Input id={id} type="date" value={form.start_date} onChange={(e) => set({ start_date: e.target.value })} />}</Field>
          <Field label="Deadline">{(id) => <Input id={id} type="date" value={form.deadline} onChange={(e) => set({ deadline: e.target.value })} />}</Field>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-soft">Description</p>
          <MarkdownEditor label="Project description" value={form.description_md} onChange={(v) => set({ description_md: v })} minRows={6} />
        </div>
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}

/** The Projects page. */
export function Projects() {
  const me = useMe()
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all')
  const [creating, setCreating] = useState(false)
  const list = useApi(() => projectsApi.list(filter === 'all' ? undefined : filter), `projects-${filter}`)

  return (
    <>
      <PageHeader
        title="Projects"
        lede="Progress is the share of a project's tasks that are done."
        actions={can(me, 'projects.manage') && <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>New project</Button>}
      />
      <Toolbar>
        <Segmented label="Project status" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, ...projectStatuses.map((s) => ({ value: s, label: projectStatusLabel[s] }))]} />
      </Toolbar>
      <DataState state={list} isEmpty={(d) => d.projects.length === 0} empty={filter === 'all' ? 'No projects yet. Create one to start adding tasks.' : `No ${projectStatusLabel[filter].toLowerCase()} projects.`}>
        {(d) => (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {d.projects.map((p) => (
              <li key={p.id}>
                <a href={href('projects', p.id)} className="flex h-full flex-col gap-3 rounded-lg border border-line bg-surface p-5 text-ink hover:border-line-strong hover:no-underline">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-ink-faint">{p.key}</p>
                      <h2 className="text-[17px] leading-6 font-semibold">{p.name}</h2>
                    </div>
                    <ProjectStatusBadge status={p.status} />
                  </div>
                  <p className="text-[13px] text-ink-soft">
                    {p.department?.name ?? 'Cross-department'}
                    {p.owner ? ` · Owner ${p.owner.name}` : ''}
                  </p>
                  <div className="mt-auto grid gap-1.5">
                    <div className="flex items-baseline justify-between text-[13px]">
                      <span>
                        <strong className="text-[17px] font-semibold">{p.progress_pct}%</strong> <span className="text-ink-soft">· {p.tasks_done} of {plural(p.task_count, 'task')}</span>
                      </span>
                      <span className="text-ink-soft">
                        Due {formatDate(p.deadline)}
                        {p.overdue && <OverdueTag />}
                      </span>
                    </div>
                    <ProgressBar value={p.progress_pct} label={`${p.progress_pct}% done`} />
                    {p.tasks_overdue > 0 && <p className="text-[13px] font-medium text-danger">{plural(p.tasks_overdue, 'task')} overdue</p>}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </DataState>
      {creating && <ProjectDialog open onClose={() => setCreating(false)} />}
    </>
  )
}
