// Every API endpoint the app uses, grouped by module. Pages call these, never fetch directly.
import { api, query } from './client'
import type {
  Activity, ClockStatus, Correction, Department, Field, Me, Notification, Permission, PersonStats, Project, ProjectStatus,
  Range, Review, Role, Session, Summary, Task, TaskRow, User, UserOption, Comment,
} from './types'

type Q = Record<string, string | number | boolean | null | undefined>

export const auth = {
  /** Signs in with a username or email. */
  login: (identifier: string, password: string) => api.post<{ user: Me }>('/auth/login', { identifier, password }),
  /** Ends the session. */
  logout: () => api.post<void>('/auth/logout'),
  /** The signed-in person, with role and permissions. */
  me: () => api.get<{ user: Me }>('/auth/me'),
  /** Changes your own password. */
  changePassword: (current_password: string, new_password: string) => api.post<void>('/auth/password', { current_password, new_password }),
}

export const users = {
  /** Active people you can see, for pickers. */
  options: () => api.get<{ users: UserOption[] }>('/users/options'),
  /** Accounts, with filters. */
  list: (q: Q = {}) => api.get<{ users: User[] }>('/users' + query(q)),
  /** Creates an account. */
  create: (body: Record<string, unknown>) => api.post<{ user: User }>('/users', body),
  /** Edits an account. */
  update: (id: number, body: Record<string, unknown>) => api.patch<{ user: User }>(`/users/${id}`, body),
  /** Deletes an account with no history. */
  remove: (id: number) => api.del(`/users/${id}`),
}

export const roles = {
  /** The permission catalogue. */
  permissions: () => api.get<{ permissions: Permission[] }>('/roles/permissions'),
  /** Every role with its permissions and member count. */
  list: () => api.get<{ roles: Role[] }>('/roles'),
  /** Creates a role. */
  create: (body: Partial<Role>) => api.post<{ role: Role }>('/roles', body),
  /** Edits a role. */
  update: (id: number, body: Partial<Role>) => api.patch<{ role: Role }>(`/roles/${id}`, body),
  /** Deletes an unused role. */
  remove: (id: number) => api.del(`/roles/${id}`),
}

export const departments = {
  /** All departments. */
  list: () => api.get<{ departments: Department[] }>('/departments'),
  /** Creates a department. */
  create: (body: Partial<Department>) => api.post<{ department: Department }>('/departments', body),
  /** Edits a department. */
  update: (id: number, body: Partial<Department>) => api.patch<{ department: Department }>(`/departments/${id}`, body),
  /** Deletes an empty department. */
  remove: (id: number) => api.del(`/departments/${id}`),
}

export const projects = {
  /** Projects you can see. */
  list: (status?: ProjectStatus) => api.get<{ projects: Project[] }>('/projects' + query({ status })),
  /** One project with its custom fields. */
  get: (id: number) => api.get<{ project: Project }>(`/projects/${id}`),
  /** Creates a project. */
  create: (body: Record<string, unknown>) => api.post<{ project: Project }>('/projects', body),
  /** Edits a project. */
  update: (id: number, body: Record<string, unknown>) => api.patch<{ project: Project }>(`/projects/${id}`, body),
  /** Deletes a project with no tasks. */
  remove: (id: number) => api.del(`/projects/${id}`),
  /** Adds a custom field. */
  addField: (id: number, body: Partial<Field>) => api.post<{ fields: Field[] }>(`/projects/${id}/fields`, body),
  /** Edits a custom field. */
  updateField: (id: number, fieldId: number, body: Partial<Field>) => api.patch<{ fields: Field[] }>(`/projects/${id}/fields/${fieldId}`, body),
  /** Removes a custom field (and its values on tasks). */
  removeField: (id: number, fieldId: number) => api.del(`/projects/${id}/fields/${fieldId}`),
}

