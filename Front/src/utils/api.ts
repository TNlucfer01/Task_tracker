const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export type User = {
  id: string | number
  name: string
  email: string
}

export type Task = {
  id: string | number
  name: string
  description: string | null
  project_id: string | number | null
  user_assigned_id: string | number
  created_at: string
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
