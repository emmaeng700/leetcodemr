'use client'
import React from 'react'

// ── Superscript / subscript maps ──────────────────────────────────────────────
const SUP_MAP: Record<string, string> = {
  '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴',
  '5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','+':'⁺','-':'⁻',
}
const SUB_MAP: Record<string, string> = {
  '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄',
  '5':'₅','6':'₆','7':'₇','8':'₈','9':'₉',
  'i':'ᵢ','j':'ⱼ','n':'ₙ','k':'ₖ','m':'ₘ',
}
function toSup(s: string) { return s.split('').map(c => SUP_MAP[c] ?? c).join('') }
function toSub(s: string) { return SUB_MAP[s] ?? s }

// ── Common English words that should NOT be treated as code identifiers ────────
const PROSE_WORDS = new Set([
  'a','an','the','in','is','it','to','of','or','if','at','as','by','on','up',
  'no','so','do','be','we','he','she','they','you','are','was','for','can',
  'not','and','but','has','had','its','that','this','with','from','have',
  'will','than','then','when','also','each','some','all','any','one','two',
  'three','four','five','six','given','find','return','make','only','more',
  'most','less','same','such','both','your','once','into','over','just',
  'which','where','there','their','what','each','between','distinct',
])

// ── Identify if a token looks like a programming identifier ───────────────────
function isCodeToken(token: string): boolean {
  if (PROSE_WORDS.has(token.toLowerCase())) return false
  if (token.length < 1 || token.length > 40) return false
  // Single letters that are common variables
  if (/^[nkmijNKMIJ]$/.test(token)) return true
  // Contains digit (nums1, n2, k3)
  if (/[a-zA-Z].*\d|\d.*[a-zA-Z]/.test(token)) return true
  // camelCase (contains uppercase after first char)
  if (/^[a-z][a-z]*[A-Z]/.test(token)) return true
  // Contains bracket, underscore, dot
  if (/[\[._]/.test(token)) return true
  // All caps abbreviation
  if (/^[A-Z]{2,}$/.test(token)) return true
  // Starts with known LeetCode param patterns
  if (/^(nums|arr|matrix|grid|graph|tree|node|root|head|list|str|word|char|row|col|src|dst|freq|count|val|key|left|right|mid|lo|hi|prev|curr|next|top|bot|start|end|ptr|link|dist|cost|price|weight|capacity|target|flight|from|price)/.test(token.toLowerCase())) return true
  return false
}

// ── Normalise raw text: fix superscripts, subscript indices ──────────────────
function normalise(raw: string): string {
  // Numeric superscripts: "10\n4\n" → "10⁴"
  raw = raw.replace(/(\w)\n(\d{1,2})\n/g, (_, base, exp) => base + toSup(exp) + '\n')
  // Single-letter subscript indices before punctuation: "from\ni\n," → "fromᵢ,"
  raw = raw.replace(/([a-zA-Z])\n([ijknm])\n(?=[,. \]<>!=\)])/g,
    (_, word, sub) => word + toSub(sub))
  // Same but end-of-line: "price\ni\n" at end
  raw = raw.replace(/([a-zA-Z])\n([ijknm])\n?$/gm,
    (_, word, sub) => word + toSub(sub))
  return raw
}

// ── Smart line joiner: respect leading punctuation ────────────────────────────
function joinLines(lines: string[]): string {
  let result = ''
  for (const raw of lines) {
    const l = raw.trim()
    if (!l) continue
    if (!result) {
      result = l
    } else if (/^[,.);\]!?:]/.test(l)) {
      // Leading punctuation — attach directly, no space
      result += l
    } else if (/[(\[]$/.test(result)) {
      // Previous ends with opening bracket
      result += l
    } else {
      result += ' ' + l
    }
  }
  return result
}

