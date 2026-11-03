// One project: overview with description and progress, its tasks (list or board), and the custom
// fields editor for people who manage it.
import { useState } from 'react'
import { projects as projectsApi } from '../api/endpoints'
import type { Field as FieldDef, FieldType, Project } from '../api/types'
import { Markdown } from '../components/MarkdownEditor'
import { Button, Checkbox, ConfirmButton, DataState, Dialog, Field, Input, KpiStrip, Notice, OverdueTag, Panel, ProgressBar, ProjectStatusBadge, Select, StatusBadge, Tabs } from '../components/ui'
import { formatDate, plural, taskStatuses } from '../lib/format'
import { go, href, setParams } from '../lib/router'
import { toast } from '../lib/toast'
import { useAction, useApi } from '../lib/useApi'
import { ProjectDialog } from './Projects'
import { TaskActions, Tasks } from './Tasks'

const fieldTypes: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select (one option)' },
  { value: 'multi_select', label: 'Multi-select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'url', label: 'Link' },
]

/** Add or edit one custom field. */
function FieldDialog({ project, field, onClose, onSaved }: { project: Project; field?: FieldDef; onClose: () => void; onSaved: (f: FieldDef[]) => void }) {
  const [label, setLabel] = useState(field?.label ?? '')
  const [type, setType] = useState<FieldType>(field?.type ?? 'text')
  const [options, setOptions] = useState((field?.options ?? []).join(', '))
  const [required, setRequired] = useState(field?.required ?? false)
  const { busy, error, run } = useAction()
  const hasOptions = type === 'select' || type === 'multi_select'
  const save = () =>
    run(async () => {
      const body = { label, required, ...(hasOptions ? { options: options.split(',').map((o) => o.trim()).filter(Boolean) } : {}) }
      const r = field ? await projectsApi.updateField(project.id, field.id, body) : await projectsApi.addField(project.id, { ...body, type })
      onSaved(r.fields)
      toast(field ? 'Field saved' : `${label} added`)
      onClose()
    })
  return (
    <Dialog
      open
      onClose={onClose}
      title={field ? `Edit ${field.label}` : 'Add a field'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy} disabled={!label.trim() || (hasOptions && !options.trim())} onClick={save}>
            {field ? 'Save field' : 'Add field'}
          </Button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={(e) => (e.preventDefault(), void save())}>
        {error && <Notice tone="danger">{error}</Notice>}
        <Field label="Field name">{(id) => <Input id={id} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="e.g. Component" required />}</Field>
        <Field label="Type" hint={field ? "A field's type can't change after it's created." : undefined}>
          {(id) => (
            <Select id={id} value={type} disabled={Boolean(field)} onChange={(e) => setType(e.target.value as FieldType)}>
              {fieldTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {hasOptions && <Field label="Options" hint="Comma separated">{(id) => <Input id={id} value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Frontend, Backend, Infra" />}</Field>}
        <Checkbox label="Required before submitting for review" checked={required} onChange={setRequired} />
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}

/** The custom fields list and editor. */
function FieldsPanel({ project, onChange }: { project: Project; onChange: (fields: FieldDef[]) => void }) {
  const [editing, setEditing] = useState<FieldDef | 'new' | null>(null)
  const fields = project.fields ?? []
  return (
    <Panel title="Task fields" actions={project.can_manage && <Button size="sm" icon="plus" onClick={() => setEditing('new')}>Add field</Button>}>
      <p className="mb-3 text-ink-soft">Every task in {project.name} gets these properties, shown beside its description and in its .md front matter.</p>
      {fields.length === 0 ? (
        <p className="text-ink-faint">No custom fields yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {fields.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="font-medium">{f.label}</span>
                <span className="ml-2 text-[13px] text-ink-faint">
                  {fieldTypes.find((t) => t.value === f.type)?.label}
                  {f.options.length ? ` · ${f.options.join(', ')}` : ''}
                  {f.required ? ' · required' : ''}
                </span>
              </span>
              {project.can_manage && (
                <span className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(f)}>
                    Edit
                  </Button>
                  <ConfirmButton
                    size="sm"
                    label="Remove"
                    title={`Remove ${f.label}?`}
                    confirm="Its values are removed from every task in this project."
                    onConfirm={async () => {
                      await projectsApi.removeField(project.id, f.id)
                      onChange(fields.filter((x) => x.id !== f.id))
                      toast(`${f.label} removed`)
                    }}
                  />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && <FieldDialog project={project} field={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={onChange} />}
    </Panel>
  )
}

/** The project page. */
export function ProjectPage({ id, params }: { id: number; params: URLSearchParams }) {
  const state = useApi(() => projectsApi.get(id).then((r) => r.project), `project-${id}`)
  const tab = (params.get('tab') as 'tasks' | 'overview' | 'fields') || 'tasks'
  const [editing, setEditing] = useState(false)

  return (
    <DataState state={state}>
      {(p) => (
        <>
          <a href={href('projects')} className="mb-2 inline-block text-[13px] text-ink-soft hover:text-ink">
            Projects
          </a>
          <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="flex items-center gap-3 text-[13px] text-ink-faint">
                {p.key}
                <ProjectStatusBadge status={p.status} />
              </p>
              <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.01em]">{p.name}</h1>
              <p className="mt-1 text-ink-soft">
                {p.department?.name ?? 'Cross-department'}
                {p.owner ? ` · Owner ${p.owner.name}` : ''} · Due {formatDate(p.deadline)}
                {p.overdue && <OverdueTag />}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {p.can_manage && (
                <Button icon="edit" onClick={() => setEditing(true)}>
                  Edit project
                </Button>
              )}
              {p.status !== 'completed' && <TaskActions projectId={p.id} />}
            </div>
          </header>

          <Tabs
            value={tab}
            onChange={(t) => setParams({ tab: t === 'tasks' ? undefined : t })}
            tabs={[
              { value: 'tasks', label: `Tasks (${p.task_count})` },
              { value: 'overview', label: 'Overview' },
              { value: 'fields', label: `Fields (${p.fields?.length ?? 0})` },
            ]}
          />

          {tab === 'tasks' && <Tasks params={params} fixed={{ project_id: p.id }} embedded />}
          {tab === 'overview' && (
            <div className="grid gap-6">
              <KpiStrip
                items={[
                  { label: 'Progress', value: `${p.progress_pct}%`, hint: `${p.tasks_done} of ${plural(p.task_count, 'task')} done` },
                  { label: 'Open', value: p.task_count - p.tasks_done },
                  { label: 'In review', value: p.tasks_by_status.in_review ?? 0 },
                  { label: 'Overdue tasks', value: p.tasks_overdue, tone: p.tasks_overdue ? 'danger' : undefined },
                ]}
              />
              <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <Panel title="About this project">{p.description_md?.trim() ? <Markdown text={p.description_md} /> : <p className="text-ink-faint">No description yet.</p>}</Panel>
                <Panel title="By status">
                  <ProgressBar
                    value={p.progress_pct}
                    label="Tasks by status"
                    segments={taskStatuses.map((s) => ({ value: p.task_count ? (100 * (p.tasks_by_status[s] ?? 0)) / p.task_count : 0, color: `var(--status-${s === 'in_progress' ? 'progress' : s === 'in_review' ? 'review' : s})`, label: s }))}
                  />
                  <ul className="mt-4 grid gap-2">
                    {taskStatuses.map((s) => (
                      <li key={s} className="flex items-center justify-between">
                        <StatusBadge status={s} />
                        <a href={href('projects', p.id, { status: s })} className="text-[13px] tabular-nums">
                          {p.tasks_by_status[s] ?? 0}
                        </a>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
              {p.can_manage && p.task_count === 0 && (
                <div>
                  <ConfirmButton
                    label="Delete project"
                    icon="trash"
                    title={`Delete ${p.name}?`}
                    confirm="This project has no tasks, so it can be deleted. This can't be undone."
                    onConfirm={async () => {
                      await projectsApi.remove(p.id)
                      toast(`${p.name} deleted`)
                      go('projects')
                    }}
                  />
                </div>
              )}
            </div>
          )}
          {tab === 'fields' && <FieldsPanel project={p} onChange={(fields) => state.set({ ...p, fields })} />}
          {editing && <ProjectDialog open project={p} onClose={() => setEditing(false)} onSaved={state.reload} />}
        </>
      )}
    </DataState>
  )
}
