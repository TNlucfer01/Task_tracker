// A Markdown editor with Write / Preview tabs and a small formatting toolbar.
import { useRef, useState } from 'react'
import { renderMarkdown } from '../lib/markdown'
import { cx, Segmented } from './ui'

type Props = { value: string; onChange: (v: string) => void; placeholder?: string; minRows?: number; label: string; autoFocus?: boolean }

const tools: { label: string; title: string; wrap?: [string, string]; line?: string }[] = [
  { label: 'B', title: 'Bold', wrap: ['**', '**'] },
  { label: 'I', title: 'Italic', wrap: ['_', '_'] },
  { label: 'H', title: 'Heading', line: '## ' },
  { label: '•', title: 'Bulleted list', line: '- ' },
  { label: '☐', title: 'Checklist', line: '- [ ] ' },
  { label: '<>', title: 'Code', wrap: ['`', '`'] },
  { label: '🔗', title: 'Link', wrap: ['[', '](https://)'] },
]

/** Renders Markdown safely as HTML. */
export function Markdown({ text, className }: { text: string | null | undefined; className?: string }) {
  return <div className={cx('prose-md', className)} dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
}

/** The editor. Keyboard: Ctrl/Cmd+B and Ctrl/Cmd+I. */
export function MarkdownEditor({ value, onChange, placeholder, minRows = 10, label, autoFocus }: Props) {
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const ref = useRef<HTMLTextAreaElement>(null)

  /** Applies a toolbar action around the selection. */
  const apply = (tool: (typeof tools)[number]) => {
    const el = ref.current
    if (!el) return
    const { selectionStart: a, selectionEnd: b } = el
    let next: string
    let cursor: [number, number]
    if (tool.wrap) {
      const [l, r] = tool.wrap
      next = value.slice(0, a) + l + value.slice(a, b) + r + value.slice(b)
      cursor = [a + l.length, b + l.length]
    } else {
      const start = value.lastIndexOf('\n', a - 1) + 1
      next = value.slice(0, start) + tool.line + value.slice(start)
      cursor = [a + tool.line!.length, b + tool.line!.length]
    }
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(...cursor)
    })
  }

  return (
    <div className="overflow-hidden rounded-md border border-line-strong bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-subtle px-2 py-1.5">
        <Segmented label={`${label} mode`} value={mode} onChange={setMode} options={[{ value: 'write', label: 'Write' }, { value: 'preview', label: 'Preview' }]} />
        {mode === 'write' && (
          <div className="flex gap-0.5" role="toolbar" aria-label="Formatting">
            {tools.map((t) => (
              <button key={t.title} type="button" title={t.title} aria-label={t.title} onClick={() => apply(t)} className="grid h-7 min-w-7 place-items-center rounded px-1.5 text-[13px] font-semibold text-ink-soft hover:bg-surface hover:text-ink">
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {mode === 'write' ? (
        <textarea
          ref={ref}
          aria-label={label}
          value={value}
          autoFocus={autoFocus}
          placeholder={placeholder}
          rows={minRows}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (!(e.metaKey || e.ctrlKey)) return
            const tool = e.key === 'b' ? tools[0] : e.key === 'i' ? tools[1] : undefined
            if (!tool) return
            e.preventDefault()
            apply(tool)
          }}
          className="block w-full resize-y bg-surface px-3.5 py-3 font-[inherit] text-sm leading-6 text-ink placeholder:text-ink-faint focus-visible:outline-none"
        />
      ) : (
        <div className="min-h-40 px-4 py-3">{value.trim() ? <Markdown text={value} /> : <p className="text-ink-faint">Nothing to preview yet.</p>}</div>
      )}
    </div>
  )
}
