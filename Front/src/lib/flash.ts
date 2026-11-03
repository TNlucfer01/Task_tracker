// A one-time message that survives a hash navigation, e.g. "Meena was deleted" after leaving her page.
let pending: string | null = null

export function setFlash(message: string) {
  pending = message
}

export function takeFlash() {
  const message = pending
  pending = null
  return message
}
