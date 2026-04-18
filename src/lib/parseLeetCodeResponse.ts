/**
 * LeetCode HTTP APIs normally return JSON. They sometimes return HTML instead
 * (login wall, Cloudflare, rate limits, bad cookies). Calling `res.json()` on
 * that body throws: SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
 */
export function parseLeetCodeJsonText(
  text: string,
  httpStatus: number,
): { ok: true; data: unknown } | { ok: false; error: string } {
  const t = text.trimStart()
  const probe = t.slice(0, 80).toLowerCase()
  if (
    probe.startsWith('<!doctype') ||
    probe.startsWith('<html') ||
    (t.startsWith('<') && probe.includes('html'))
  ) {
    return {
      ok: false,
      error:
        'LeetCode returned a web page instead of JSON — usually an expired session, bot check, or rate limit. Open leetcode.com, copy fresh LEETCODE_SESSION and csrftoken (DevTools → Application → Cookies), then save them in the app.',
    }
  }
  try {
    return { ok: true, data: JSON.parse(text) as unknown }
  } catch {
    return {
      ok: false,
      error: `LeetCode sent a response that was not JSON (HTTP ${httpStatus}).`,
    }
  }
}
