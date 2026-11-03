// Data-loading hooks.
import { useCallback, useEffect, useState } from 'react'

export type Loadable<T> = { data: T | null; error: string | null; loading: boolean; reload: () => void; set: (data: T) => void }

/** Runs `load` whenever `key` changes; ignores responses from an older key. */
export function useApi<T>(load: () => Promise<T>, key: string): Loadable<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true })
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    let current = true
    setState((prev) => ({ ...prev, loading: true, error: null }))
    load()
      .then((data) => current && setState({ data, error: null, loading: false }))
      .catch((error: unknown) => {
        if (current) setState((prev) => ({ ...prev, loading: false, error: error instanceof Error ? error.message : 'Something went wrong.' }))
      })
    return () => {
      current = false
    }
    // `load` is recreated every render; `key` says when the request actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reloads])

  const reload = useCallback(() => setReloads((n) => n + 1), [])
  const set = useCallback((data: T) => setState({ data, error: null, loading: false }), [])
  return { ...state, reload, set }
}

/** Re-renders every `ms` so live durations keep counting. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(id)
  }, [ms])
  return now
}

/** Wraps an async action with a busy flag and error message. */
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = useCallback(async <R,>(fn: () => Promise<R>): Promise<R | undefined> => {
    setBusy(true)
    setError(null)
    try {
      return await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      return undefined
    } finally {
      setBusy(false)
    }
  }, [])
  return { busy, error, setError, run }
}
