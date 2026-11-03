// Tasks: every task you can see, as a table or a board, with filters kept in the URL.
import { useState } from 'react'
import { departments as departmentsApi, projects as projectsApi, tasks as tasksApi, users as usersApi } from '../api/endpoints'
import { ImportDialog, NewTaskDialog, TaskBoard, TaskTable } from '../components/tasks'
import { Button, Checkbox, cx, DataState, Field, Input, PageHeader, Segmented, Select, Toolbar } from '../components/ui'
import { plural, priorities, priorityLabel, taskStatusLabel, taskStatuses } from '../lib/format'
import { setParams } from '../lib/router'
import { can, useMe } from '../lib/session'
import { useApi } from '../lib/useApi'

const FILTER_KEYS = ['q', 'status', 'assignee', 'project_id', 'priority', 'department_id', 'overdue', 'label'] as const

/** Reads the filters from the URL. */
function filtersFrom(params: URLSearchParams) {
  return Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ''])) as Record<(typeof FILTER_KEYS)[number], string>
}

/** The Tasks page; `fixed` pins filters (used inside a project page). */
export function Tasks({ params, fixed, embedded }: { params: URLSearchParams; fixed?: { project_id: number }; embedded?: boolean }) {
  const me = useMe()
  const filters = { ...filtersFrom(params), ...(fixed ? { project_id: String(fixed.project_id) } : {}) }
  const view = params.get('view') === 'board' ? 'board' : 'list'
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useState(filters.q)
  const key = JSON.stringify(filters) + view
  const tasks = useApi(() => tasksApi.list({ ...filters, sort: view === 'board' ? 'board' : 'deadline', limit: 500 }), key)
  const projects = useApi(() => (fixed ? Promise.resolve({ projects: [] }) : projectsApi.list()), 'tasks-projects')
  const people = useApi(() => (me.role.scope === 'own' ? Promise.resolve({ users: [] }) : usersApi.options()), 'tasks-people')
  const depts = useApi(() => (me.role.scope === 'all' ? departmentsApi.list() : Promise.resolve({ departments: [] })), 'tasks-depts')

  /** Updates one filter in the URL. */
  const update = (patch: Partial<typeof filters> & { view?: string }) => {
    const next: Record<string, string | undefined> = { ...filtersFrom(params), view: view === 'board' ? 'board' : undefined, ...patch }
    setParams(next)
  }
  const hasFilters = FILTER_KEYS.some((k) => k !== 'project_id' && filters[k]) || (!fixed && filters.project_id)
  const activeFilterCount = FILTER_KEYS.filter((key) => key !== 'project_id' && Boolean(filters[key])).length + (!fixed && filters.project_id ? 1 : 0)

  const header = embedded ? null : (
    <PageHeader
      title="Tasks"
      lede={me.role.scope === 'own' ? 'Work assigned to you or created by you.' : me.role.scope === 'department' ? `Work in ${me.department_name ?? 'your department'}.` : 'Work across the company.'}
      actions={
        can(me, 'tasks.create') && (
          <>
            <Button icon="upload" onClick={() => setImporting(true)}>
              Import .md
            </Button>
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              New task
            </Button>
          </>
        )
      }
    />
  )

  return (
    <>
      {header}
      <Toolbar>
        <form
          className="min-w-0 flex-1 sm:flex-none"
          onSubmit={(e) => {
            e.preventDefault()
            update({ q: search })
          }}
        >
          <Field label="Search">{(id) => <Input id={id} type="search" placeholder="Title or key" value={search} onChange={(e) => setSearch(e.target.value)} onBlur={() => search !== filters.q && update({ q: search })} className="w-full sm:w-52" />}</Field>
        </form>
        <div className="flex items-end gap-2 sm:ml-auto">
          <Button className="sm:hidden" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>
            Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
          </Button>
          <Segmented
            label="View"
            value={view}
            onChange={(v) => update({ view: v === 'board' ? 'board' : undefined })}
            options={[
              { value: 'list', label: 'List' },
              { value: 'board', label: 'Board' },
            ]}
          />
        </div>
        <div className={cx('w-full grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end', filtersOpen ? 'grid' : 'hidden sm:flex')}>
          <Field label="Status">
            {(id) => (
              <Select id={id} value={filters.status} onChange={(e) => update({ status: e.target.value })} className="w-full sm:w-36">
                <option value="">Any</option>
                <option value="todo,in_progress,in_review,rework">Not done</option>
                {taskStatuses.map((s) => <option key={s} value={s}>{taskStatusLabel[s]}</option>)}
              </Select>
            )}
          </Field>
          {me.role.scope !== 'own' && (
            <Field label="Assignee">
              {(id) => (
                <Select id={id} value={filters.assignee} onChange={(e) => update({ assignee: e.target.value })} className="w-full sm:w-40">
                  <option value="">Anyone</option>
                  <option value="me">Me</option>
                  <option value="none">Unassigned</option>
                  {people.data?.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </Select>
              )}
            </Field>
          )}
          {!fixed && (
            <Field label="Project">
              {(id) => (
                <Select id={id} value={filters.project_id} onChange={(e) => update({ project_id: e.target.value })} className="w-full sm:w-44">
                  <option value="">Any</option>
                  {projects.data?.projects.map((p) => <option key={p.id} value={p.id}>{p.key} · {p.name}</option>)}
                </Select>
              )}
            </Field>
          )}
          <Field label="Priority">
            {(id) => (
              <Select id={id} value={filters.priority} onChange={(e) => update({ priority: e.target.value })} className="w-full sm:w-32">
                <option value="">Any</option>
                {priorities.map((p) => <option key={p} value={p}>{priorityLabel[p]}</option>)}
              </Select>
            )}
          </Field>
          {me.role.scope === 'all' && !fixed && (
            <Field label="Department">
              {(id) => (
                <Select id={id} value={filters.department_id} onChange={(e) => update({ department_id: e.target.value })} className="w-full sm:w-40">
                  <option value="">Any</option>
                  {depts.data?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              )}
            </Field>
          )}
          <div className="pb-2">
            <Checkbox label="Overdue only" checked={filters.overdue === 'true'} onChange={(v) => update({ overdue: v ? 'true' : '' })} />
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('')
                setParams({ view: view === 'board' ? 'board' : undefined })
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </Toolbar>

      <DataState state={tasks} isEmpty={(d) => d.tasks.length === 0 && view === 'list'} empty={hasFilters ? 'No tasks match these filters.' : 'No tasks yet. Create one to get started.'}>
        {(d) => (
          <>
            <p className="mb-2 text-[13px] text-ink-soft">{plural(d.tasks.length, 'task')}</p>
            {view === 'board' ? (
              <TaskBoard tasks={d.tasks} onChanged={tasks.reload} />
            ) : (
              <div className="border-0 bg-transparent sm:rounded-lg sm:border sm:border-line sm:bg-surface">
                <TaskTable tasks={d.tasks} showProject={!fixed} />
              </div>
            )}
          </>
        )}
      </DataState>
      <NewTaskDialog open={creating} onClose={() => setCreating(false)} projectId={fixed?.project_id} />
      <ImportDialog open={importing} onClose={() => setImporting(false)} projectId={fixed?.project_id} />
    </>
  )
}

/** Opens the new-task and import dialogs from outside (project page header). */
export function TaskActions({ projectId }: { projectId: number }) {
  const me = useMe()
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  if (!can(me, 'tasks.create')) return null
  return (
    <>
      <Button icon="upload" onClick={() => setImporting(true)}>
        Import .md
      </Button>
      <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
        New task
      </Button>
      <NewTaskDialog open={creating} onClose={() => setCreating(false)} projectId={projectId} />
      <ImportDialog open={importing} onClose={() => setImporting(false)} projectId={projectId} />
    </>
  )
}
