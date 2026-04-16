'use client'
import { createContext, useContext, useEffect } from 'react'

const ThemeCtx = createContext({ theme: 'light' as const })

export function useTheme() {
  return useContext(ThemeCtx)
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Force light mode: remove any stale dark class and lock to light
  useEffect(() => {
    document.documentElement.classList.remove('dark')
    document.documentElement.classList.add('light')
    localStorage.setItem('theme', 'light')
  }, [])

  return (
    <ThemeCtx.Provider value={{ theme: 'light' }}>
      {children}
    </ThemeCtx.Provider>
  )
}
