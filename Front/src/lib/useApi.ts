import { useCallback, useEffect, useState } from 'react'

type State<T> = { data: T | null; error: string | null; loading: boolean }

// Runs `load` whenever `key` changes. Stale responses from an older key are ignored.
// With `refreshMs`, it also reloads on that interval while the tab is visible, keeping the old
// data on screen until the new data arrives.
export function useApi<T>(load: () => Promise<T>, key: string, refreshMs?: number) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true })
  const [reloads, setReloads] = useState(0)
  const [loadedAt, setLoadedAt] = useState<number | null>(null)

  useEffect(() => {
    if (!refreshMs) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setReloads((n) => n + 1)
    }, refreshMs)
    const onVisible = () => document.visibilityState === 'visible' && setReloads((n) => n + 1)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refreshMs])

  useEffect(() => {
    let current = true
    setState((prev) => ({ ...prev, loading: true, error: null }))

    load()
      .then((data) => {
        if (current) {
          setState({ data, error: null, loading: false })
          setLoadedAt(Date.now())
        }
      })
      .catch((error: unknown) => {
        if (current) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: error instanceof Error ? error.message : 'Something went wrong.',
          }))
        }
      })

    return () => {
      current = false
    }
    // `load` is recreated every render; `key` says when the request actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reloads])

  const reload = useCallback(() => setReloads((n) => n + 1), [])
  return { ...state, reload, loadedAt }
}

// Re-renders every `ms` so live durations keep counting.
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(id)
  }, [ms])
  return now
}
