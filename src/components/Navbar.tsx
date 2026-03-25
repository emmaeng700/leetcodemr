'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BookOpen, Menu, X, LogOut, Home, BarChart2, Brain,
  Layers, GitBranch, MessageSquare, Gem, Server, Clock,
  Calendar, Info, Timer, Code2
} from 'lucide-react'

const NAV_LINKS = [
  { href: '/',              label: 'Questions',    icon: Home },
  { href: '/daily',         label: 'Daily',        icon: Calendar },
  { href: '/stats',         label: 'Stats',        icon: BarChart2 },
  { href: '/review',        label: 'Reviews',      icon: Brain },
  { href: '/learn/0',       label: 'Learn',        icon: BookOpen },
  { href: '/flashcards',    label: 'Flashcards',   icon: Layers },
  { href: '/quick-review',  label: 'Quick Review', icon: Clock },
  { href: '/patterns',      label: 'Patterns',     icon: GitBranch },
  { href: '/behavioral',    label: 'Behavioral',   icon: MessageSquare },
  { href: '/gems',          label: 'Gems',         icon: Gem },
  { href: '/system-design', label: 'System Design',icon: Server },
  { href: '/mock',          label: 'Mock',         icon: Timer },
  { href: '/dsa',           label: 'DSA',          icon: Code2 },
  { href: '/about',         label: 'About',        icon: Info },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        {/* Top row: logo + logout/hamburger */}
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2 font-black text-indigo-600 text-lg shrink-0">
            <BookOpen size={22} />
            <span className="hidden sm:inline">LeetMastery</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut size={15} />
              <span>Logout</span>
            </button>
            <button
              onClick={() => setOpen(o => !o)}
              className="md:hidden p-2 text-gray-500 hover:text-gray-800 rounded-lg"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Desktop Nav — wraps onto next row(s) if needed, no scrollbar */}
        <div className="hidden md:flex flex-wrap items-center gap-1 pb-2">
          {NAV_LINKS.map(({ href, label }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            )
          })}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 w-full transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      )}
    </nav>
  )
}