export const tasks = {
  /** Tasks you can see, with filters. */
  list: (q: Q = {}) => api.get<{ tasks: TaskRow[] }>('/tasks' + query(q)),
  /** The full task page. */
  get: (id: number) => api.get<{ task: Task }>(`/tasks/${id}`),
  /** Creates a task. */
  create: (body: Record<string, unknown>) => api.post<{ task: Task }>('/tasks', body),
  /** Edits a task. */
  update: (id: number, body: Record<string, unknown>) => api.patch<{ task: Task }>(`/tasks/${id}`, body),
  /** Deletes a task. */
  remove: (id: number) => api.del(`/tasks/${id}`),
  /** Hands the task in for review. */
  submit: (id: number) => api.post<{ task: Task }>(`/tasks/${id}/submit`),
  /** Approves or sends back a task. */
  review: (id: number, body: { decision: Review['decision']; rating?: number; comment?: string }) => api.post<{ task: Task }>(`/tasks/${id}/reviews`, body),
  /** The task as a Markdown file. */
  markdown: (id: number) => api.get<string>(`/tasks/${id}/markdown`),
  /** Creates a task from a Markdown file. */
  importMarkdown: (project_id: number, markdown: string) => api.post<{ task: Task }>('/tasks/import', { project_id, markdown }),
  /** Adds a comment. */
  comment: (id: number, body_md: string) => api.post<{ comment: Comment }>(`/tasks/${id}/comments`, { body_md }),
  /** Edits your comment. */
  editComment: (commentId: number, body_md: string) => api.patch<{ comment: Comment }>(`/comments/${commentId}`, { body_md }),
  /** Deletes a comment. */
  deleteComment: (commentId: number) => api.del(`/comments/${commentId}`),
}

export const notifications = {
  /** Your latest notifications. */
  list: (unread = false) => api.get<{ notifications: Notification[]; unread: number }>('/notifications' + query({ unread })),
  /** Unread count for the bell. */
  count: () => api.get<{ unread: number }>('/notifications/count'),
  /** Marks some or all as read. */
  read: (body: { ids?: number[]; all?: boolean }) => api.post<void>('/notifications/read', body),
}

export const time = {
  /** Your clock state. */
  me: () => api.get<ClockStatus>('/time/me'),
  /** Starts your work session. */
  clockIn: () => api.post<ClockStatus>('/time/clock-in'),
  /** Ends your work session. */
  clockOut: () => api.post<ClockStatus>('/time/clock-out'),
  /** Starts a timer on a task. */
  startTimer: (task_id: number) => api.post<ClockStatus>('/time/timer/start', { task_id }),
  /** Stops your timer. */
  stopTimer: () => api.post<ClockStatus>('/time/timer/stop'),
  /** Someone's work sessions. */
  sessions: (q: Q = {}) => api.get<{ range: Range; sessions: Session[]; can_correct: boolean }>('/time/sessions' + query(q)),
  /** Corrects a session with a reason. */
  correct: (id: number, body: { clock_in: string; clock_out: string | null; reason: string }) => api.patch<{ ok: true }>(`/time/sessions/${id}`, body),
  /** A session's correction history. */
  corrections: (id: number) => api.get<{ corrections: Correction[] }>(`/time/sessions/${id}/corrections`),
  /** Attendance for people you can see. */
  attendance: (q: Q = {}) =>
    api.get<{
      range: Range
      people: { id: number; name: string; title: string; department_name: string | null }[]
      clocked_in_now: { session_id: number; user_id: number; clock_in: string; name: string; working_on: { key: string; title: string } | null }[]
      daily_hours: { user_id: number; day: string; hours_clocked: number }[]
    }>('/time/attendance' + query(q)),
}

export const people = {
  /** Performance for everyone you can see. */
  list: (q: Q = {}) => api.get<{ range: Range; people: PersonStats[] }>('/people' + query(q)),
  /** One person's work. */
  get: (id: number, q: Q = {}) =>
    api.get<{
      range: Range
      person: PersonStats
      tasks: (Pick<TaskRow, 'id' | 'key' | 'title' | 'status' | 'priority' | 'deadline' | 'estimate_minutes' | 'completed_at' | 'overdue' | 'actual_minutes'> & { project: { id: number; name: string } })[]
      daily_hours: { day: string; hours_clocked: number }[]
      reviews: (Review & { task_key: string; task_title: string; task_id: number })[]
      activity: Activity[]
    }>(`/people/${id}` + query(q)),
}

export const dashboard = {
  /** The overview for your scope. */
  summary: () => api.get<Summary>('/dashboard/summary'),
}

/** CSV report paths (opened as downloads). */
export const reports = {
  people: (r: Range) => '/reports/people.csv' + query(r),
  tasks: () => '/reports/tasks.csv',
  projects: () => '/reports/projects.csv',
  departments: (r: Range) => '/reports/departments.csv' + query(r),
  time: (r: Range) => '/reports/time.csv' + query(r),
}
