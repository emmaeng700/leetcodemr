import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/** Public assets Grind needs without login (offline + first visit). */
function isPublicAsset(pathname: string): boolean {
  if (
    pathname === '/grind-offline.html' ||
    pathname === '/grind-offline-editor.js' ||
    pathname === '/grind_questions.json' ||
    pathname === '/questions_data_all.json' ||
    pathname === '/playbook_data_all.json' ||
    pathname === '/description-images-manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/manifest.json' ||
    pathname === '/offline.html'
  ) {
    return true
  }
  if (pathname.startsWith('/description-images/')) return true
  if (pathname.startsWith('/sw-v')) return true
  if (/\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|css|js|json|map)$/i.test(pathname)) {
    return true
  }
  return false
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow: login, APIs, grind (offline-capable public), grind assets
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/') ||
    pathname === '/grind' ||
    pathname.startsWith('/grind/') ||
    isPublicAsset(pathname)
  ) {
    return NextResponse.next()
  }

  const auth = request.cookies.get('lm_auth')
  if (!auth || auth.value !== 'authenticated') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons).*)'],
}
