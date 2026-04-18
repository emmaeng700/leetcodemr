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
        'LeetCode returned HTML instead of JSON (login wall, Cloudflare, or rate limit). Try: (1) Re-save cookies with only the value (no LEETCODE_SESSION= prefix), trimmed. (2) If you use a deployed site (e.g. Vercel), LeetCode may block the server IP even with valid cookies — run the app locally (npm run dev) or submit on leetcode.com. (3) After a bot check, you may need cookie cf_clearance from the same browser session (advanced).',
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
