// A small hash router: #/tasks/12 → ['tasks', '12']. Query strings after `?` become filters.
import { useEffect, useState } from 'react'

type Route = { parts: string[]; params: URLSearchParams }

/** Reads the current hash into path parts and query params. */
function read(): Route {
  const [path, search = ''] = window.location.hash.replace(/^#\/?/, '').split('?')
  return { parts: path.split('/').filter(Boolean), params: new URLSearchParams(search) }
}

/** The current route; re-renders on navigation. */
export function useRoute() {
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const onChange = () => {
      setRoute(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

/** Builds a link: href('tasks', 12) → '#/tasks/12'; a trailing object adds query params. */
export function href(...parts: (string | number | Record<string, string | number | undefined>)[]) {
  const last = parts[parts.length - 1]
  const params = typeof last === 'object' ? (parts.pop() as Record<string, string | number | undefined>) : null
  const search = params
    ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString()
    : ''
  return `#/${parts.join('/')}${search ? `?${search}` : ''}`
}

/** Navigates in code. */
export function go(...parts: Parameters<typeof href>) {
  window.location.hash = href(...parts)
}

/** Replaces the query string without adding a history entry (for filters). */
export function setParams(params: Record<string, string | number | undefined>) {
  const path = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  const search = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString()
  history.replaceState(null, '', `#/${path}${search ? `?${search}` : ''}`)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}
