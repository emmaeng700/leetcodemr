'use client'

import { useCallback, useEffect, useState } from 'react'
import { getCookieFromHeader } from '@/lib/leetcodeHttp'
import { lcFetch } from '@/lib/leetcodeLocalConnector'

export type BestAnswerLang = 'python' | 'cpp' | 'javascript'

export type LeetCodeAcceptedBlock = {
  code: string
  lang: BestAnswerLang
  timestamp: number
}

export const LEETCODE_ACCEPTED_LABEL = 'Your LeetCode'
export const LEETCODE_ACCEPTED_COLOR = 'text-amber-400'

export function normalizeBestAnswerLang(lcLang: string): BestAnswerLang | null {
  const l = lcLang.toLowerCase()
  if (l === 'python3' || l === 'python') return 'python'
  if (l === 'cpp') return 'cpp'
  if (l === 'javascript' || l === 'typescript' || l === 'js') return 'javascript'
  return null
}

function getLcCredentials() {
  if (typeof window === 'undefined') return { session: '', csrfToken: '' }
  const session = localStorage.getItem('lc_session') ?? ''
  const csrfToken =
    (localStorage.getItem('lc_csrf') ?? '') || getCookieFromHeader(session, 'csrftoken')
  return { session, csrfToken }
}

async function lcGraphql(
  session: string,
  csrfToken: string,
  query: string,
  variables: Record<string, unknown>,
) {
  const res = await lcFetch('/api/leetcode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session, csrfToken, query, variables }),
  })
  return res.json()
}

/** Most recent accepted submission per language (python / cpp / javascript) from LeetCode. */
export function useLeetCodeAcceptedBlocks(slug: string | undefined, active: boolean) {
  const [blocks, setBlocks] = useState<LeetCodeAcceptedBlock[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!slug) {
      setBlocks([])
      return
    }
    const { session, csrfToken } = getLcCredentials()
    if (!session || !csrfToken) {
      setBlocks([])
      return
    }

    setLoading(true)
    try {
      const r1 = await lcGraphql(
        session,
        csrfToken,
        `query($slug:String!,$offset:Int!,$limit:Int!){questionSubmissionList(questionSlug:$slug,offset:$offset,limit:$limit,status:10){submissions{id lang timestamp}}}`,
        { slug, offset: 0, limit: 40 },
      )
      const subs: { id: string; lang: string; timestamp: string }[] =
        r1?.data?.questionSubmissionList?.submissions ?? []

      const latestByLang = new Map<BestAnswerLang, { id: string; timestamp: string }>()
      for (const s of subs) {
        const norm = normalizeBestAnswerLang(s.lang)
        if (!norm || latestByLang.has(norm)) continue
        latestByLang.set(norm, { id: s.id, timestamp: s.timestamp })
      }

      if (latestByLang.size === 0) {
        setBlocks([])
        return
      }

      const fetched = await Promise.all(
        [...latestByLang.entries()].map(async ([lang, meta]) => {
          const r2 = await lcGraphql(
            session,
            csrfToken,
            `query($id:Int!){submissionDetails(submissionId:$id){code}}`,
            { id: Number(meta.id) },
          )
          const code = r2?.data?.submissionDetails?.code ?? ''
          if (!code.trim()) return null
          return {
            code,
            lang,
            timestamp: Number(meta.timestamp),
          } satisfies LeetCodeAcceptedBlock
        }),
      )

      const order: BestAnswerLang[] = ['python', 'cpp', 'javascript']
      setBlocks(
        fetched
          .filter((b): b is LeetCodeAcceptedBlock => b != null)
          .sort((a, b) => order.indexOf(a.lang) - order.indexOf(b.lang)),
      )
    } catch {
      setBlocks([])
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    if (!active || !slug) {
      setBlocks([])
      return
    }
    void load()
  }, [active, slug, load])

  return { blocks, loading }
}
