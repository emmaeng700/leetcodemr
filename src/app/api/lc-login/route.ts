import { NextRequest, NextResponse } from 'next/server'

const LC_LOGIN_URL = 'https://leetcode.com/accounts/login/'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function extractCookie(setCookieHeaders: string[], name: string): string {
  for (const header of setCookieHeaders) {
    const parts = header.split(';')
    const pair = parts[0].trim()
    const eqIdx = pair.indexOf('=')
    if (eqIdx === -1) continue
    const key = pair.slice(0, eqIdx).trim()
    const val = pair.slice(eqIdx + 1).trim()
    if (key === name) return val
  }
  return ''
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username?.trim() || !password?.trim()) {
      return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 })
    }

    // Step 1: GET the login page to obtain initial csrftoken cookie
    const getRes = await fetch(LC_LOGIN_URL, {
      method: 'GET',
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      cache: 'no-store',
    })

    const setCookieGet = getRes.headers.getSetCookie?.() ?? []
    const csrfInit = extractCookie(setCookieGet, 'csrftoken')
    if (!csrfInit) {
      return NextResponse.json(
        { error: 'Could not reach LeetCode login page. Try again.' },
        { status: 502 },
      )
    }

    // Step 2: POST credentials
    const body = new URLSearchParams({
      login: username.trim(),
      password: password.trim(),
      csrfmiddlewaretoken: csrfInit,
      next: '/problemset/',
    })

    const postRes = await fetch(LC_LOGIN_URL, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: LC_LOGIN_URL,
        Origin: 'https://leetcode.com',
        Cookie: `csrftoken=${csrfInit}`,
      },
      body: body.toString(),
      redirect: 'manual',
      cache: 'no-store',
    })

    const setCookiePost = postRes.headers.getSetCookie?.() ?? []
    const lcSession = extractCookie(setCookiePost, 'LEETCODE_SESSION')
    const csrfToken = extractCookie(setCookiePost, 'csrftoken') || csrfInit

    // Login succeeded if we get a LEETCODE_SESSION cookie back
    if (!lcSession) {
      // 200 means we stayed on the login page (wrong creds or CAPTCHA)
      if (postRes.status === 200 || postRes.status === 302) {
        const html = postRes.status === 200 ? await postRes.text() : ''
        if (html.includes('Your username and/or password') || html.includes('Please enter a correct')) {
          return NextResponse.json({ error: 'Incorrect username or password.' }, { status: 401 })
        }
        if (html.toLowerCase().includes('captcha') || html.toLowerCase().includes('recaptcha')) {
          return NextResponse.json(
            { error: 'LeetCode is requiring a CAPTCHA. Please paste your cookies manually instead.' },
            { status: 403 },
          )
        }
      }
      return NextResponse.json(
        { error: 'Login failed. LeetCode may require a CAPTCHA — use the cookie method instead.' },
        { status: 401 },
      )
    }

    return NextResponse.json({ lc_session: lcSession, lc_csrf: csrfToken })
  } catch (err) {
    return NextResponse.json({ error: `Login request failed: ${String(err)}` }, { status: 500 })
  }
}
