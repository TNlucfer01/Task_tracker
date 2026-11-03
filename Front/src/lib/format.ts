import type { DayRange, ProjectStatus } from '../api/admin/dashboard'
import type { TaskStatus } from '../api/types'

const TZ = 'Asia/Kolkata'

export const taskStatusLabel: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  in_review: 'In review',
  done: 'Done',
  rework: 'Rework',
}

export const taskStatuses = Object.keys(taskStatusLabel) as TaskStatus[]

export const projectStatusLabel: Record<ProjectStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  completed: 'Completed',
  on_hold: 'On hold',
}

export const projectStatuses = Object.keys(projectStatusLabel) as ProjectStatus[]

// Today (or today + offset) as YYYY-MM-DD in India time, matching the backend's day boundaries.
export function dayInIndia(offsetDays = 0) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(Date.now() + offsetDays * 86_400_000))
}

export function lastDays(days: number): DayRange {
  return { from: dayInIndia(-(days - 1)), to: dayInIndia() }
}

// Every YYYY-MM-DD from `from` to `to`, inclusive.
export function daysBetween({ from, to }: DayRange) {
  const days: string[] = []
  const cursor = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (cursor <= end && days.length < 400) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

export function formatDay(day: string, style: 'short' | 'long' = 'short') {
  const date = new Date(`${day}T00:00:00Z`)
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    weekday: style === 'long' ? 'long' : 'short',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

export function formatDate(iso: string | null) {
  if (!iso) return 'No deadline'
  return new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(iso),
  )
}

export function formatMinutes(minutes: number | null) {
  if (minutes === null || Number.isNaN(minutes)) return '—'
  const total = Math.max(0, Math.round(minutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function formatHours(hours: number) {
  return formatMinutes(hours * 60)
}

export function minutesSince(iso: string, now: number) {
  return (now - new Date(iso).getTime()) / 60_000
}

export function formatPct(value: number | null) {
  return value === null ? '—' : `${Math.round(value)}%`
}

export function formatRating(value: number | null) {
  return value === null ? '—' : value.toFixed(1)
}

export function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`
}
