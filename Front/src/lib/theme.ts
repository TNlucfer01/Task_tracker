// Light/dark preference: follows the OS unless the person picks one.
export type Theme = 'system' | 'light' | 'dark'
const KEY = 'task-tracker-theme'

/** The saved preference. */
export function savedTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

/** Applies and saves a preference. */
export function applyTheme(theme: Theme) {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* storage unavailable: the choice lasts for this visit */
  }
}
