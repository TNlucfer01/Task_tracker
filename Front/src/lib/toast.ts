// Short confirmations ("Task created") shown at the bottom of the screen.
type Listener = (message: string) => void
const listeners = new Set<Listener>()

/** Shows a confirmation message. */
export function toast(message: string) {
  listeners.forEach((fn) => fn(message))
}

/** Subscribes the toast host; returns an unsubscribe function. */
export function onToast(fn: Listener) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
