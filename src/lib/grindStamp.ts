import type { GrindLang } from '@/lib/grindStorage'

/** Fix drafts saved with literal backslash-n instead of real newlines (offline page bug). */
export function normalizeGrindCode(code: string): string {
  let out = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!out.includes('\n') && out.includes('\\n')) {
    out = out.replace(/\\n/g, '\n').replace(/\\t/g, '\t')
  }
  return out
}

/** Detect the removed `# Grind:` / `// Grind:` header left in old drafts. */
export function hasGrindStamp(code: string, lang: GrindLang): boolean {
  const first = code.split('\n')[0]?.trim() ?? ''
  return lang === 'python3' ? first.startsWith('# Grind:') : first.startsWith('// Grind:')
}

/** Remove the legacy in-code grind timestamp header (feature removed). */
export function stripGrindStamp(code: string, lang: GrindLang): string {
  const lines = code.split('\n')
  if (lines.length === 0) return code
  if (hasGrindStamp(code, lang)) return lines.slice(1).join('\n')
  return code
}
