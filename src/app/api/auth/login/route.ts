import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { passcode } = await request.json()

  if (passcode === process.env.APP_PASSCODE) {
    const response = NextResponse.json({ success: true })
    response.cookies.set('lm_auth', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })
    return response
  }

  return NextResponse.json({ success: false, error: 'Wrong passcode' }, { status: 401 })
}
