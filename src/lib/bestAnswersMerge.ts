import {
  LEETCODE_ACCEPTED_COLOR,
  LEETCODE_ACCEPTED_LABEL,
  type LeetCodeAcceptedBlock,
} from '@/lib/useLeetCodeAcceptedBlocks'

export const BEST_ANSWER_SITES = [
  { key: 'walkccc',    label: 'WalkCC',      color: 'text-blue-400',    border: 'border-blue-500/30',    bg: 'bg-blue-500/5'    },
  { key: 'doocs',      label: 'LeetDoocs',   color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5' },
  { key: 'simplyleet', label: 'SimplyLeet',  color: 'text-purple-400',  border: 'border-purple-500/30',  bg: 'bg-purple-500/5'  },
  { key: 'leetcodeca', label: 'LeetCode.ca', color: 'text-orange-400',  border: 'border-orange-500/30',  bg: 'bg-orange-500/5'  },
] as const

type SiteKey = (typeof BEST_ANSWER_SITES)[number]['key']

export type BestAnswerDeckCard = {
  siteKey: SiteKey | 'leetcode'
  siteLabel: string
  siteColor: string
  url: string
  code: string
  lang: string
  isLeetCodeAccepted?: boolean
}

type SiteState = {
  blocks: { code: string; lang: string }[]
  url: string
}

export const DISPLAY_LANG_ORDER = ['python', 'cpp', 'javascript'] as const

export function compareDisplayLang(a: string, b: string) {
  const ai = DISPLAY_LANG_ORDER.indexOf(a as (typeof DISPLAY_LANG_ORDER)[number])
  const bi = DISPLAY_LANG_ORDER.indexOf(b as (typeof DISPLAY_LANG_ORDER)[number])
  const av = ai === -1 ? Number.MAX_SAFE_INTEGER : ai
  const bv = bi === -1 ? Number.MAX_SAFE_INTEGER : bi
  if (av !== bv) return av - bv
  return a.localeCompare(b)
}

export function labelForLang(lang: string) {
  if (lang === 'cpp') return 'C++'
  if (lang === 'javascript') return 'JavaScript'
  if (lang === 'python') return 'Python'
  return lang
}

/** Per language: your latest LeetCode AC first (?), then community site answers. */
export function buildBestAnswerDeck(
  states: Record<SiteKey, SiteState>,
  lcBlocks: LeetCodeAcceptedBlock[],
  slug: string,
  normalizedPreferredLangs: string[],
): BestAnswerDeckCard[] {
  const communityByLang = new Map<string, BestAnswerDeckCard[]>()

  for (const site of BEST_ANSWER_SITES) {
    const s = states[site.key]
    if (!s?.blocks?.length) continue
    for (const b of s.blocks) {
      const card: BestAnswerDeckCard = {
        siteKey: site.key,
        siteLabel: site.label,
        siteColor: site.color,
        url: s.url,
        code: b.code,
        lang: b.lang,
      }
      const list = communityByLang.get(b.lang) ?? []
      list.push(card)
      communityByLang.set(b.lang, list)
    }
  }

  const langSet = new Set<string>([
    ...communityByLang.keys(),
    ...lcBlocks.map(b => b.lang),
  ])

  const sortedLangs = [...langSet].sort((a, b) => {
    const ai = normalizedPreferredLangs.indexOf(a)
    const bi = normalizedPreferredLangs.indexOf(b)
    if (ai !== -1 || bi !== -1) {
      const av = ai === -1 ? Number.MAX_SAFE_INTEGER : ai
      const bv = bi === -1 ? Number.MAX_SAFE_INTEGER : bi
      if (av !== bv) return av - bv
    }
    return compareDisplayLang(a, b)
  })

  const deck: BestAnswerDeckCard[] = []
  for (const lang of sortedLangs) {
    const lc = lcBlocks.find(b => b.lang === lang)
    if (lc) {
      deck.push({
        siteKey: 'leetcode',
        siteLabel: LEETCODE_ACCEPTED_LABEL,
        siteColor: LEETCODE_ACCEPTED_COLOR,
        url: `https://leetcode.com/problems/${encodeURIComponent(slug)}/submissions/`,
        code: lc.code,
        lang: lc.lang,
        isLeetCodeAccepted: true,
      })
    }
    deck.push(...(communityByLang.get(lang) ?? []))
  }
  return deck
}

/** Group cards by language with LeetCode AC first in each group. */
export function buildBestAnswerLangGroups(
  states: Record<SiteKey, SiteState>,
  lcBlocks: LeetCodeAcceptedBlock[],
  slug: string,
): { lang: string; cards: BestAnswerDeckCard[] }[] {
  const deck = buildBestAnswerDeck(states, lcBlocks, slug, [])
  const map = new Map<string, BestAnswerDeckCard[]>()
  for (const card of deck) {
    const list = map.get(card.lang) ?? []
    list.push(card)
    map.set(card.lang, list)
  }
  return [...map.keys()]
    .sort(compareDisplayLang)
    .map(lang => ({ lang, cards: map.get(lang)! }))
}
