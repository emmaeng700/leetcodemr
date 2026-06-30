import type { GrindLang } from '@/lib/grindStorage'

export const DESCRIPTION_MARKER_PY = '# -- Problem Description --'
export const DESCRIPTION_MARKER_CPP = '// -- Problem Description --'
export const INTERVIEW_MARKER_PY = '# -- Interview Approach - STAR-LC --'
export const INTERVIEW_MARKER_CPP = '// -- Interview Approach - STAR-LC --'

const SEPARATOR = '\n\n\n\n'

function descriptionMarker(lang: GrindLang): string {
  return lang === 'python3' ? DESCRIPTION_MARKER_PY : DESCRIPTION_MARKER_CPP
}

function interviewMarker(lang: GrindLang): string {
  return lang === 'python3' ? INTERVIEW_MARKER_PY : INTERVIEW_MARKER_CPP
}

/** Normalize HTML or plain-text problem statements for comment blocks. */
export function htmlToPlainText(html: string): string {
  const raw = html.trim()
  if (!raw) return ''

  let text = raw
  if (raw.includes('<')) {
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(raw, 'text/html')
      text = doc.body.textContent || ''
    } else {
      text = raw
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
    }
  }

  return text
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function descriptionForLang(description: string, lang: GrindLang): string {
  const plain = htmlToPlainText(description)
  if (!plain) return ''
  return plain
    .split('\n')
    .map(line => {
      const trimmed = line.trimEnd()
      if (lang === 'python3') return trimmed ? `# ${trimmed}` : '#'
      return trimmed ? `// ${trimmed}` : '//'
    })
    .join('\n')
}

export function starterHasDescription(starter: string, lang: GrindLang): boolean {
  return starter.includes(descriptionMarker(lang))
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

function stripLearningSections(code: string, lang: GrindLang): string {
  const markers = [
    descriptionMarker(lang),
    interviewMarker(lang),
    lang === 'python3' ? '# PHASE 1' : '// PHASE 1',
  ]
  let cut = code.length
  for (const m of markers) {
    const i = code.indexOf(m)
    if (i >= 0) cut = Math.min(cut, i)
  }
  if (cut < code.length) return code.slice(0, cut).replace(/\s+$/, '')
  return code
}

/** Trim to solution + examples/tests only (before description or interview blocks). */
export function codeBaseForLearningInsert(code: string, lang: GrindLang): string {
  const stripped = stripLearningSections(code, lang)
  if (stripped.length < code.length) return stripped

  const lines = stripped.split('\n')
  const lastCheck = findLastCheckLineIndex(stripped)
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
      if (
        t.startsWith(descriptionMarker(lang)) ||
        t.startsWith(interviewMarker(lang)) ||
        t.startsWith('# PHASE 1') ||
        t.startsWith('// PHASE 1')
      ) {
        break
      }
      end = i
    }
    return lines.slice(0, end + 1).join('\n')
  }

  return stripped.replace(/\s+$/, '')
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

function formatDescriptionBlock(description: string, lang: GrindLang): string {
  const body = descriptionForLang(description, lang)
  if (!body) return ''
  return `${descriptionMarker(lang)}\n${body}`
}

function formatInterviewBlock(script: string, lang: GrindLang): string {
  return `${interviewMarker(lang)}\n${interviewScriptForLang(script, lang)}`
}

/** Pull the description block from a full starter. */
export function extractDescriptionSection(starter: string, lang: GrindLang): string | null {
  const marker = descriptionMarker(lang)
  const start = starter.indexOf(marker)
  if (start < 0) return null

  const tail = starter.slice(start)
  const iaIdx = tail.indexOf(interviewMarker(lang))
  const phaseIdx = tail.indexOf(lang === 'python3' ? '# PHASE 1' : '// PHASE 1')
  let end = tail.length
  if (iaIdx > 0) end = Math.min(end, iaIdx)
  if (phaseIdx > 0) end = Math.min(end, phaseIdx)
  return tail.slice(0, end).trimEnd()
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

function buildLearningTail(
  starter: string,
  lang: GrindLang,
  description?: string,
  interviewScript?: string,
  includeDescription = true,
  includeInterview = true,
): string | null {
  const parts: string[] = []

  if (includeDescription) {
    const block =
      extractDescriptionSection(starter, lang) ||
      (description?.trim() ? formatDescriptionBlock(description, lang) : '')
    if (block) parts.push(block)
  }

  if (includeInterview) {
    const block =
      extractInterviewSection(starter, lang) ||
      (interviewScript?.trim() ? formatInterviewBlock(interviewScript, lang) : '')
    if (block) parts.push(block)
  }

  return parts.length > 0 ? parts.join(SEPARATOR) : null
}

/** Bake description (middle) and interview (bottom) into a starter template. */
export function appendGrindLearningToStarter(
  starter: string,
  description: string | undefined,
  interviewScript: string | undefined,
  lang: GrindLang,
): string {
  const base = codeBaseForLearningInsert(stripLearningSections(starter, lang), lang)
  const tail = buildLearningTail(starter, lang, description, interviewScript, true, true)
  if (!tail) return starter.endsWith('\n') ? starter : `${starter}\n`
  return `${base}${SEPARATOR}${tail}\n`
}

/** Ensure saved drafts pick up description + STAR-LC blocks from the canonical starter. */
export function upgradeCodeWithLearning(
  code: string,
  starter: string,
  lang: GrindLang,
  description?: string,
  interviewScript?: string,
): string {
  const hasDesc = starterHasDescription(code, lang)
  const hasIa = starterHasInterviewApproach(code, lang)
  if (hasDesc && hasIa) return code

  const base = codeBaseForLearningInsert(code, lang)
  const tail = buildLearningTail(
    starter,
    lang,
    description,
    interviewScript,
    !hasDesc,
    !hasIa,
  )
  if (!tail) return code
  return `${base}${SEPARATOR}${tail}\n`
}

/** @deprecated Use upgradeCodeWithLearning */
export function upgradeCodeWithInterview(
  code: string,
  starter: string,
  lang: GrindLang,
  script?: string,
): string {
  return upgradeCodeWithLearning(code, starter, lang, undefined, script)
}

/** @deprecated Use appendGrindLearningToStarter */
export function appendInterviewApproachToStarter(
  starter: string,
  script: string | undefined,
  lang: GrindLang,
): string {
  return appendGrindLearningToStarter(starter, undefined, script, lang)
}
