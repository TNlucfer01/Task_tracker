export type Role = string
export type DataScope = 'all' | 'department' | 'own'

export type User = {
  id: number
  name: string
  email: string
  role: Role
  role_id: number
  role_name: string
  scope: DataScope
  permissions: string[]
  department_id: number | null
  title: string | null
}

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'rework'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type Task = {
  id: number
  number: number
  name: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  deadline: string | null
  estimated_minutes: number | null
  created_at: string
  completed_at: string | null
  project_id: number
  assigned_to: number | null
  project: { id: number; name: string } | null
}
