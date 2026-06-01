'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Client-side redirect so we can restore the last-visited question from localStorage.
export default function LearnRedirect() {
  const router = useRouter()
  useEffect(() => {
    try {
      const saved = parseInt(localStorage.getItem('lm_learn_idx') ?? '0', 10)
      const idx = Number.isFinite(saved) && saved > 0 ? saved : 0
      router.replace(`/learn/${idx}`)
    } catch {
      router.replace('/learn/0')
    }
  }, [router])
  return null
}
