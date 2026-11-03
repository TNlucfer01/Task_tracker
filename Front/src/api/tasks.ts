import { request } from './client'
import type { Task } from './types'

export function getTasks() {
  return request<{ tasks: Task[] }>('/api/tasks')
}
