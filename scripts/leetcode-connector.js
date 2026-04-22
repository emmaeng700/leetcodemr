#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Local LeetCode Connector
 *
 * Why: LeetCode's Cloudflare/WAF often blocks serverless/Vercel requests (403 HTML),
 * even with valid cookies. Running requests from your own machine (browser-like
 * fingerprint + IP) is much more reliable.
 *
 * Usage:
 * - Auth once (opens a real browser):  npm run lc:auth
 * - Run local connector server:       npm run lc:connector
 *
 * The web app will prefer http://127.0.0.1:8787 automatically when available.
 */
const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')

const { chromium } = require('playwright')

const PORT = Number(process.env.LC_CONNECTOR_PORT || 8787)
const HOST = process.env.LC_CONNECTOR_HOST || '127.0.0.1'
const BASE = `http://${HOST}:${PORT}`

const COOKIE_PATH =
  process.env.LC_CONNECTOR_COOKIE_PATH ||
  path.join(os.homedir(), '.leetcodemr-lc-connector.cookies.json')

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let buf = ''
    req.on('data', (chunk) => (buf += chunk))
    req.on('end', () => {
      if (!buf) return resolve({})
      try {
        resolve(JSON.parse(buf))
      } catch (e) {
        reject(e)
      }
    })
  })
}

function writeJson(res, status, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  })
  res.end(body)
}

function allowCorsPreflight(req, res) {
  if (req.method !== 'OPTIONS') return false
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Max-Age': '86400',
  })
  res.end()
  return true
}

function loadCookieJar() {
  try {
    const raw = fs.readFileSync(COOKIE_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    return null
  } catch {
    return null
  }
}

function saveCookieJar(cookies) {
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2), 'utf8')
}

function cookieHeaderFromJar(cookies) {
  // Playwright cookies: { name, value, domain, path, expires, httpOnly, secure, sameSite }
  return cookies
    .filter((c) => c && c.name && typeof c.value === 'string')
    .map((c) => `${c.name}=${c.value}`)
    .join('; ')
}

function getCookie(cookies, name) {
  return cookies?.find((c) => c?.name === name)?.value || ''
}

async function ensureAuthedCookieJar() {
  const jar = loadCookieJar()
  if (!jar || jar.length === 0) return null
  // Basic sanity: require LEETCODE_SESSION and csrftoken
  if (!getCookie(jar, 'LEETCODE_SESSION') || !getCookie(jar, 'csrftoken')) return null
  return jar
}

async function runAuthFlow() {
  console.log('[lc-connector] Launching browser for LeetCode login…')
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1280, height: 800 },
  })
  const page = await context.newPage()
  await page.goto('https://leetcode.com/accounts/login/', { waitUntil: 'domcontentloaded' })
  console.log('[lc-connector] Please login in the opened browser.')
  console.log('[lc-connector] Waiting for LEETCODE_SESSION cookie…')

  const deadline = Date.now() + 10 * 60 * 1000
  while (Date.now() < deadline) {
    const cookies = await context.cookies('https://leetcode.com')
    const hasSession = !!getCookie(cookies, 'LEETCODE_SESSION')
    const hasCsrf = !!getCookie(cookies, 'csrftoken')
    if (hasSession && hasCsrf) {
      saveCookieJar(cookies)
      console.log(`[lc-connector] Saved cookies to ${COOKIE_PATH}`)
      await browser.close()
      return { ok: true }
    }
    await new Promise((r) => setTimeout(r, 1500))
  }

  await browser.close()
  return { ok: false, error: 'Timed out waiting for login cookies.' }
}

async function lcFetchJson(url, init) {
  const res = await fetch(url, init)
  const text = await res.text()
  return { res, text }
}

function isHtml(text) {
  const t = String(text || '').trimStart().slice(0, 200).toLowerCase()
  return t.startsWith('<!doctype') || t.startsWith('<html') || (t.startsWith('<') && t.includes('html'))
}

