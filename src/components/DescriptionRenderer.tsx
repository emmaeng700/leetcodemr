import React from 'react'

const SUP_MAP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻',
}

function toSup(s: string): string {
  return s.split('').map(c => SUP_MAP[c] ?? c).join('')
}

function stripHeader(raw: string): string {
  const idx = raw.indexOf('Description\n')
  if (idx !== -1) return raw.slice(idx + 'Description\n'.length).trim()
  const lines = raw.split('\n')
  let start = 0
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim()
    if (l && l.split(' ').length <= 4 && !/[.,]/.test(l) && /^[A-Z]/.test(l)) {
      start = i + 1
    } else break
  }
  return lines.slice(start).join('\n').trim()
}

function fixSuperscripts(text: string): string {
  return text.replace(/(\w)\n(\d{1,2})\n/g, (_, base: string, exp: string) => base + toSup(exp) + '\n')
}

function joinChunk(lines: string[]): string[] {
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
    } else {
      if (/[.?!]$/.test(current)) {
        paragraphs.push(current.trim())
        current = l
      } else {
        current += ' ' + l
      }
    }
  }
  if (current) paragraphs.push(current.trim())
  return paragraphs
}

type Segment =
  | { type: 'para'; text: string }
  | { type: 'example'; label: string; rows: string[] }
  | { type: 'constraints'; items: string[] }
  | { type: 'followup'; text: string }

function parse(raw: string): Segment[] {
  raw = fixSuperscripts(raw)
  const lines = raw.split('\n')
  const segments: Segment[] = []

  let i = 0
  let paraBuffer: string[] = []

  const flushPara = () => {
    if (paraBuffer.length === 0) return
    const paras = joinChunk(paraBuffer)
    paras.forEach(p => { if (p) segments.push({ type: 'para', text: p }) })
    paraBuffer = []
  }

  while (i < lines.length) {
    const line = lines[i].trim()

    if (/^Example \d+:/.test(line)) {
      flushPara()
      const block: { type: 'example'; label: string; rows: string[] } = { type: 'example', label: line, rows: [] }
      i++
      let rowBuf: string[] = []
      while (i < lines.length) {
        const l = lines[i].trim()
        if (!l || /^Example \d+:/.test(l) || l === 'Constraints:' || /^Follow.up/i.test(l)) break
        if (/^(Input|Output|Explanation):/.test(l)) {
          if (rowBuf.length) {
            block.rows.push(rowBuf.join(' '))
            rowBuf = []
          }
          rowBuf.push(l)
        } else {
          rowBuf.push(l)
        }
        i++
      }
      if (rowBuf.length) block.rows.push(rowBuf.join(' '))
      segments.push(block)
      continue
    }

    if (line === 'Constraints:') {
      flushPara()
      const block: { type: 'constraints'; items: string[] } = { type: 'constraints', items: [] }
      i++
      let constraintBuf: string[] = []
      while (i < lines.length) {
        const l = lines[i].trim()
        if (!l || /^(Follow|Note)/i.test(l)) break
        if (constraintBuf.length && /^[-\d]/.test(l) && constraintBuf[constraintBuf.length - 1].includes('<=')) {
          block.items.push(constraintBuf.join(' '))
          constraintBuf = [l]
        } else {
          constraintBuf.push(l)
        }
        i++
      }
      if (constraintBuf.length) block.items.push(constraintBuf.join(' '))
      segments.push(block)
      continue
    }

    if (/^Follow.up/i.test(line)) {
      flushPara()
      const buf = [line]
      i++
      while (i < lines.length && lines[i].trim() && !/^(Example|Constraints)/i.test(lines[i])) {
        buf.push(lines[i].trim())
        i++
      }
      segments.push({ type: 'followup', text: buf.join(' ') })
      continue
    }

    paraBuffer.push(line)
    i++
  }

  flushPara()
  return segments
}

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\b[a-z][a-zA-Z0-9_]*(?:\[[^\]]*\])?\b)/g)
  return parts.map((part, i) => {
    if (i % 2 === 1 && /^[a-z]/.test(part) && part.length >= 2 && part.length <= 20) {
      return (
        <code key={i} className="bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded text-xs font-mono">
          {part}
        </code>
      )
    }
    return part
  })
}

interface DescriptionRendererProps {
  description?: string
  explanation?: string
}

export default function DescriptionRenderer({ description, explanation }: DescriptionRendererProps) {
  if (!description && !explanation) {
    return <p className="text-gray-400 text-sm italic">Use the image above to read the full question.</p>
  }

  const textToRender = description || explanation || ''
  const cleaned = stripHeader(textToRender)
  const segments = parse(cleaned)

  return (
    <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
      {segments.map((seg, idx) => {
        if (seg.type === 'para') {
          return (
            <p key={idx} className="text-sm text-gray-700 leading-relaxed">
              {renderInline(seg.text)}
            </p>
          )
        }

        if (seg.type === 'example') {
          return (
            <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-bold text-indigo-500 uppercase tracking-wide">{seg.label}</p>
              {seg.rows.map((row, j) => {
                const m = row.match(/^(Input|Output|Explanation):\s*([\s\S]*)/)
                if (m) {
                  return (
                    <div key={j} className="flex gap-2 text-xs">
                      <span className="font-bold text-gray-500 w-24 shrink-0">{m[1]}:</span>
                      <code className="text-gray-800 font-mono whitespace-pre-wrap">{m[2]}</code>
                    </div>
                  )
                }
                return <p key={j} className="text-xs text-gray-600">{row}</p>
              })}
            </div>
          )
        }

        if (seg.type === 'constraints') {
          return (
            <div key={idx}>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Constraints</p>
              <ul className="space-y-1 pl-2">
                {seg.items.map((item, j) => (
                  <li key={j} className="flex gap-2 text-xs text-gray-600">
                    <span className="text-gray-400 shrink-0 mt-0.5">•</span>
                    <code className="font-mono leading-relaxed">{item}</code>
                  </li>
                ))}
              </ul>
            </div>
          )
        }

        if (seg.type === 'followup') {
          return (
            <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <p className="text-xs text-blue-700 leading-relaxed">{seg.text}</p>
            </div>
          )
        }

        return null
      })}
    </div>
  )
}
