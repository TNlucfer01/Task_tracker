// The HTTP layer: every API call goes through `request`, which sends the session cookie and turns
// error responses into readable messages.
const apiOrigin = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin)
const apiUrl = apiOrigin.replace(/\/$/, '') + '/api'

/** An API failure with its HTTP status and the server's message. */
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Listeners called when any request comes back 401 (the session ended). */
const signedOutListeners = new Set<() => void>()

/** Registers a callback for "your session expired"; returns an unsubscribe function. */
export function onSignedOut(fn: () => void) {
  signedOutListeners.add(fn)
  return () => {
    signedOutListeners.delete(fn)
  }
}

/** Sends a request to the API and returns the parsed JSON (or text for non-JSON responses). */
export async function request<T>(path: string, options: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...init } = options
  let response: Response
  try {
    response = await fetch(apiUrl + path, {
      ...init,
      body: json === undefined ? init.body : JSON.stringify(json),
      credentials: 'include',
      headers: { ...(json === undefined ? {} : { 'Content-Type': 'application/json' }), ...init.headers },
    })
  } catch {
    throw new ApiError("Can't reach the server. Check that the backend is running.", 0)
  }
  if (response.status === 204) return undefined as T
  const type = response.headers.get('content-type') ?? ''
  const body: unknown = type.includes('json') ? await response.json().catch(() => null) : await response.text()
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/login')) signedOutListeners.forEach((fn) => fn())
    const message =
      typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'The request could not be completed.'
    throw new ApiError(message, response.status)
  }
  return body as T
}

/** Shorthands for JSON requests. */
export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, json: unknown = {}) => request<T>(path, { method: 'POST', json }),
  patch: <T>(path: string, json: unknown) => request<T>(path, { method: 'PATCH', json }),
  del: (path: string) => request<void>(path, { method: 'DELETE' }),
}

/** Builds a query string, skipping empty values. */
export function query(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '' && value !== false) search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

/** A full URL to an API path, for downloads opened by the browser. */
export function apiHref(path: string) {
  return apiUrl + path
}
