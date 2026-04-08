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
    'python': 'python', 'python3': 'python', 'python2': 'python', 'py': 'python',
    'c++': 'cpp', 'cpp': 'cpp', 'c plus plus': 'cpp',
    'java': 'java',
    'javascript': 'javascript', 'js': 'javascript',
    'typescript': 'typescript', 'ts': 'typescript',
    'go': 'go', 'golang': 'go',
    'rust': 'rust',
    'ruby': 'ruby',
    'swift': 'swift',
    'kotlin': 'kotlin',
    'scala': 'scala',
  }
  return map[raw.toLowerCase().trim()] ?? raw.toLowerCase().trim()
}

function detectLangFromCode(code: string): string {
  if (/\bvector\b|\bstd::\b|\bint main\b/.test(code)) return 'cpp'
  if (/^\s*class Solution\s*\{/.test(code)) return 'cpp'
  if (/^\s*class Solution\s*:/.test(code) || /\bdef\s+\w+\(self/.test(code)) return 'python'
  if (/\bpublic\s+class\s+Solution\b/.test(code)) return 'java'
  if (/\bfunc\s+\w+\(/.test(code) && /\[?\]/.test(code)) return 'go'
  if (/\bconst\s+\w+\s*=\s*function\b|\blet\s+\w+\b/.test(code)) return 'javascript'
  return 'text'
}

function cleanCode(raw: string): string {
  return raw
    .replace(/<span[^>]*>/gi, '').replace(/<\/span>/gi, '')
    .replace(/<code[^>]*>/gi, '').replace(/<\/code>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'").replace(/&#x2F;/g, '/')
    .trim()
}

/**
 * WalkCC + LeetDoocs both use MkDocs Material theme with:
 *   <label>C++</label> ... <label>Python</label>
 *   <td class="code"><div><pre><code>...actual code...</code></pre></div></td>
 *   <td class="linenos"><pre>1\n2\n3...</pre></td>  ← we SKIP this
 *
 * Strategy: extract all language labels in order, extract all td.code blocks
 * in order, then zip them together.
 */
function extractHighlightTableBlocks(html: string): Array<{ code: string; lang: string }> {
  // 1. Collect language labels in page order
  const labels: Array<{ idx: number; text: string }> = []
  const labelRe = /<label[^>]*>([^<]+)<\/label>/gi
  let lm: RegExpExecArray | null
  while ((lm = labelRe.exec(html)) !== null) {
    const text = lm[1].trim()
    if (/python|c\+\+|java|go|rust|javascript|typescript|ruby|swift|kotlin|scala/i.test(text)) {
      labels.push({ idx: lm.index, text })
    }
  }

  // 2. Collect code from <td class="code"> only (skips linenos td)
  const codeBlocks: Array<{ idx: number; code: string }> = []
  const tdRe = /<td[^>]+class="[^"]*\bcode\b[^"]*"[^>]*>/gi
  let tm: RegExpExecArray | null
  while ((tm = tdRe.exec(html)) !== null) {
    const slice = html.slice(tm.index, tm.index + 8000)
    const codeM = slice.match(/<code[^>]*>([\s\S]*?)<\/code>/)
    if (!codeM) continue
    const code = cleanCode(codeM[1])
    if (code.length > 80) codeBlocks.push({ idx: tm.index, code })
  }

  // 3. Match each code block with its nearest preceding label
  return codeBlocks.map(block => {
    const preceding = labels.filter(l => l.idx < block.idx)
    const label = preceding.length ? preceding[preceding.length - 1].text : ''
    const lang = label ? normalizeLang(label) : detectLangFromCode(block.code)
    return { code: block.code, lang }
  })
}

/**
 * SimplyLeet uses: <pre ...><code class="language-python">...spans with inline styles...</code></pre>
 */
function extractSimplyLeet(html: string): Array<{ code: string; lang: string }> {
  const blocks: Array<{ code: string; lang: string }> = []
  // Match <code class="language-X" ...>...</code>
  const codeRe = /<code[^>]+class="[^"]*language-([a-zA-Z0-9+#]+)[^"]*"[^>]*>([\s\S]*?)<\/code>/gi
  let m: RegExpExecArray | null
  while ((m = codeRe.exec(html)) !== null) {
    const code = cleanCode(m[2])
    // Must be long enough to be a real solution (not an inline expression)
    if (code.length > 80) blocks.push({ code, lang: normalizeLang(m[1]) })
  }
  return blocks
}

/** Generic fallback: all <pre> blocks (avoids linenos by checking content) */
function extractGeneric(html: string): Array<{ code: string; lang: string }> {
  const blocks: Array<{ code: string; lang: string }> = []
  const preRe = /<pre[^>]*>([\s\S]*?)<\/pre>/gi
  let m: RegExpExecArray | null
  while ((m = preRe.exec(html)) !== null) {
    const langM = m[0].match(/(?:language-|lang-)([a-zA-Z0-9+#]+)/i)
      ?? m[1].match(/(?:language-|lang-)([a-zA-Z0-9+#]+)/i)
    const code = cleanCode(m[1])
    // Skip if it looks like just line numbers (digits and newlines only)
    if (/^\d[\d\s]*$/.test(code)) continue
    if (code.length > 80) blocks.push({ code, lang: normalizeLang(langM?.[1] ?? detectLangFromCode(code)) })
  }
  return blocks
}

async function findLeetCodeCaUrl(id: string): Promise<string> {
  const fallback = `https://leetcode.ca/`
  try {
    // Sitemap has all post URLs — pattern: /YYYY-MM-DD-{id}-Title/
    const res = await fetch('https://leetcode.ca/sitemap.xml', {
      headers: UA,
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return fallback
    const xml = await res.text()
    // Match a <loc> containing -{id}- surrounded by date prefix and title suffix
    const re = new RegExp(`<loc>(https://leetcode\\.ca/\\d{4}-\\d{2}-\\d{2}-${id}-[^<]+)</loc>`, 'i')
    const match = xml.match(re)
    if (match) return match[1]
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

  if (site === 'leetcodeca') {
    url = await findLeetCodeCaUrl(id)
  }

  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(12000) })
    if (!res.ok) {
      return NextResponse.json({ error: `Site returned ${res.status}`, blocks: [], url })
    }

    const html = await res.text()

    let blocks: Array<{ code: string; lang: string }> = []

    if (site === 'walkccc' || site === 'doocs') {
      blocks = extractHighlightTableBlocks(html)
      if (!blocks.length) blocks = extractGeneric(html)
    } else if (site === 'simplyleet' || site === 'leetcodeca') {
      // Both use <code class="language-X"> pattern
      blocks = extractSimplyLeet(html)
      if (!blocks.length) blocks = extractGeneric(html)
    } else {
      blocks = extractGeneric(html)
    }

    return NextResponse.json({ blocks, url })
  } catch (err) {
    return NextResponse.json({ error: String(err), blocks: [], url })
  }
}
