import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import SwRegister from '@/components/SwRegister'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LeetMastery',
  description: 'Personal LeetCode study app — 331 questions with solutions, spaced repetition and practice zone.',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SwRegister />
        {children}
      </body>
    </html>
  )
}
