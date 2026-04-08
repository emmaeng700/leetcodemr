import { NextRequest, NextResponse } from 'next/server'

const UA = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
}

function buildUrl(site: string, slug: string, id: string): string {
  switch (site) {
    case 'walkccc':    return `https://walkccc.me/LeetCode/problems/${id}/`
    case 'doocs':      return `https://leetcode.doocs.org/en/lc/${id}/`
    case 'simplyleet': return `https://www.simplyleet.com/${slug}`
    case 'leetcodeca': return `https://leetcode.ca/`
    default:           return ''
  }
}

function normalizeLang(raw: string): string {
  const map: Record<string, string> = {
    py: 'python', python3: 'python', python2: 'python',
    js: 'javascript', ts: 'typescript',
    'c++': 'cpp', cpp: 'cpp', cplusplus: 'cpp',
    golang: 'go',
  }
  return map[raw.toLowerCase()] ?? raw.toLowerCase()
}

function extractCodeBlocks(html: string): Array<{ code: string; lang: string }> {
  const blocks: Array<{ code: string; lang: string }> = []
  const preRe = /<pre[^>]*>([\s\S]*?)<\/pre>/gi
  let m: RegExpExecArray | null

  while ((m = preRe.exec(html)) !== null) {
    const preTag = m[0]
    const inner  = m[1]

    // Detect language from class attributes on <pre> or <code>
    const langM =
      preTag.match(/class="[^"]*(?:language-|lang-)([a-zA-Z0-9+#]+)/i) ??
      inner.match(/class="[^"]*(?:language-|lang-)([a-zA-Z0-9+#]+)/i) ??
      preTag.match(/data-lang(?:uage)?="([a-zA-Z0-9+#]+)"/i) ??
      inner.match(/data-lang(?:uage)?="([a-zA-Z0-9+#]+)"/i)

    const code = inner
      .replace(/<span[^>]*>/gi, '').replace(/<\/span>/gi, '')
      .replace(/<code[^>]*>/gi, '').replace(/<\/code>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
      .replace(/&#x27;/g, "'").replace(/&#x2F;/g, '/')
      .trim()

    if (code.length > 15) {
      blocks.push({ code, lang: normalizeLang(langM?.[1] ?? 'text') })
    }
  }

  return blocks
}

/** For LeetCode.ca, discover the actual problem URL from their site */
async function findLeetCodeCaUrl(id: string): Promise<string> {
  const fallback = `https://leetcode.ca/`
  try {
    // Their all-posts page lists everything
    const res = await fetch('https://leetcode.ca/all/', {
      headers: UA,
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return fallback
    const html = await res.text()
    // Links look like href="/2016-05-01-1-Two-Sum/"
    const re = new RegExp(`href="(/[^"]*[-/]${id}[-/][^"]*)"`, 'i')
    const match = html.match(re)
    if (match) return `https://leetcode.ca${match[1]}`
  } catch { /* ignore */ }
  return fallback
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const site = searchParams.get('site') ?? ''
  const slug = searchParams.get('slug') ?? ''
  const id   = searchParams.get('id')   ?? ''

  if (!site || (!slug && !id)) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  let url = buildUrl(site, slug, id)
  if (!url) return NextResponse.json({ error: 'Unknown site' }, { status: 400 })

  // LeetCode.ca requires date-based URL discovery
  if (site === 'leetcodeca') {
    url = await findLeetCodeCaUrl(id)
  }

  try {
    const res = await fetch(url, {
      headers: UA,
      signal: AbortSignal.timeout(12000),
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Site returned ${res.status}`, blocks: [], url })
    }

    const html = await res.text()
    const blocks = extractCodeBlocks(html)

    return NextResponse.json({ blocks, url })
  } catch (err) {
    return NextResponse.json({ error: String(err), blocks: [], url })
  }
}
