import { useState } from 'react'
import { DataState, Meter, OverdueTag, PageHeader, ProjectStatusPill, Segmented, Toolbar } from '../../components/ui'
import { formatDate, plural, projectStatusLabel, projectStatuses, taskStatusLabel, taskStatuses } from '../../lib/format'
import { href } from '../../lib/router'
import { useApi } from '../../lib/useApi'
import { getProjects, type ProjectStatus } from '../../api/admin/dashboard'

const filterOptions: { value: ProjectStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  ...projectStatuses.map((s) => ({ value: s, label: projectStatusLabel[s] })),
]

export function Projects() {
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all')
  const status = filter === 'all' ? undefined : filter
  const projects = useApi(() => getProjects(status), `projects-${filter}`)

  return (
    <>
      <PageHeader title="Projects" lede="Progress is the share of a project's tasks that are done." />
      <Toolbar>
        <Segmented label="Project status" options={filterOptions} value={filter} onChange={setFilter} />
      </Toolbar>

      <DataState
        state={projects}
        isEmpty={(d) => d.projects.length === 0}
        empty={status ? `No ${projectStatusLabel[status].toLowerCase()} projects.` : 'No projects yet.'}
      >
        {(data) => (
          <ul className="border-t border-line-strong">
            {data.projects.map((p) => (
              <li key={p.id} className="grid gap-x-10 gap-y-4 border-b border-line py-6 md:grid-cols-[minmax(0,1fr)_320px]">
                <div>
                  <h2 className="text-xl font-semibold">{p.name}</h2>
                  {p.description && <p className="mt-1 max-w-[65ch] text-ink-soft">{p.description}</p>}
                  <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
                    <ProjectStatusPill status={p.status} />
                    <span>
                      Due {formatDate(p.deadline)}
                      {p.overdue && <OverdueTag />}
                    </span>
                    {p.creator && <span>Created by {p.creator.name}</span>}
                  </p>
                </div>
                <div className="grid content-start gap-2">
                  <p className="flex items-baseline gap-2.5">
                    <strong className="font-display text-[28px] leading-none font-semibold">
                      {Math.round(p.progress_pct)}%
                    </strong>
                    <span className="text-sm text-ink-soft">
                      {p.tasks_done} of {plural(p.task_count, 'task')} done
                    </span>
                  </p>
                  <Meter value={p.progress_pct} label={`${Math.round(p.progress_pct)}% done`} />
                  {p.task_count > 0 && (
                    <p className="text-sm text-ink-soft">
                      {taskStatuses
                        .filter((s) => p.tasks_by_status[s])
                        .map((s) => `${taskStatusLabel[s]} ${p.tasks_by_status[s]}`)
                        .join(', ')}
                      {p.tasks_overdue > 0 && <span className="font-medium text-danger">, {p.tasks_overdue} overdue</span>}
                    </p>
                  )}
                  <a href={href('tasks', 'project', p.id)} className="text-sm">
                    See tasks
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DataState>
    </>
  )
}
