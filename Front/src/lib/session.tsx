// The signed-in person, available anywhere through useMe(); can() checks a permission.
import { createContext, useContext } from 'react'
import type { Me } from '../api/types'

export type SessionValue = { me: Me; refresh: () => Promise<void>; signOut: () => Promise<void> }

export const SessionContext = createContext<SessionValue | null>(null)

/** The current session; only used inside the signed-in app. */
export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionContext')
  return value
}

/** The signed-in person. */
export function useMe() {
  return useSession().me
}

/** True when the person has the permission. */
export function can(me: Me, permission: string) {
  return me.permissions.includes(permission)
}
