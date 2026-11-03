import { request } from '../client'
import type { Role } from '../types'

type Ref = { id: number; name: string }

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
