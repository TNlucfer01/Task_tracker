// Editors and read-only display for a project's custom fields (Notion-style properties).
import type { Field, PropertyValue } from '../api/types'
import { formatDate } from '../lib/format'
import { Chip, Input, Select } from './ui'

/** Shows a property value as text or chips. */
export function PropertyValueView({ field, value }: { field: Field; value: PropertyValue | undefined }) {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return <span className="text-ink-faint">Empty</span>
  switch (field.type) {
    case 'checkbox':
      return <span>{value ? 'Yes' : 'No'}</span>
    case 'date':
      return <span>{formatDate(String(value))}</span>
    case 'url':
      return (
        <a href={String(value)} target="_blank" rel="noreferrer" className="break-all">
          {String(value)}
        </a>
      )
    case 'multi_select':
      return (
        <span className="flex flex-wrap gap-1">
          {(value as string[]).map((v) => (
            <Chip key={v}>{v}</Chip>
          ))}
        </span>
      )
    case 'select':
      return <Chip>{String(value)}</Chip>
    default:
      return <span className="break-words">{String(value)}</span>
  }
}

/** An input for one custom field. */
export function PropertyInput({ field, value, onChange, id }: { field: Field; value: PropertyValue | undefined; onChange: (v: PropertyValue | null) => void; id?: string }) {
  switch (field.type) {
    case 'checkbox':
      return <input id={id} type="checkbox" className="size-4 accent-[var(--primary)]" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
    case 'number':
      return <Input id={id} type="number" value={value === undefined ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
    case 'date':
      return <Input id={id} type="date" value={value ? String(value) : ''} onChange={(e) => onChange(e.target.value || null)} />
    case 'url':
      return <Input id={id} type="url" placeholder="https://" value={value ? String(value) : ''} onChange={(e) => onChange(e.target.value || null)} />
    case 'select':
      return (
        <Select id={id} value={value ? String(value) : ''} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">Empty</option>
          {field.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </Select>
      )
    case 'multi_select': {
      const list = Array.isArray(value) ? value : []
      return (
        <div id={id} className="flex flex-wrap gap-1.5">
          {field.options.map((o) => {
            const on = list.includes(o)
            return (
              <button
                key={o}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(on ? list.filter((x) => x !== o) : [...list, o])}
                className={on ? 'rounded-sm border border-primary bg-primary-tint px-2 py-0.5 text-[13px] text-primary' : 'rounded-sm border border-line-strong px-2 py-0.5 text-[13px] text-ink-soft hover:text-ink'}
              >
                {o}
              </button>
            )
          })}
        </div>
      )
    }
    default:
      return <Input id={id} value={value ? String(value) : ''} maxLength={500} onChange={(e) => onChange(e.target.value || null)} />
  }
}

/** Removes empty values before sending properties to the API. */
export function cleanProperties(props: Record<string, PropertyValue | null>) {
  return Object.fromEntries(Object.entries(props).filter(([, v]) => v !== null && v !== '' && !(Array.isArray(v) && !v.length)))
}