async function handler(req, res) {
  if (allowCorsPreflight(req, res)) return

  try {
    const u = new URL(req.url || '/', BASE)

    if (u.pathname === '/health' && req.method === 'GET') {
      const jar = await ensureAuthedCookieJar()
      return writeJson(res, 200, { ok: true, authed: !!jar })
    }

    if (u.pathname === '/auth/start' && req.method === 'POST') {
      const r = await runAuthFlow()
      return writeJson(res, r.ok ? 200 : 500, r)
    }

    const jar = await ensureAuthedCookieJar()
    if (!jar) {
      return writeJson(res, 401, {
        error: 'Local connector not authenticated. Call POST /auth/start first.',
      })
    }

    const cookie = cookieHeaderFromJar(jar)
    const csrf = getCookie(jar, 'csrftoken')

    // --- GraphQL proxy ---
    if (u.pathname === '/leetcode/graphql' && req.method === 'POST') {
      const body = await readJsonBody(req)
      const { res: lcRes, text } = await lcFetchJson('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie,
          'X-CSRFToken': csrf,
          Referer: 'https://leetcode.com/problems/',
          Origin: 'https://leetcode.com',
          Accept: 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'x-requested-with': 'XMLHttpRequest',
          'User-Agent': UA,
        },
        body: JSON.stringify(body),
      })
      if (isHtml(text)) {
        return writeJson(res, 502, { error: `LeetCode returned HTML (HTTP ${lcRes.status}).`, httpStatus: lcRes.status })
      }
      return writeJson(res, lcRes.status, JSON.parse(text))
    }

    // --- Run/Submit proxy (problem APIs) ---
    if ((u.pathname === '/leetcode/submit' || u.pathname === '/leetcode/test') && req.method === 'POST') {
      const body = await readJsonBody(req)
      const { titleSlug, questionId, lang, code, testInput } = body
      if (!titleSlug || !questionId || !lang || !code) {
        return writeJson(res, 400, { error: 'Missing required fields.' })
      }
      const slug = encodeURIComponent(String(titleSlug))
      const isTest = u.pathname.endsWith('/test')
      const fullUrl = isTest
        ? `https://leetcode.com/problems/${slug}/interpret_solution/`
        : `https://leetcode.com/problems/${slug}/submit/`

      const payload = isTest
        ? { lang, question_id: questionId, typed_code: code, data_input: testInput ?? '', test_mode: false }
        : { lang, question_id: questionId, typed_code: code, test_mode: false, judge_type: 'large' }

      const { res: lcRes, text } = await lcFetchJson(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie,
          'X-CSRFToken': csrf,
          Referer: `https://leetcode.com/problems/${slug}/description/`,
          Origin: 'https://leetcode.com',
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'x-requested-with': 'XMLHttpRequest',
          'User-Agent': UA,
        },
        body: JSON.stringify(payload),
      })
      if (isHtml(text)) {
        return writeJson(res, 502, { error: `LeetCode returned HTML (HTTP ${lcRes.status}).`, httpStatus: lcRes.status })
      }
      return writeJson(res, lcRes.status, JSON.parse(text))
    }

    if (u.pathname === '/leetcode/check' && req.method === 'POST') {
      const body = await readJsonBody(req)
      const { checkId, titleSlug } = body
      if (!checkId || !titleSlug) return writeJson(res, 400, { error: 'Missing checkId/titleSlug.' })
      const slug = encodeURIComponent(String(titleSlug))
      const fullUrl = `https://leetcode.com/submissions/detail/${checkId}/check/`
      const { res: lcRes, text } = await lcFetchJson(fullUrl, {
        method: 'GET',
        headers: {
          Cookie: cookie,
          Referer: `https://leetcode.com/problems/${slug}/description/`,
          Accept: 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'x-requested-with': 'XMLHttpRequest',
          'User-Agent': UA,
        },
      })
      if (isHtml(text)) {
        return writeJson(res, 502, { error: `LeetCode returned HTML (HTTP ${lcRes.status}).`, httpStatus: lcRes.status })
      }
      return writeJson(res, lcRes.status, JSON.parse(text))
    }

    return writeJson(res, 404, { error: 'Not found' })
  } catch (e) {
    return writeJson(res, 500, { error: String(e) })
  }
}

async function main() {
  const arg = process.argv.slice(2)[0]
  if (arg === 'auth') {
    const r = await runAuthFlow()
    if (!r.ok) process.exitCode = 1
    return
  }

  const server = http.createServer(handler)
  server.listen(PORT, HOST, () => {
    console.log(`[lc-connector] listening on ${BASE}`)
    console.log(`[lc-connector] cookies: ${COOKIE_PATH}`)
    console.log('[lc-connector] endpoints: GET /health, POST /auth/start, POST /leetcode/*')
  })
}

main().catch((e) => {
  console.error('[lc-connector] fatal:', e)
  process.exit(1)
})

