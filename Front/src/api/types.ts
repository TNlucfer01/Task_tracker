export type Role = 'admin' | 'user'

export type User = {
  id: number
  name: string
  email: string
  role: Role
  department_id: number | null
}

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'rework'

export type Task = {
  id: number
  name: string
  description: string | null
  status: TaskStatus
  deadline: string | null
  estimated_minutes: number | null
  created_at: string
  completed_at: string | null
  project_id: number
  assigned_to: number | null
  project: { id: number; name: string } | null
}
