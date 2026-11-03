import { request } from './client'
import type { User } from './types'

export function login(identifier: string, password: string) {
  return request<{ user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  })
}

export function getCurrentUser() {
  return request<{ user: User }>('/api/auth/me')
}

export function logout() {
  return request<void>('/api/auth/logout', { method: 'POST' })
}
