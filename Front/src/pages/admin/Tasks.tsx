import { useState } from 'react'
import {
  Button,
  Check,
  DataState,
  OverdueTag,
  PageHeader,
  Select,
  Sub,
  TableWrap,
  TaskStatusPill,
  Toolbar,
} from '../../components/ui'
import { formatDate, formatMinutes, lastDays, plural, taskStatusLabel, taskStatuses } from '../../lib/format'
import { href } from '../../lib/router'
import { useApi } from '../../lib/useApi'
import { getDashboardTasks, getPeople, getProjects, type TaskFilters } from '../../api/admin/dashboard'
import type { TaskStatus } from '../../api/types'

// Route params pre-fill the filters: #/tasks/overdue, #/tasks/project/3, #/tasks/person/6
function filtersFromRoute(params: string[]): TaskFilters {
  if (params[0] === 'overdue') return { overdue: true }
  if (params[0] === 'project' && Number(params[1])) return { project_id: Number(params[1]) }
  if (params[0] === 'person' && Number(params[1])) return { assigned_to: Number(params[1]) }
  return {}
}

export function Tasks({ params }: { params: string[] }) {
  const [filters, setFilters] = useState<TaskFilters>(() => filtersFromRoute(params))
  const tasks = useApi(() => getDashboardTasks(filters), `tasks-${JSON.stringify(filters)}`)
  const people = useApi(() => getPeople(lastDays(1), 'all'), 'task-filter-people')
  const projects = useApi(() => getProjects(), 'task-filter-projects')
  const update = (patch: Partial<TaskFilters>) => setFilters((f) => ({ ...f, ...patch }))
  const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== false)

  return (
    <>
      <PageHeader title="Tasks" lede="Time spent is the total of task timers, shown against the estimate." />
      <Toolbar>
        <Select
          label="Status"
          value={filters.status ?? ''}
          onChange={(v) => update({ status: (v || undefined) as TaskStatus | undefined })}
        >
          <option value="">Any</option>
          {taskStatuses.map((s) => (
            <option key={s} value={s}>
              {taskStatusLabel[s]}
            </option>
          ))}
        </Select>
        <Select
          label="Assigned to"
          value={filters.assigned_to ?? ''}
          onChange={(v) => update({ assigned_to: v ? Number(v) : undefined })}
        >
          <option value="">Anyone</option>
          {people.data?.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
        <Select
          label="Project"
          value={filters.project_id ?? ''}
          onChange={(v) => update({ project_id: v ? Number(v) : undefined })}
        >
          <option value="">Any</option>
          {projects.data?.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Check
          label="Overdue only"
          checked={Boolean(filters.overdue)}
          onChange={(checked) => update({ overdue: checked || undefined })}
        />
        {hasFilters && <Button onClick={() => setFilters({})}>Clear filters</Button>}
      </Toolbar>

      <DataState
        state={tasks}
        isEmpty={(d) => d.tasks.length === 0}
        empty={hasFilters ? 'No tasks match these filters.' : 'No tasks yet.'}
      >
        {(data) => (
          <>
            <p className="mb-2 text-sm text-ink-soft">{plural(data.tasks.length, 'task')}</p>
            <TableWrap>
              <table className="data-table min-w-[760px]">
                <thead>
                  <tr>
                    <th scope="col">Task</th>
                    <th scope="col">Assigned to</th>
                    <th scope="col">Status</th>
                    <th scope="col">Deadline</th>
                    <th scope="col" className="num">Time spent</th>
                    <th scope="col" className="num">Estimate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tasks.map((t) => {
                    const overEstimate = Boolean(t.estimated_minutes && t.actual_minutes > t.estimated_minutes)
                    return (
                      <tr key={t.id}>
                        <th scope="row">
                          {t.name}
                          <Sub>{t.project?.name ?? 'No project'}</Sub>
                        </th>
                        <td>
                          {t.assignee ? (
                            <a href={href('people', t.assignee.id)}>{t.assignee.name}</a>
                          ) : (
                            <span className="text-ink-faint">Unassigned</span>
                          )}
                        </td>
                        <td>
                          <TaskStatusPill status={t.status} />
                        </td>
                        <td className="whitespace-nowrap">
                          {formatDate(t.deadline)}
                          {t.overdue && <OverdueTag />}
                        </td>
                        <td className={`num ${overEstimate ? 'font-medium text-over' : ''}`}>
                          {t.actual_minutes ? formatMinutes(t.actual_minutes) : '—'}
                        </td>
                        <td className="num">{formatMinutes(t.estimated_minutes)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableWrap>
          </>
        )}
      </DataState>
    </>
  )
}
