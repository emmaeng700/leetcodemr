import { NextRequest, NextResponse } from 'next/server'

const JUDGE0 = 'https://ce.judge0.com'

function b64encode(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64')
}

function b64decode(str: string | null | undefined): string {
  if (!str) return ''
  return Buffer.from(str, 'base64').toString('utf-8')
}

export async function POST(req: NextRequest) {
  try {
    const { source_code, language_id } = await req.json()

    // Submit with base64 encoding to handle emojis and special chars
    const submitRes = await fetch(`${JUDGE0}/submissions?base64_encoded=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_code: b64encode(source_code), language_id }),
    })
    const { token } = await submitRes.json()
    if (!token) {
      return NextResponse.json({ error: 'No token from Judge0' }, { status: 500 })
    }

    // Poll until done
    let result: any = null
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 700))
      const r = await fetch(`${JUDGE0}/submissions/${token}?base64_encoded=true`)
      result = await r.json()
      if (result?.status?.id > 2) break
    }

    if (!result) {
      return NextResponse.json({ error: 'Timed out' }, { status: 500 })
    }

    // Decode base64 fields before returning
    return NextResponse.json({
      ...result,
      stdout: b64decode(result.stdout),
      stderr: b64decode(result.stderr),
      compile_output: b64decode(result.compile_output),
      message: b64decode(result.message),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
