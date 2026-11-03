import type { ProjectStatus } from '../api/admin/dashboard'
import type { TaskStatus } from '../api/types'

// Class strings are written out in full so Tailwind can find them.
export const taskStatusDot: Record<TaskStatus, string> = {
  todo: 'bg-todo',
  in_progress: 'bg-progress',
  in_review: 'bg-review',
  done: 'bg-done',
  rework: 'bg-rework',
}

export const taskStatusText: Record<TaskStatus, string> = {
  todo: 'text-ink-soft',
  in_progress: 'text-progress',
  in_review: 'text-review',
  done: 'text-done',
  rework: 'text-rework',
}

export const projectStatusDot: Record<ProjectStatus, string> = {
  planned: 'bg-todo',
  active: 'bg-progress',
  completed: 'bg-done',
  on_hold: 'bg-rework',
}
