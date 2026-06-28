import type { GrindLang } from '@/lib/grindStorage'
import { normalizeGrindCode } from '@/lib/grindStamp'
import { readCachedStarter, writeCachedStarter } from '@/lib/grindStorage'
import type { GrindQuestion } from '@/lib/grindQuestions'

const LC_SNIPPET_QUERY =
  'query($s:String!){question(titleSlug:$s){codeSnippets{langSlug code}}}'

function normalizeCode(raw: string): string {
  return normalizeGrindCode(raw.replace(/\t/g, '    '))
}

export function grindTitleComment(lang: GrindLang, title: string): string {
  return lang === 'python3' ? `# ${title}` : `// ${title}`
}

export function ensureGrindTitleComment(code: string, lang: GrindLang, title: string): string {
  const comment = grindTitleComment(lang, title)
  if (code.startsWith(`${comment}\n`) || code === comment) return code
  return `${comment}\n${code}`
}

function genericStarter(lang: GrindLang, title: string): string {
  const body =
    lang === 'python3'
      ? `class Solution:
    def solve(self):
        # Write your solution from memory
        pass
`
      : `class Solution {
public:
    void solve() {
        // Write your solution from memory
    }
};
`
  return ensureGrindTitleComment(body, lang, title)
}

function starterFromQuestion(q: GrindQuestion, lang: GrindLang): string | null {
  const raw = lang === 'python3' ? q.starterPython : q.starterCpp
  if (!raw) return null
  return ensureGrindTitleComment(normalizeCode(raw), lang, q.title)
}

/** Resolve starter code: bundled JSON ? cached LC snippet ? generic template. */
export function resolveGrindStarterSync(q: GrindQuestion, lang: GrindLang): string {
  const bundled = starterFromQuestion(q, lang)
  if (bundled) return bundled
  const cached = readCachedStarter(q.id, lang)
  if (cached) return cached
  return genericStarter(lang, q.title)
}

export async function fetchLcGrindStarter(slug: string, lang: GrindLang): Promise<string | null> {
  try {
    const res = await fetch('/api/leetcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: LC_SNIPPET_QUERY, variables: { s: slug } }),
    })
    if (!res.ok) return null
    const json = await res.json()
    const snippets: { langSlug: string; code: string }[] =
      json?.data?.question?.codeSnippets ?? []
    const raw = snippets.find(s => s.langSlug === lang)?.code
    if (!raw) return null
    return normalizeCode(raw)
  } catch {
    return null
  }
}

/** Fetch LC starter when online and cache for offline use (Set 2/3). */
export async function ensureGrindStarterCached(q: GrindQuestion, lang: GrindLang): Promise<string> {
  const bundled = starterFromQuestion(q, lang)
  if (bundled) return bundled

  const cached = readCachedStarter(q.id, lang)
  if (cached) return cached

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return genericStarter(lang, q.title)
  }

  const fetched = await fetchLcGrindStarter(q.slug, lang)
  if (fetched) {
    const withTitle = ensureGrindTitleComment(fetched, lang, q.title)
    writeCachedStarter(q.id, lang, withTitle)
    return withTitle
  }

  const fallback = genericStarter(lang, q.title)
  writeCachedStarter(q.id, lang, fallback)
  return fallback
}
