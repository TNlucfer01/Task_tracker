// Shared clock state (session + running timer) so the sidebar, Home and task pages stay in sync.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { time } from '../api/endpoints'
import type { ClockStatus } from '../api/types'
import { toast } from './toast'

type ClockValue = {
  status: ClockStatus | null
  busy: boolean
  error: string | null
  refresh: () => Promise<void>
  clockIn: () => Promise<void>
  clockOut: () => Promise<void>
  startTimer: (taskId: number) => Promise<boolean>
  stopTimer: () => Promise<void>
}

const ClockContext = createContext<ClockValue | null>(null)

/** Loads and updates the signed-in person's clock; wrap the app with it. */
export function ClockProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [status, setStatus] = useState<ClockStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) return
    try {
      setStatus(await time.me())
    } catch {
      /* the next action reports errors */
    }
  }, [enabled])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(refresh, 120_000)
    return () => window.clearInterval(id)
  }, [refresh])

  /** Runs a clock action, keeping the latest state and any error. */
  const act = useCallback(async (fn: () => Promise<ClockStatus>, done?: string) => {
    setBusy(true)
    setError(null)
    try {
      setStatus(await fn())
      if (done) toast(done)
      return true
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong.'
      setError(message)
      toast(message)
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  const value: ClockValue = {
    status,
    busy,
    error,
    refresh,
    clockIn: async () => void (await act(time.clockIn, 'Clocked in')),
    clockOut: async () => void (await act(time.clockOut, 'Clocked out')),
    startTimer: (taskId) => act(() => time.startTimer(taskId), 'Timer started'),
    stopTimer: async () => void (await act(time.stopTimer, 'Timer stopped')),
  }
  return <ClockContext.Provider value={value}>{children}</ClockContext.Provider>
}

/** The clock state and actions. */
export function useClock() {
  const value = useContext(ClockContext)
  if (!value) throw new Error('useClock must be used inside ClockProvider')
  return value
}
