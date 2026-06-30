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

/** Trim code to just before where the interview block should be inserted. */
function codeBaseForInterviewInsert(code: string, lang: GrindLang): string {
  const lines = code.split('\n')
  const lastCheck = findLastCheckLineIndex(code)
  if (lastCheck >= 0) return lines.slice(0, lastCheck + 1).join('\n')

  let testIdx = -1
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if ((t.includes('Test') || t.includes('Examples')) && t.startsWith('#')) testIdx = i
  }
  if (testIdx >= 0) {
    let end = testIdx
    for (let i = testIdx + 1; i < lines.length; i++) {
      const t = lines[i].trim()
      if (t.startsWith(interviewMarker(lang)) || t.startsWith('# PHASE 1') || t.startsWith('// PHASE 1')) break
      end = i
    }
    return lines.slice(0, end + 1).join('\n')
  }

  return code.replace(/\s+$/, '')
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

/** Pull the interview tail from a full starter (marker + STAR-LC script). */
export function extractInterviewSection(starter: string, lang: GrindLang): string | null {
  const marker = interviewMarker(lang)
  const markerIdx = starter.indexOf(marker)
  if (markerIdx >= 0) return starter.slice(markerIdx).trimEnd()

  const phase = lang === 'python3' ? '# PHASE 1' : '// PHASE 1'
  const phaseIdx = starter.indexOf(phase)
  if (phaseIdx >= 0) return starter.slice(phaseIdx).trimEnd()

  return null
}

/** Ensure saved drafts pick up interview scripts added after the user first opened a question. */
export function upgradeCodeWithInterview(
  code: string,
  starter: string,
  lang: GrindLang,
  script?: string,
): string {
  if (starterHasInterviewApproach(code, lang)) return code

  let tail = extractInterviewSection(starter, lang)
  if (!tail && script?.trim()) {
    tail = `${interviewMarker(lang)}\n${interviewScriptForLang(script, lang)}`.trimEnd()
  }
  if (!tail) return code

  const base = codeBaseForInterviewInsert(code, lang)
  return `${base}\n\n\n\n${tail}\n`
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

  const base = codeBaseForInterviewInsert(starter, lang)
  return `${base}${separator}${marker}\n${commented}\n`
}
