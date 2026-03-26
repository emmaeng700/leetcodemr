import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const LC = 'https://leetcode.com'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch credentials from profiles (more secure than sending over wire)
    const { data: profile } = await supabase
      .from('profiles')
      .select('leetcode_session, leetcode_csrf')
      .eq('id', user.id)
      .single()

    const session = profile?.leetcode_session
    const csrfToken = profile?.leetcode_csrf

    if (!session || !csrfToken) {
      return NextResponse.json({ error: 'LeetCode credentials not configured. Please update them in your profile.' }, { status: 401 })
    }

    const { titleSlug, questionId, lang, code, testInput } = await req.json()

    const res = await fetch(`${LC}/problems/${titleSlug}/interpret_solution/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `LEETCODE_SESSION=${session}; csrftoken=${csrfToken}`,
        'X-CSRFToken': csrfToken,
        'Referer': `${LC}/problems/${titleSlug}/`,
        'Origin': LC,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      body: JSON.stringify({
        lang,
        question_id: String(questionId),
        typed_code: code,
        data_input: testInput,
      }),
    })

    const data = await res.json()

    if (!res.ok || data.error) {
      return NextResponse.json({ error: data.error || `LeetCode returned ${res.status}` }, { status: res.status })
    }

    // Returns { interpret_id: "...", test_case: "..." }
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
