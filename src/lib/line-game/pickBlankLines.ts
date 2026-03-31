/** Line-fill game: choose 2–3 “meaty” Python lines to blank out. */

export interface BlankPick {
  lineIndex: number
  expected: string
}

const MAX_BLANKS = 3
const MIN_CANDIDATES = 2

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
    if (sc < 1.2) continue
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

  const nPick = scored.length >= 3 ? MAX_BLANKS : 2
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

export function linesEquivalent(a: string, b: string): boolean {
  return normalizeAnswerLine(a) === normalizeAnswerLine(b)
}

export function hintPrefix(expected: string, len: number): string {
  const e = expected.replace(/\r/g, '')
  return e.slice(0, Math.min(len, e.length))
}
