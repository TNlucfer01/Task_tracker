const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'

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

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw new ApiError("Can't reach the server. Check that the backend is running.", 0)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
        ? body.error
        : 'The request could not be completed.'

    throw new ApiError(message, response.status)
  }

  return body as T
}

export function login(identifier: string, password: string) {
  return request<{ user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  })
}

export function getCurrentUser() {
  return request<{ user: User }>('/api/auth/me')
}

export function getTasks() {
  return request<{ tasks: Task[] }>('/api/tasks')
}

export function logout() {
  return request<void>('/api/auth/logout', { method: 'POST' })
}

// ---- Admin dashboard -------------------------------------------------------

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

function query(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
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

// ---- Admin user management -------------------------------------------------

export type Department = { id: number; name: string; description: string | null }

export type ManagedUser = {
  id: number
  name: string
  email: string
  role: Role
  is_active: boolean
  department_id: number | null
  department: Ref | null
  created_at: string
}

export type NewUser = {
  name: string
  email: string
  password: string
  role: Role
  department_id: number | null
}

export type UserChanges = Partial<Omit<NewUser, 'password'>> & { is_active?: boolean; password?: string }

export function getDepartments() {
  return request<{ departments: Department[] }>('/api/admin/department')
}

export function createUser(user: NewUser) {
  return request<{ user: ManagedUser }>('/api/admin/users', { method: 'POST', body: JSON.stringify(user) })
}

export function updateUser(id: number, changes: UserChanges) {
  return request<{ user: ManagedUser }>(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(changes) })
}

export function deleteUser(id: number) {
  return request<void>(`/api/admin/users/${id}`, { method: 'DELETE' })
}
