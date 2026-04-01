/** Line-fill game: blank meaningful Python lines (flashcard-style practice). */

export interface BlankPick {
  lineIndex: number
  expected: string
}

/** Minimum scored algorithm lines to include a question (after relax pass). */
const MIN_CANDIDATES = 1

/**
 * How many of the n scored algorithm lines must be blanked so strictly more than 70% are hidden.
 * (e.g. n=10 → 8 blanks; n=100 → 71 blanks)
 */
function blanksForStrictOver70Percent(n: number): number {
  if (n <= 0) return 0
  return Math.min(n, Math.floor(n * 0.7) + 1)
}

export function linesFromPython(py: string): string[] {
  return py.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
}

function isSkippable(line: string): boolean {
  const t = line.replace(/\r/g, '').trim()
  if (!t) return true
  if (t.startsWith('#')) return true
  if (/^def\s/.test(t)) return true
  if (/^class\s+\w/.test(t)) return true
  if (/^\s*@/.test(line)) return true
  if (/^(import|from)\s/.test(t)) return true
  if (t.startsWith('if __name__')) return true
  if (/^# Example/i.test(t) || /^#\s*print/i.test(t) || /^#\s*Test/i.test(t)) return true
  if (/^def __init__/.test(t)) return true
  if (/^[\})\]\s,]+$/.test(t)) return true
  if (/^(else|finally)\s*:\s*$/.test(t)) return true
  if (t === 'pass' || t === 'break' || t === 'continue') return true
  if (t.length < 4) return true
  return false
}

function scoreLine(line: string): number {
  const t = line.trim()
  let sc = 0
  sc += Math.min(t.length, 120) / 30
  if (/\breturn\b/.test(t)) sc += 4
  if (/\b(while|for)\b/.test(t)) sc += 3
  if (/\bif\b/.test(t)) sc += 2
  if (/[=+\-*/%]|\.append\(|\.get\(/.test(t)) sc += 1.5
  if (/[\[\]]/.test(t)) sc += 0.5
  return sc
}

/** 0-based line indices to blank, sorted top-to-bottom. */
export function pickBlankLineIndices(py: string): number[] | null {
  const lines = linesFromPython(py)
  const scored: { i: number; score: number }[] = []
  for (let i = 0; i < lines.length; i++) {
    if (isSkippable(lines[i])) continue
    const sc = scoreLine(lines[i])
    if (sc < 0.65) continue
    scored.push({ i, score: sc })
  }

  if (scored.length < MIN_CANDIDATES) {
    scored.length = 0
    for (let i = 0; i < lines.length; i++) {
      if (isSkippable(lines[i])) continue
      scored.push({ i, score: scoreLine(lines[i]) })
    }
  }

  if (scored.length < MIN_CANDIDATES) return null

  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.i - b.i))

  const nPick = blanksForStrictOver70Percent(scored.length)

  const picked = scored.slice(0, nPick).map((x) => x.i)
  picked.sort((a, b) => a - b)
  return picked
}

export function buildBlankPicks(py: string): BlankPick[] | null {
  const indices = pickBlankLineIndices(py)
  if (!indices) return null
  const lines = linesFromPython(py)
  return indices.map((lineIndex) => ({ lineIndex, expected: lines[lineIndex] }))
}

export function normalizeAnswerLine(s: string): string {
  return s.replace(/\r/g, '').trimEnd()
}

/** Strip all whitespace — catches `index,num` vs `index, num`, missing indent, etc. */
export function normalizeLooseLine(s: string): string {
  return normalizeAnswerLine(s).replace(/\s+/g, '')
}

/**
 * Exact line (after trim-end), or same characters with any whitespace/layout.
 * Variable names must still match the solution; no “logic equivalent” renaming.
 */
export function linesEquivalent(a: string, b: string): boolean {
  const na = normalizeAnswerLine(a)
  const nb = normalizeAnswerLine(b)
  if (na === nb) return true
  return normalizeLooseLine(a) === normalizeLooseLine(b)
}

export function hintPrefix(expected: string, len: number): string {
  const e = expected.replace(/\r/g, '')
  return e.slice(0, Math.min(len, e.length))
}

/** Human-readable start hint (indent is often 4 spaces — JSON of spaces is useless). */
export function formatStartHint(expected: string, previewChars = 28): string {
  const e = expected.replace(/\r/g, '').replace(/\t/g, '    ')
  let i = 0
  while (i < e.length && e[i] === ' ') i++
  const indent = i
  const rest = e.slice(i)
  const clip = rest.slice(0, previewChars)
  const more = rest.length > previewChars ? '…' : ''
  if (indent > 0) {
    return `${indent} leading space(s), then: ${clip}${more}`
  }
  return `Starts: ${clip}${more}`
}

/** Leading tabs/spaces and the rest (for inline indent gutter + body textarea). */
export function splitLeadingIndent(line: string): { indent: string; body: string } {
  const m = line.replace(/\r/g, '').match(/^([\t ]*)(.*)$/)
  return { indent: m?.[1] ?? '', body: m?.[2] ?? '' }
}

/** Rebuild full line from gutter + user-typed body (for grading). */
export function composeLineAnswer(expectedLine: string, userBody: string): string {
  const { indent, body } = splitLeadingIndent(expectedLine)
  const u = normalizeAnswerLine(userBody)
  if (/^\s/.test(u)) return u
  if (!body && !indent) return u
  return indent + u
}
