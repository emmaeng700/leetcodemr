import hljs from 'highlight.js/lib/core'
import pythonLang from 'highlight.js/lib/languages/python'

hljs.registerLanguage('python', pythonLang)

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Syntax-highlight a single line (flashcard / CodePanel colors). */
export function highlightPythonLine(line: string): string {
  const raw = (line.replace(/\r/g, '') || ' ').replace(/\n/g, '')
  try {
    return hljs.highlight(raw, { language: 'python' }).value
  } catch {
    return escapeHtml(raw)
  }
}
