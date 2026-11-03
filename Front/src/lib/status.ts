import type { ProjectStatus } from '../api/admin/dashboard'
import type { TaskStatus } from '../api/types'

// Class strings are written out in full so Tailwind can find them.
export const taskStatusDot: Record<TaskStatus, string> = {
  todo: 'bg-status-todo',
  in_progress: 'bg-status-progress',
  in_review: 'bg-status-review',
  done: 'bg-status-done',
  rework: 'bg-status-rework',
}

export const taskStatusText: Record<TaskStatus, string> = {
  todo: 'text-ink-soft',
  in_progress: 'text-status-progress',
  in_review: 'text-status-review',
  done: 'text-status-done',
  rework: 'text-status-rework',
}

export const projectStatusDot: Record<ProjectStatus, string> = {
  planned: 'bg-status-todo',
  active: 'bg-status-progress',
  completed: 'bg-status-done',
  on_hold: 'bg-status-rework',
}

// Department chart colours by fixed slot (design system: series-1 to series-4, then series-other).
const seriesFill = ['bg-series-other', 'bg-series-1', 'bg-series-2', 'bg-series-3', 'bg-series-4', 'bg-series-other']

export function departmentFill(slot: number) {
  return seriesFill[slot] ?? 'bg-series-other'
}
