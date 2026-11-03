// Shapes returned by the API. Kept in one place so pages and components agree.

export type Ref = { id: number; name: string }
export type Scope = 'all' | 'department' | 'own'
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'rework' | 'done'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type ProjectStatus = 'planned' | 'active' | 'on_hold' | 'completed'
export type FieldType = 'text' | 'number' | 'date' | 'select' | 'multi_select' | 'checkbox' | 'url'
export type PropertyValue = string | number | boolean | string[]

export type Me = {
  id: number
  name: string
  email: string
  title: string
  department_id: number | null
  department_name: string | null
  role: { id: number; name: string; scope: Scope; is_system: boolean }
  permissions: string[]
}

export type User = {
  id: number
  name: string
  email: string
  title: string
  is_active: boolean
  created_at: string
  department_id: number | null
  role_id: number
  role: { id: number; name: string; scope: Scope }
  department: Ref | null
}

export type UserOption = { id: number; name: string; title: string; department_id: number | null; department_name: string | null }

export type Permission = { key: string; label: string; group: string; description: string }
export type Role = { id: number; name: string; description: string; scope: Scope; is_system: boolean; permissions: string[]; members: number }
export type Department = { id: number; name: string; description: string; head_id: number | null; head: Ref | null; members: number; projects: number }

export type Field = { id: number; key: string; label: string; type: FieldType; options: string[]; required: boolean; position: number }

export type Project = {
  id: number
  key: string
  name: string
  description_md: string | null
  status: ProjectStatus
  start_date: string | null
  deadline: string | null
  completed_at: string | null
  department_id: number | null
  owner_id: number | null
  department: Ref | null
  owner: Ref | null
  task_count: number
  tasks_done: number
  tasks_overdue: number
  tasks_by_status: Partial<Record<TaskStatus, number>>
  progress_pct: number
  overdue: boolean
  fields?: Field[]
  can_manage?: boolean
}

export type TaskRow = {
  id: number
  number: number
  key: string
  title: string
  status: TaskStatus
  priority: Priority
  deadline: string | null
  start_date: string | null
  estimate_minutes: number | null
  labels: string[]
  properties: Record<string, PropertyValue>
  position: number
  created_at: string
  updated_at: string
  completed_at: string | null
  project_id: number
  assignee_id: number | null
  reporter_id: number | null
  project: { id: number; key: string; name: string }
  assignee: Ref | null
  overdue: boolean
  actual_minutes: number
  comment_count: number
}

export type TaskEvent = { id: number; type: string; data: Record<string, unknown>; created_at: string; actor: Ref | null }
export type Review = { id: number; decision: 'approved' | 'changes_requested'; rating: number | null; comment: string | null; created_at: string; reviewer: Ref | null }
export type Comment = { id: number; body_md: string; created_at: string; edited_at: string | null; author_id: number | null; author: Ref | null }

export type Task = TaskRow & {
  body_md: string | null
  reporter: Ref | null
  fields: Field[]
  reviews: Review[]
  events: TaskEvent[]
  comments: Comment[]
  my_running_timer: { id: number; started_at: string } | null
  can: { edit: boolean; assign: boolean; delete: boolean; review: boolean; submit: boolean; comment: boolean; track_time: boolean }
}

export type Notification = {
  id: number
  type: string
  title: string
  body: string | null
  read_at: string | null
  created_at: string
  task_id: number | null
  actor: Ref | null
}

export type ClockStatus = {
  session: { id: number; clock_in: string } | null
  timer: { id: number; started_at: string; task_id: number; task_key: string; task_title: string } | null
  hours_today: number
  task_minutes_today: number
}

export type Session = { id: number; clock_in: string; clock_out: string | null; minutes: number; corrections: number; task_minutes: number }
export type Correction = {
  id: number
  old_clock_in: string
  old_clock_out: string | null
  new_clock_in: string
  new_clock_out: string | null
  reason: string
  created_at: string
  editor: Ref | null
}

export type Range = { from: string; to: string }

export type PersonStats = {
  id: number
  name: string
  email: string
  title: string
  is_active: boolean
  department: Ref | null
  role: Ref
  tasks_done: number
  on_time_pct: number | null
  avg_rating: number | null
  changes_requested: number
  open_tasks: number
  overdue_tasks: number
  in_review: number
  hours_clocked: number
  task_hours: number
  clocked_in_since: string | null
}

export type AttentionTask = { id: number; key: string; title: string; status: TaskStatus; priority: Priority; deadline: string | null; overdue: boolean; project: Ref; assignee: Ref | null }
export type Activity = { id: number; type: string; data: Record<string, unknown>; created_at: string; task_id: number; task_key: string; task_title: string; actor?: Ref | null }

export type Summary = {
  date: string
  scope: Scope
  department: Ref | null
  people: { active: number; inactive: number; clocked_in_now: number; hours_today: number }
  tasks: {
    not_started: number
    pending: number
    in_progress: number
    in_review: number
    rework: number
    completed: number
    completed_this_week: number
    overdue: number
    due_this_week: number
    total: number
  }
  attention: Record<'waiting_review' | 'overdue' | 'due_soon', { count: number; tasks: AttentionTask[] }>
  on_the_clock: { user_id: number; clock_in: string; name: string; department_id: number | null; working_on: string | null }[]
  projects: (Pick<Project, 'id' | 'key' | 'name' | 'status' | 'deadline' | 'overdue' | 'task_count' | 'tasks_done' | 'tasks_overdue' | 'progress_pct'> & {
    by_department: { department_id: number | null; total: number; done: number }[]
  })[]
  departments: {
    id: number
    name: string
    members: number
    active_now: number
    open_tasks: number
    overdue_tasks: number
    completed_tasks: number
    hours_week: number
    timer_hours_week: number
    avg_rating: number | null
    utilization_pct: number | null
  }[]
  hours_trend: { days: string[]; series: { department_id: number | null; values: number[] }[] }
  activity: Activity[]
}
