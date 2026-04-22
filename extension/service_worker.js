/* eslint-disable no-undef */
// Handles requests from the content script and calls LeetCode using the user's browser session cookies.

const LC = 'https://leetcode.com'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function getCookie(name) {
  return new Promise((resolve) => {
    chrome.cookies.get({ url: LC, name }, (cookie) => resolve(cookie?.value || ''))
  })
}

function jsonResponse(ok, payload) {
  return { ok, ...payload }
}

function isHtml(text) {
  const t = String(text || '').trimStart().slice(0, 200).toLowerCase()
  return t.startsWith('<!doctype') || t.startsWith('<html') || (t.startsWith('<') && t.includes('html'))
}

async function lcFetch(url, init) {
  const res = await fetch(url, { ...init, credentials: 'include' })
  const text = await res.text()
  return { status: res.status, ok: res.ok, text }
}

async function handleGraphql(body) {
  const csrf = await getCookie('csrftoken')
  const { status, ok, text } = await lcFetch(`${LC}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrf,
      Referer: `${LC}/problems/`,
      Origin: LC,
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'x-requested-with': 'XMLHttpRequest',
      'User-Agent': UA,
    },
    body: JSON.stringify(body ?? {}),
  })
  if (isHtml(text)) {
    return jsonResponse(false, { error: `LeetCode returned HTML (HTTP ${status}).`, httpStatus: status })
  }
  return jsonResponse(true, { httpStatus: status, bodyText: text, ok })
}

async function handleSubmit(body) {
  const csrf = await getCookie('csrftoken')
  const slug = encodeURIComponent(String(body?.titleSlug || ''))
  const url = `${LC}/problems/${slug}/submit/`
  const payload = {
    lang: body?.lang,
    question_id: body?.questionId,
    typed_code: body?.code,
    test_mode: false,
    judge_type: 'large',
  }
  const { status, ok, text } = await lcFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrf,
      Referer: `${LC}/problems/${slug}/description/`,
      Origin: LC,
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'x-requested-with': 'XMLHttpRequest',
      'User-Agent': UA,
    },
    body: JSON.stringify(payload),
  })
  if (isHtml(text)) {
    return jsonResponse(false, { error: `LeetCode returned HTML (HTTP ${status}).`, httpStatus: status })
  }
  return jsonResponse(true, { httpStatus: status, bodyText: text, ok })
}

async function handleTest(body) {
  const csrf = await getCookie('csrftoken')
  const slug = encodeURIComponent(String(body?.titleSlug || ''))
  const url = `${LC}/problems/${slug}/interpret_solution/`
  const payload = {
    lang: body?.lang,
    question_id: body?.questionId,
    typed_code: body?.code,
    data_input: body?.testInput ?? '',
    test_mode: false,
  }
  const { status, ok, text } = await lcFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrf,
      Referer: `${LC}/problems/${slug}/description/`,
      Origin: LC,
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'x-requested-with': 'XMLHttpRequest',
      'User-Agent': UA,
    },
    body: JSON.stringify(payload),
  })
  if (isHtml(text)) {
    return jsonResponse(false, { error: `LeetCode returned HTML (HTTP ${status}).`, httpStatus: status })
  }
  return jsonResponse(true, { httpStatus: status, bodyText: text, ok })
}

async function handleCheck(body) {
  const slug = encodeURIComponent(String(body?.titleSlug || ''))
  const checkId = String(body?.checkId || '')
  const url = `${LC}/submissions/detail/${checkId}/check/`
  const { status, ok, text } = await lcFetch(url, {
    method: 'GET',
    headers: {
      Referer: `${LC}/problems/${slug}/description/`,
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'x-requested-with': 'XMLHttpRequest',
      'User-Agent': UA,
    },
  })
  if (isHtml(text)) {
    return jsonResponse(false, { error: `LeetCode returned HTML (HTTP ${status}).`, httpStatus: status })
  }
  return jsonResponse(true, { httpStatus: status, bodyText: text, ok })
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  ;(async () => {
    try {
      const kind = msg?.kind
      const body = msg?.body
      if (kind === 'ping') return sendResponse(jsonResponse(true, { pong: true }))
      if (kind === 'graphql') return sendResponse(await handleGraphql(body))
      if (kind === 'submit') return sendResponse(await handleSubmit(body))
      if (kind === 'test') return sendResponse(await handleTest(body))
      if (kind === 'check') return sendResponse(await handleCheck(body))
      return sendResponse(jsonResponse(false, { error: 'Unknown kind.' }))
    } catch (e) {
      return sendResponse(jsonResponse(false, { error: String(e) }))
    }
  })()
  return true
})

