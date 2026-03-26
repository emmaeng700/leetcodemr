import { NextResponse } from 'next/server'

// This route is kept for backward compatibility but auth is now handled
// directly in the login page using Supabase client-side auth.
export async function POST() {
  return NextResponse.json({ error: 'Use Supabase auth instead' }, { status: 410 })
}
