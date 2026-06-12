export type LearnSet = 1 | 2 | 3

export const LEARN_SETS: LearnSet[] = [1, 2, 3]

export function learnHubHref(set: LearnSet, tab: 'questions' | 'cycles' = 'questions'): string {
  return `/learn?set=${set}&tab=${tab}`
}

export function parseLearnSet(value: string | null | undefined): LearnSet {
  const n = parseInt(value ?? '1', 10)
  if (n === 2) return 2
  if (n === 3) return 3
  return 1
}

export function activeLearnSetFromPath(pathname: string): LearnSet | null {
  if (pathname.startsWith('/learn2')) return 2
  if (pathname.startsWith('/learn3')) return 3
  if (pathname === '/learn' || pathname.startsWith('/learn/')) return 1
  return null
}

export function isLearnSectionPath(pathname: string): boolean {
  return activeLearnSetFromPath(pathname) !== null
}

export function learnSetLabel(set: LearnSet): string {
  return set === 1 ? 'L1' : set === 2 ? 'L2' : 'L3'
}
