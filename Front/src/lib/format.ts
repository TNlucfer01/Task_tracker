// Formatting and labels. Dates show in India time, matching the server's working days.
import type { Priority, ProjectStatus, Scope, TaskStatus } from '../api/types'

const TZ = 'Asia/Kolkata'

export const taskStatuses: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'rework', 'done']
export const taskStatusLabel: Record<TaskStatus, string> = {
  todo: 'Not started',
  in_progress: 'In progress',
  in_review: 'In review',
  rework: 'Rework',
  done: 'Done',
}
export const priorities: Priority[] = ['urgent', 'high', 'medium', 'low']
export const priorityLabel: Record<Priority, string> = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' }
export const projectStatuses: ProjectStatus[] = ['planned', 'active', 'on_hold', 'completed']
export const projectStatusLabel: Record<ProjectStatus, string> = { planned: 'Planned', active: 'Active', on_hold: 'On hold', completed: 'Completed' }
export const scopeLabel: Record<Scope, string> = { all: 'Whole company', department: 'Their department', own: 'Only their own work' }

/** "12 Mar 2026" (adds the year only when it differs from this year). */
export function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value.length === 10 ? `${value}T00:00:00+05:30` : value)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), timeZone: TZ })
}

/** "12 Mar, 14:05". */
export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ })
}

/** "14:05". */
export function formatTime(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ })
}

/** "3h 20m" from minutes. */
export function formatMinutes(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return '—'
  const m = Math.max(0, Math.round(minutes))
  const h = Math.floor(m / 60)
  if (!h) return `${m}m`
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`
}

/** "7.5h" from hours. */
export function formatHours(hours: number | null | undefined) {
  if (hours === null || hours === undefined) return '—'
  return `${Math.round(hours * 10) / 10}h`
}

/** Live "1h 05m" since a timestamp. */
export function since(value: string, now = Date.now()) {
  return formatMinutes((now - new Date(value).getTime()) / 60000)
}

/** "3 minutes ago", "yesterday", or a date. */
export function relative(value: string, now = Date.now()) {
  const diff = (now - new Date(value).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 172800) return 'yesterday'
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} days ago`
  return formatDate(value)
}

/** "1 task", "3 tasks". */
export function plural(n: number, word: string, many = `${word}s`) {
  return `${n.toLocaleString('en-IN')} ${n === 1 ? word : many}`
}

/** Today in India as YYYY-MM-DD, optionally offset by days. */
export function today(offset = 0) {
  const d = new Date(Date.now() + offset * 86400000)
  return d.toLocaleDateString('en-CA', { timeZone: TZ })
}

/** A range ending today. */
export function lastDays(days: number) {
  return { from: today(-(days - 1)), to: today() }
}

/** Converts an ISO timestamp to a value for <input type="datetime-local"> in India time. */
export function toLocalInput(value: string | null | undefined) {
  if (!value) return ''
  const d = new Date(new Date(value).getTime() + 330 * 60000)
  return d.toISOString().slice(0, 16)
}

/** Converts an <input type="datetime-local"> value (India time) back to ISO. */
export function fromLocalInput(value: string) {
  return value ? new Date(`${value}:00+05:30`).toISOString() : null
}

/** Initials for an avatar. */
export function initials(name: string) {
  return name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
}

// "just now", "12 min ago", "3 h ago", "yesterday", then a date.
export function formatAgo(iso: string, now = Date.now()) {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  if (hours < 48) return 'yesterday'
  return formatDate(iso)
}

// Deadline relative to now, for lists: "Due today", "Due in 3 days", "2 days late".
export function formatDue(iso: string | null, now = Date.now()) {
  if (!iso) return 'No deadline'
  const days = Math.round((new Date(iso).getTime() - now) / 86_400_000)
  if (new Date(iso).getTime() < now) return days === 0 ? 'Due earlier today' : `${plural(-days, 'day')} late`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days} days`
}
