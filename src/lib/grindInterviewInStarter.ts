import type { GrindLang } from '@/lib/grindStorage'

export const INTERVIEW_MARKER_PY = '# -- Interview Approach - STAR-LC --'
export const INTERVIEW_MARKER_CPP = '// -- Interview Approach - STAR-LC --'

function interviewMarker(lang: GrindLang): string {
  return lang === 'python3' ? INTERVIEW_MARKER_PY : INTERVIEW_MARKER_CPP
}

export function starterHasInterviewApproach(starter: string, lang: GrindLang): boolean {
  const marker = interviewMarker(lang)
  return starter.includes(marker) || starter.includes('# PHASE 1') || starter.includes('// PHASE 1')
}

function findLastCheckLineIndex(code: string): number {
  const lines = code.split('\n')
  let last = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('_check(')) last = i
  }
  return last
}

/** Convert playbook hash comments to C++ line comments. */
export function interviewScriptForLang(script: string, lang: GrindLang): string {
  const trimmed = script.trimEnd()
  if (lang === 'python3') return trimmed
  return trimmed
    .split('\n')
    .map(line => {
      if (!line) return ''
      if (line.startsWith('#')) return `//${line.slice(1)}`
      return `// ${line}`
    })
    .join('\n')
}

/** Append STAR-LC script after the last _check line (or at end) with blank lines before it. */
export function appendInterviewApproachToStarter(
  starter: string,
  script: string | undefined,
  lang: GrindLang,
): string {
  if (!script?.trim()) return starter
  if (starterHasInterviewApproach(starter, lang)) return starter

  const marker = interviewMarker(lang)
  const commented = interviewScriptForLang(script, lang)
  const separator = '\n\n\n\n'

  let base = starter.replace(/\s+$/, '')
  const lastCheckIdx = findLastCheckLineIndex(base)
  if (lastCheckIdx >= 0) {
    base = base.split('\n').slice(0, lastCheckIdx + 1).join('\n')
  }

  return `${base}${separator}${marker}\n${commented}\n`
}
