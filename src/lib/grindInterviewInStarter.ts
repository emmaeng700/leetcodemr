import type { GrindLang } from '@/lib/grindStorage'
import { formatDescriptionPlain } from '@/lib/formatDescription'
import { acceptedMarker } from '@/lib/grindLcAccepted'

export const DESCRIPTION_MARKER_PY = '# -- Problem Description --'
export const DESCRIPTION_MARKER_CPP = '// -- Problem Description --'
export const INTERVIEW_MARKER_PY = '# -- Interview Approach - STAR-LC --'
export const INTERVIEW_MARKER_CPP = '// -- Interview Approach - STAR-LC --'

const SEPARATOR = '\n\n\n\n'
export const EXAMPLES_MARKER = '# \u2500\u2500 Examples \u2500\u2500'
export const TEST_MARKER = '# \u2500\u2500 Test \u2500\u2500'

function descriptionMarker(lang: GrindLang): string {
  return lang === 'python3' ? DESCRIPTION_MARKER_PY : DESCRIPTION_MARKER_CPP
}

function interviewMarker(lang: GrindLang): string {
  return lang === 'python3' ? INTERVIEW_MARKER_PY : INTERVIEW_MARKER_CPP
}

export function stripDescriptionSection(code: string, lang: GrindLang): string {
  const marker = descriptionMarker(lang)
  const start = code.indexOf(marker)
  if (start < 0) return code

  const tail = code.slice(start)
  const iaIdx = tail.indexOf(interviewMarker(lang))
  const phaseIdx = tail.indexOf(lang === 'python3' ? '# PHASE 1' : '// PHASE 1')
  const acIdx = tail.indexOf(acceptedMarker(lang))
  let end = tail.length
  if (iaIdx > 0) end = Math.min(end, iaIdx)
  if (phaseIdx > 0) end = Math.min(end, phaseIdx)
  if (acIdx > 0) end = Math.min(end, acIdx)

  const before = code.slice(0, start).replace(/\s+$/, '')
  const after = tail.slice(end).replace(/^\s+/, '')
  if (!after) return before
  return `${before}\n\n${after}`
}

/** Normalize HTML or plain-text problem statements for comment blocks. */
export function htmlToPlainText(html: string): string {
  const raw = html.trim()
  if (!raw) return ''

  let text = raw
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")

  if (/<[a-zA-Z]/.test(text)) {
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(text, 'text/html')
      text = doc.body.textContent || ''
    } else {
      text = text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li>/gi, '\u2022 ')
        .replace(/<sup>(.*?)<\/sup>/gi, '^$1')
        .replace(/<sub>(.*?)<\/sub>/gi, '_$1')
        .replace(/<code>(.*?)<\/code>/gi, '$1')
        .replace(/<strong>(.*?)<\/strong>/gi, '$1')
        .replace(/<[^>]+>/g, ' ')
    }
  }

  return formatDescriptionPlain(
    text
      .replace(/\r\n/g, '\n')
      .replace(/\u00a0/g, ' ')
      .trim(),
  )
}

export function descriptionForLang(description: string, lang: GrindLang): string {
  const plain = /<[a-zA-Z]/.test(description)
    ? htmlToPlainText(description)
    : description.trim()
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

export function starterHasExamplesSection(starter: string): boolean {
  return starter.includes(EXAMPLES_MARKER) || starter.includes(TEST_MARKER)
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
    acceptedMarker(lang),
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
        t.startsWith(acceptedMarker(lang)) ||
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
  const acIdx = tail.indexOf(acceptedMarker(lang))
  let end = tail.length
  if (iaIdx > 0) end = Math.min(end, iaIdx)
  if (phaseIdx > 0) end = Math.min(end, phaseIdx)
  if (acIdx > 0) end = Math.min(end, acIdx)
  return tail.slice(0, end).trimEnd()
}

/** Pull the interview tail from a full starter (marker + STAR-LC script). */
export function extractInterviewSection(starter: string, lang: GrindLang): string | null {
  const marker = interviewMarker(lang)
  let markerIdx = starter.indexOf(marker)
  if (markerIdx < 0) {
    const phase = lang === 'python3' ? '# PHASE 1' : '// PHASE 1'
    markerIdx = starter.indexOf(phase)
  }
  if (markerIdx < 0) return null

  const tail = starter.slice(markerIdx)
  const acIdx = tail.indexOf(acceptedMarker(lang))
  if (acIdx > 0) return tail.slice(0, acIdx).trimEnd()
  return tail.trimEnd()
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
  const hasEx = starterHasExamplesSection(code)
  const hasDesc = starterHasDescription(code, lang)
  const hasIa = starterHasInterviewApproach(code, lang)
  if (hasEx && hasDesc && hasIa) return code

  let base = codeBaseForLearningInsert(code, lang)
  if (!hasEx) {
    const starterBase = codeBaseForLearningInsert(starter, lang)
    if (starterHasExamplesSection(starterBase)) base = starterBase
  }

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
  const stripped = stripDescriptionSection(code, lang)
  return upgradeCodeWithLearning(stripped, starter, lang, undefined, script)
}

/** @deprecated Use appendGrindLearningToStarter */
export function appendInterviewApproachToStarter(
  starter: string,
  script: string | undefined,
  lang: GrindLang,
): string {
  return appendGrindLearningToStarter(starter, undefined, script, lang)
}
