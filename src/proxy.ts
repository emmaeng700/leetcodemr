import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow: login page, APIs, and grind (offline-capable, public)
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/') ||
    pathname === '/grind' ||
    pathname.startsWith('/grind/')
  ) {
    return NextResponse.next()
  }

  // Check auth cookie
  const auth = request.cookies.get('lm_auth')
  if (!auth || auth.value !== 'authenticated') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons).*)'],
}
