'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { GrindLang } from '@/lib/grindStorage'

type GrindLangContextValue = {
  lang: GrindLang
  setLang: (lang: GrindLang) => void
}

const GrindLangContext = createContext<GrindLangContextValue | null>(null)

export function GrindLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<GrindLang>('python3')
  const value = useMemo(() => ({ lang, setLang }), [lang])
  return <GrindLangContext.Provider value={value}>{children}</GrindLangContext.Provider>
}

export function useGrindLang() {
  const ctx = useContext(GrindLangContext)
  if (!ctx) throw new Error('useGrindLang must be used within GrindLangProvider')
  return ctx
}
