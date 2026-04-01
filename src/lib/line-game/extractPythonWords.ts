/** Pull identifier-like tokens from source so line-game completions match visible code. */
const IDENT = /[A-Za-z_][A-Za-z0-9_]*/g

export function extractPythonWordsForCompletion(source: string, max = 400): string[] {
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  const re = new RegExp(IDENT.source, 'g')
  while ((m = re.exec(source)) !== null) {
    seen.add(m[0])
    if (seen.size >= max) break
  }
  return [...seen].sort((a, b) => a.localeCompare(b))
}