// ── Split joined text into paragraphs on clear sentence boundaries ─────────────
function splitParagraphs(lines: string[]): string[] {
  const paragraphs: string[] = []
  let current = ''

  for (const raw of lines) {
    const l = raw.trim()
    if (!l) {
      if (current) { paragraphs.push(current.trim()); current = '' }
      continue
    }
    if (!current) {
      current = l
    } else if (/^[,.);\]!?]/.test(l)) {
      current += l
    } else if (/[.!?]$/.test(current) && /^[A-Z]/.test(l) && current.length > 40) {
      // Clear sentence end followed by a new sentence (long enough to be its own para)
      paragraphs.push(current.trim())
      current = l
    } else {
      current += ' ' + l
    }
  }
  if (current) paragraphs.push(current.trim())
  return paragraphs
}

// ── Strip leading title/header lines ──────────────────────────────────────────
function stripHeader(raw: string): string {
  const idx = raw.indexOf('Description\n')
  if (idx !== -1) return raw.slice(idx + 'Description\n'.length).trim()
  const lines = raw.split('\n')
  let start = 0
  for (let i = 0; i < Math.min(lines.length, 4); i++) {
    const l = lines[i].trim()
    if (l && l.split(' ').length <= 5 && !/[.,<>]/.test(l) && /^[A-Z]/.test(l)) {
      start = i + 1
    } else break
  }
  return lines.slice(start).join('\n').trim()
}

// ── Segment types ─────────────────────────────────────────────────────────────
type Segment =
  | { type: 'para';        text: string }
  | { type: 'example';     label: string; rows: string[] }
  | { type: 'constraints'; items: string[] }
  | { type: 'followup';    text: string }
  | { type: 'note';        text: string }

// ── Main parser ───────────────────────────────────────────────────────────────
function parse(raw: string): Segment[] {
  raw = normalise(raw)
  const lines = raw.split('\n')
  const segments: Segment[] = []
  let i = 0
  let paraBuffer: string[] = []

  const flushPara = () => {
    if (!paraBuffer.length) return
    splitParagraphs(paraBuffer).forEach(p => { if (p.trim()) segments.push({ type: 'para', text: p.trim() }) })
    paraBuffer = []
  }

  while (i < lines.length) {
    const line = lines[i].trim()

    // ── Example block ──────────────────────────────────────────────────────
    if (/^Example\s*\d+\s*:/.test(line)) {
      flushPara()
      const block: Extract<Segment, { type: 'example' }> = { type: 'example', label: line, rows: [] }
      i++
      let rowBuf: string[] = []
      while (i < lines.length) {
        const l = lines[i].trim()
        if (!l || /^Example\s*\d+\s*:/.test(l) || l === 'Constraints:' || /^Follow.?up/i.test(l) || /^Note:/i.test(l)) break
        if (/^(Input|Output|Explanation)\s*:/.test(l)) {
          if (rowBuf.length) { block.rows.push(joinLines(rowBuf)); rowBuf = [] }
          rowBuf.push(l)
        } else {
          rowBuf.push(l)
        }
        i++
      }
      if (rowBuf.length) block.rows.push(joinLines(rowBuf))
      segments.push(block)
      continue
    }

    // ── Constraints block ──────────────────────────────────────────────────
    if (line === 'Constraints:') {
      flushPara()
      const block: Extract<Segment, { type: 'constraints' }> = { type: 'constraints', items: [] }
      i++
      let buf: string[] = []

      const flushConstraint = () => {
        const joined = joinLines(buf).trim()
        if (joined) block.items.push(joined)
        buf = []
      }

      while (i < lines.length) {
        const l = lines[i].trim()
        if (!l || /^(Follow|Note)/i.test(l)) break
        // A new constraint starts with: digit, dash, or identifier with operator
        const isNewConstraint =
          buf.length > 0 &&
          (/^-?\d/.test(l) || /^[a-zA-Z].*(<= | == | != | <= )/.test(l) ||
           /^[a-zA-Z]+\.length/.test(l) || /^[a-zA-Z]+\s*!=/.test(l) ||
           /^There /.test(l) || /^At /.test(l) || /^The /.test(l) || /^All /.test(l))
        if (isNewConstraint) flushConstraint()
        buf.push(l)
        i++
      }
      flushConstraint()
      segments.push(block)
      continue
    }

    // ── Follow-up block ────────────────────────────────────────────────────
    if (/^Follow.?up\s*:/i.test(line)) {
      flushPara()
      const buf = [line]
      i++
      while (i < lines.length) {
        const l = lines[i].trim()
        if (!l || /^(Example|Constraints|Note)/i.test(l)) break
        buf.push(l)
        i++
      }
      segments.push({ type: 'followup', text: joinLines(buf) })
      continue
    }

    // ── Note block ────────────────────────────────────────────────────────
    if (/^Note\s*:/i.test(line)) {
      flushPara()
      const buf = [line]
      i++
      while (i < lines.length) {
        const l = lines[i].trim()
        if (!l || /^(Example|Constraints|Follow)/i.test(l)) break
        buf.push(l)
        i++
      }
      segments.push({ type: 'note', text: joinLines(buf) })
      continue
    }

    paraBuffer.push(line)
    i++
  }

  flushPara()
  return segments
}

