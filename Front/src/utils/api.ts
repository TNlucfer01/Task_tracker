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
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })

  if (response.status === 204) {
    return undefined as T
  }

  const body: unknown = await response.json()

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
