'use client'

import Link from 'next/link'
import type { ComponentProps } from 'react'

/** In dev, use full page loads to avoid Turbopack RSC "Failed to fetch" on client nav. */
const FULL_PAGE_NAV = process.env.NODE_ENV === 'development'

type Props = ComponentProps<typeof Link>

function hrefToString(href: Props['href']): string {
  if (typeof href === 'string') return href
  if (href && typeof href === 'object') {
    const pathname = href.pathname ?? '/'
    const query = href.query
    if (!query || typeof query !== 'object') return pathname
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) {
      if (v == null) continue
      params.set(k, String(v))
    }
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }
  return '/'
}

export default function AppNavLink({ href, prefetch = false, children, ...props }: Props) {
  if (FULL_PAGE_NAV) {
    const { className, onClick, ...rest } = props
    return (
      <a
        href={hrefToString(href)}
        className={className}
        onClick={onClick}
        {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {children}
      </a>
    )
  }
  return (
    <Link href={href} prefetch={prefetch} {...props}>
      {children}
    </Link>
  )
}