// ── Inline renderer: only highlight actual code tokens ─────────────────────────
function renderInline(text: string): React.ReactNode[] {
  // Split on identifiers, brackets, operators that look like code
  const parts = text.split(/(\b[a-zA-Z_$][\w$[\]._]*(?:\([^)]*\))?\b|\b\d+\b)/g)
  return parts.map((part, idx) => {
    if (idx % 2 === 1 && isCodeToken(part)) {
      return (
        <code key={idx} className="bg-indigo-50 text-indigo-700 px-[3px] py-px rounded text-[0.78em] font-mono">
          {part}
        </code>
      )
    }
    return part
  })
}

// ── Component ─────────────────────────────────────────────────────────────────
interface DescriptionRendererProps {
  description?: string
  explanation?: string
}

export default function DescriptionRenderer({ description, explanation }: DescriptionRendererProps) {
  if (!description && !explanation) {
    return (
      <p className="text-[var(--text-subtle)] text-sm italic">
        Use the link above to read the full question on LeetCode.
      </p>
    )
  }

  const cleaned = stripHeader(description || explanation || '')
  const segments = parse(cleaned)

  return (
    <div className="space-y-3 text-sm text-[var(--text)] leading-relaxed">
      {segments.map((seg, idx) => {
        // ── Paragraph ──────────────────────────────────────────────────────
        if (seg.type === 'para') {
          return (
            <p key={idx} className="leading-[1.7]">
              {renderInline(seg.text)}
            </p>
          )
        }

        // ── Example block ──────────────────────────────────────────────────
        if (seg.type === 'example') {
          return (
            <div key={idx} className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 space-y-1.5">
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
                {seg.label}
              </p>
              {seg.rows.map((row, j) => {
                const m = row.match(/^(Input|Output|Explanation)\s*:\s*([\s\S]*)/)
                if (m) {
                  return (
                    <div key={j} className="flex gap-2 text-xs">
                      <span className="font-semibold text-[var(--text-muted)] w-24 shrink-0">{m[1]}:</span>
                      <code className="text-[var(--text)] font-mono whitespace-pre-wrap break-all">{m[2]}</code>
                    </div>
                  )
                }
                return <p key={j} className="text-xs text-[var(--text-subtle)]">{row}</p>
              })}
            </div>
          )
        }

        // ── Constraints block ──────────────────────────────────────────────
        if (seg.type === 'constraints') {
          return (
            <div key={idx}>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">
                Constraints
              </p>
              <ul className="space-y-1 pl-1">
                {seg.items.map((item, j) => (
                  <li key={j} className="flex gap-2 text-xs text-[var(--text-subtle)]">
                    <span className="text-indigo-400 shrink-0 mt-0.5 select-none">•</span>
                    <code className="font-mono leading-relaxed text-[var(--text)]">{item}</code>
                  </li>
                ))}
              </ul>
            </div>
          )
        }

        // ── Follow-up ──────────────────────────────────────────────────────
        if (seg.type === 'followup') {
          return (
            <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <p className="text-xs text-blue-700 leading-relaxed">{renderInline(seg.text)}</p>
            </div>
          )
        }

        // ── Note ──────────────────────────────────────────────────────────
        if (seg.type === 'note') {
          return (
            <div key={idx} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="text-xs text-amber-700 leading-relaxed">{renderInline(seg.text)}</p>
            </div>
          )
        }

        return null
      })}
    </div>
  )
}
