/** Normalize problem descriptions into readable plain text for Grind comment blocks. */

const ZW_CHARS = /[\u200b\u200c\u200d\ufeff]/g
const SECTION_RE = /^(Example \d+|Constraints|Follow-up|Input|Output|Explanation)\b/i
const JUNK_LINE_RE = /^(Description|Input|Output|Explanation|Constraints|Follow-up)$/i
const TITLE_JUNK_RE = /^\d+\.\s+.+\s*\u{1f512}\s*$/u
const LOCK_CHAR = '\u{1f512}'
const TAG_KEYWORDS = [
  'array', 'hash table', 'design', 'data stream', 'binary search',
  'dynamic programming', 'tree', 'graph', 'math', 'greedy', 'backtracking',
  'stack', 'queue', 'heap', 'trie', 'union find', 'bit manipulation',
  'sliding window', 'two pointers',
]

function isTagLine(s: string): boolean {
  const parts = s.split(/\s{2,}|\s+/).map(p => p.trim().toLowerCase()).filter(Boolean)
  if (parts.length < 2 || parts.length > 8) return false
  return parts.every(part => TAG_KEYWORDS.some(kw => part.includes(kw)))
}

function normalizeBrokenPlain(text: string): string {
  if (!text || /<[a-zA-Z]/.test(text)) return text
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return ''
  const out: string[] = []
  let buf: string[] = []
  for (const s of lines) {
    if (SECTION_RE.test(s) || /^[\u2022\-]\s/.test(s)) {
      if (buf.length) out.push(buf.join(' '))
      buf = []
      out.push(s)
      continue
    }
    buf.push(s)
  }
  if (buf.length) out.push(buf.join(' '))
  return out.join('\n\n').trim()
}

function stripJunkLines(text: string): string {
  const kept: string[] = []
  for (const line of text.split('\n')) {
    const s = line.trim()
    if (!s) {
      kept.push('')
      continue
    }
    if (s.includes('md-tag') || s.includes('md-content') || s.startsWith('<article')) continue
    if (JUNK_LINE_RE.test(s) || TITLE_JUNK_RE.test(s) || isTagLine(s)) continue
    if (s === '\xa0' || s === LOCK_CHAR) continue
    kept.push(s)
  }
  return kept.join('\n')
}

function tidySpacing(text: string): string {
  return text
    .replace(ZW_CHARS, '')
    .replace(/\u00a0/g, ' ')
    .replace(/ +([,.;:!?)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/ {2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function mergeSectionBlocks(lines: string[]): string[] {
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const s = lines[i].trim()
    if (!s) {
      if (out.length && out[out.length - 1] !== '') out.push('')
      i++
      continue
    }
    if (SECTION_RE.test(s)) {
      out.push(s.replace(/:$/, ''))
      i++
      const body: string[] = []
      while (i < lines.length) {
        const nxt = lines[i].trim()
        if (!nxt) {
          i++
          break
        }
        if (SECTION_RE.test(nxt)) break
        body.push(nxt)
        i++
      }
      if (body.length) out.push(body.join(' '))
      continue
    }
    if (/^[\u2022\-]\s/.test(s)) {
      out.push(s)
      i++
      continue
    }
    const para = [s]
    i++
    while (i < lines.length) {
      const nxt = lines[i].trim()
      if (!nxt || SECTION_RE.test(nxt) || /^[\u2022\-]\s/.test(nxt)) break
      para.push(nxt)
      i++
    }
    out.push(para.join(' '))
  }
  return out
}

function wrapParagraph(para: string, width = 88): string[] {
  const flat = para.split(/\s+/).join(' ')
  if (!flat) return []
  if (flat.startsWith('[') || flat.startsWith('{') || flat.length <= width) return [flat]
  const words = flat.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > width && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

/** Readable plain-text problem statement for comment blocks. */
export function formatDescriptionPlain(text: string, width = 88): string {
  if (!text.trim()) return ''
  let cleaned = tidySpacing(stripJunkLines(text))
  if (/<[a-zA-Z]/.test(cleaned)) return cleaned
  cleaned = normalizeBrokenPlain(cleaned)
  const merged = mergeSectionBlocks(cleaned.split('\n'))
  const wrapped: string[] = []
  for (const line of merged) {
    if (!line) {
      if (wrapped.length && wrapped[wrapped.length - 1] !== '') wrapped.push('')
      continue
    }
    if (SECTION_RE.test(line) || /^[\u2022\-]\s/.test(line)) {
      wrapped.push(line)
      continue
    }
    wrapped.push(...wrapParagraph(line, width))
  }
  return tidySpacing(wrapped.join('\n'))
}
