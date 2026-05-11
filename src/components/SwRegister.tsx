'use client'
import { useEffect } from 'react'

export default function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          void reg.update()
        })
        .catch(() => {})
    }
  }, [])
  return null
}
