import { query, request } from '../client'
import type { Role, TaskStatus } from '../types'

export type ProjectStatus = 'planned' | 'active' | 'completed' | 'on_hold'
export type DayRange = { from: string; to: string }
type Ref = { id: number; name: string }

export type Overview = {
  date: string
  users: { total: number; active: number; admins: number }
  projects: { total: number; by_status: Record<ProjectStatus, number> }
  tasks: { total: number; by_status: Record<TaskStatus, number>; overdue: number }
  attendance: { clocked_in_now: number; hours_today: number }
}

export type UserSummary = {
  id: number
  name: string
  email: string
  role: Role
  is_active: boolean
  department: Ref | null
  tasks_done: number
  open_tasks: number
  overdue_tasks: number
  on_time_pct: number | null
  avg_rating: number | null
  reviews_needing_rework: number
  rework_bounces: number
  hours_clocked: number
  clocked_in: boolean
  clocked_in_since: string | null
}

export type RankMetric = 'tasks_done' | 'on_time_pct' | 'avg_rating' | 'hours_clocked' | 'rework_bounces'
export type RankedUser = UserSummary & { rank: number | null }

export type DashboardTask = {
  id: number
  name: string
  description?: string | null
  status: TaskStatus
  deadline: string | null
  estimated_minutes: number | null
  created_at: string
  completed_at: string | null
  project: Ref | null
  assignee?: Ref | null
  completer?: Ref | null
  overdue: boolean
  actual_minutes: number
}

export type PersonDetail = {
  range: DayRange
  user: UserSummary
  tasks: DashboardTask[]
  daily_hours: { day: string; hours_clocked: number }[]
  recent_sessions: { id: number; clock_in: string; clock_out: string | null; minutes: number }[]
  recent_time_logs: { id: number; started_at: string; ended_at: string | null; minutes: number; task: Ref | null }[]
  recent_reviews: { id: number; rating: number; needed_rework: boolean; comments: string | null; reviewed_at: string; task: Ref }[]
}

export type ProjectSummary = {
  id: number
  name: string
  description: string | null
  status: ProjectStatus
  deadline: string | null
  created_at: string
  completed_at: string | null
  creator: Ref | null
  overdue: boolean
  task_count: number
  tasks_done: number
  tasks_overdue: number
  tasks_by_status: Record<TaskStatus, number>
  progress_pct: number
}

export type Attendance = {
  range: DayRange
  clocked_in_now: { user_id: number; name: string | null; clock_in: string; minutes_so_far: number }[]
  daily_hours: { user_id: number; name: string | null; day: string; hours_clocked: number }[]
}

export type TaskFilters = {
  status?: TaskStatus
  project_id?: number
  assigned_to?: number
  overdue?: boolean
}

const dashboard = '/api/admin/dashboard'

export function getOverview() {
  return request<Overview>(`${dashboard}/overview`)
}

export function getPeople(range: DayRange, role: Role | 'all' = 'user') {
  return request<{ range: DayRange; users: UserSummary[] }>(`${dashboard}/users${query({ role, ...range })}`)
}

export function getPerson(id: number, range: DayRange) {
  return request<PersonDetail>(`${dashboard}/users/${id}${query(range)}`)
}

export function getProjects(status?: ProjectStatus) {
  return request<{ projects: ProjectSummary[] }>(`${dashboard}/projects${query({ status })}`)
}

export function getDashboardTasks(filters: TaskFilters) {
  return request<{ tasks: DashboardTask[] }>(`${dashboard}/tasks${query({ ...filters, limit: 200 })}`)
}

export function getRanking(by: RankMetric, range: DayRange) {
  return request<{ by: RankMetric; order: 'asc' | 'desc'; range: DayRange; users: RankedUser[] }>(
    `${dashboard}/rank${query({ by, ...range })}`,
  )
}

export function getAttendance(range: DayRange) {
  return request<Attendance>(`${dashboard}/attendance${query(range)}`)
}

// ---- Overview summary (GET /api/admin/dashboard/summary) ---------------------

export type AttentionTask = {
  id: number
  name: string
  status: TaskStatus
  deadline: string | null
  overdue: boolean
  project: Ref | null
  assignee: Ref | null
}

export type DepartmentSummary = {
  id: number | null
  name: string
  // Fixed chart colour slot: 1–4 are series colours, 0 or 5 means "other".
  slot: number
  members: number
  active_now: number
  open_tasks: number
  overdue_tasks: number
  completed_tasks: number
  hours_week: number
  timer_hours_week: number
  utilization_pct: number | null
  avg_rating: number | null
}

export type ProjectProgress = {
  id: number
  name: string
  status: ProjectStatus
  deadline: string | null
  overdue: boolean
  task_count: number
  tasks_done: number
  tasks_overdue: number
  progress_pct: number
  by_department: { department_id: number | null; unassigned: boolean; total: number; done: number }[]
}

export type DashboardSummary = {
  date: string
  people: { active: number; inactive: number; admins: number; clocked_in_now: number; hours_today: number }
  tasks: {
    total: number
    not_started: number
    pending: number
    in_progress: number
    in_review: number
    rework: number
    completed: number
    overdue: number
    completed_this_week: number
    due_this_week: number
  }
  projects: ProjectProgress[]
  departments: DepartmentSummary[]
  attention: Record<'waiting_review' | 'overdue' | 'due_soon', { count: number; tasks: AttentionTask[] }>
  on_the_clock: { user_id: number; name: string | null; department_id: number | null; clock_in: string }[]
  hours_trend: { days: string[]; series: { department_id: number | null; values: number[] }[] }
  activity: {
    id: number
    old_status: TaskStatus | null
    new_status: TaskStatus
    changed_at: string
    task: Ref | null
    actor: Ref | null
  }[]
}

export function getSummary() {
  return request<DashboardSummary>(`${dashboard}/summary`)
}
