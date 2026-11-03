// Markdown to safe HTML for task bodies, descriptions and comments.
import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ gfm: true, breaks: true })

/** Renders Markdown and strips anything unsafe (scripts, event handlers, javascript: links). */
export function renderMarkdown(text: string | null | undefined) {
  const html = marked.parse(text ?? '', { async: false })
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
}

/** Saves text as a file download. */
export function downloadText(filename: string, text: string, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}
