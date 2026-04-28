import { NextRequest, NextResponse } from 'next/server'

const BASE = 'https://api.smarkets.com/v3'
const LOGIN_URL = `${BASE}/sessions/`
const SESSION_TOKEN_TTL_MS = 30 * 60 * 1000
const SESSION_TOKEN_RENEW_BUFFER_MS = 60 * 1000
const LOGIN_RATE_LIMIT_WINDOW_MS = 60 * 1000
const LOGIN_RATE_LIMIT_MAX_REQUESTS = 10

type LoginResponse = {
  token?: string
  error_type?: string
}

type Credentials = {
  username: string
  password: string
}

type ProxyRequestBody = {
  path?: string
  params?: Record<string, string | number | boolean | null | undefined>
  credentials?: {
    username?: string
    password?: string
  }
  accountId?: string
  allowPublicFallback?: boolean
  preferPublic?: boolean
}

type CachedSession = {
  token: string
  expiryMs: number
  accountId: string | null
}

const tokenCache = new Map<string, CachedSession>()
const loginAttemptTimestamps: number[] = []

function getRequestCredentials(req: NextRequest): Credentials | null {
  const username = req.headers.get('x-smarkets-username')?.trim()
  const password = req.headers.get('x-smarkets-password')
  if (!username || !password) return null
  return { username, password }
}

function getBodyCredentials(body: ProxyRequestBody): Credentials | null {
  const username = body.credentials?.username?.trim()
  const password = body.credentials?.password
  if (!username || typeof password !== 'string' || password.length === 0) return null
  return { username, password }
}

function makeCacheKey(creds: Credentials): string {
  return `${creds.username}:${creds.password}`
}

async function loginWithPayload(payload: Record<string, unknown>): Promise<LoginResponse & { ok: boolean; status: number }> {
  const loginRes = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'MatchLock/1.0',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  const rawBody = await loginRes.text()
  let responsePayload: LoginResponse = {}
  try {
    responsePayload = rawBody ? (JSON.parse(rawBody) as LoginResponse) : {}
  } catch {
    responsePayload = {}
  }

  return {
    ...responsePayload,
    ok: loginRes.ok,
    status: loginRes.status,
  }
}

function trimOldLoginAttempts(now: number): void {
  while (loginAttemptTimestamps.length > 0 && now - loginAttemptTimestamps[0] >= LOGIN_RATE_LIMIT_WINDOW_MS) {
    loginAttemptTimestamps.shift()
  }
}

function assertSessionLoginRateLimit(): void {
  const now = Date.now()
  trimOldLoginAttempts(now)
  if (loginAttemptTimestamps.length >= LOGIN_RATE_LIMIT_MAX_REQUESTS) {
    throw new Error('RATE_LIMIT_EXCEEDED: Session login limit is 10 requests per 60 seconds.')
  }
  loginAttemptTimestamps.push(now)
}

function renewCachedSessionExpiry(creds: Credentials): void {
  const cacheKey = makeCacheKey(creds)
  const cached = tokenCache.get(cacheKey)
  if (!cached) return
  tokenCache.set(cacheKey, {
    ...cached,
    expiryMs: Date.now() + SESSION_TOKEN_TTL_MS - SESSION_TOKEN_RENEW_BUFFER_MS,
  })
}

async function fetchSessionToken(creds: Credentials, forceRefresh = false): Promise<string> {
  const cacheKey = makeCacheKey(creds)

  const now = Date.now()
  const cached = tokenCache.get(cacheKey)
  if (!forceRefresh && cached && now < cached.expiryMs) {
    return cached.token
  }

  const loginPayload: Record<string, unknown> = {
    create_social_member: true,
    username: creds.username,
    password: creds.password,
    remember: true,
    reopen_account: false,
    use_auth_v2: false,
  }

  assertSessionLoginRateLimit()
  const loginResult = await loginWithPayload(loginPayload)
  if (loginResult.ok && loginResult.token) {
    tokenCache.set(cacheKey, {
      token: loginResult.token,
      expiryMs: now + SESSION_TOKEN_TTL_MS - SESSION_TOKEN_RENEW_BUFFER_MS,
      accountId: null,
    })
    return loginResult.token
  }

  const reason = loginResult.error_type || `HTTP ${loginResult.status}`
  if (reason === 'INVALID_CREDENTIALS') {
    throw new Error(
      'Smarkets login failed: INVALID_CREDENTIALS (double-check credentials and confirm your account has API access enabled).'
    )
  }
  throw new Error(`Smarkets login failed: ${reason}`)
}

async function fetchAccountIdForToken(token: string): Promise<string | null> {
  const res = await fetch(`${BASE}/accounts/`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'MatchLock/1.0',
      Authorization: `Session-Token ${token}`,
    },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const payload = (await res.json()) as { account?: { account_id?: string } }
  return payload.account?.account_id ?? null
}

async function getSessionWithAccount(creds: Credentials, forceTokenRefresh = false): Promise<CachedSession> {
  const cacheKey = makeCacheKey(creds)
  const token = await fetchSessionToken(creds, forceTokenRefresh)
  const cached = tokenCache.get(cacheKey)
  if (!cached) {
    throw new Error('Session cache was not initialized for credentials.')
  }
  if (cached.accountId) return cached

  const accountId = await fetchAccountIdForToken(token)
  const hydrated: CachedSession = { ...cached, accountId }
  tokenCache.set(cacheKey, hydrated)
  return hydrated
}

async function fetchSmarketsJson(path: string, query: URLSearchParams, creds: Credentials, forceTokenRefresh = false) {
  const url = `${BASE}${path}${query.size ? `?${query.toString()}` : ''}`
  const token = await fetchSessionToken(creds, forceTokenRefresh)
  const isQuotesRequest = path.includes('/quotes/')

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'MatchLock/1.0',
  }
  if (token) headers.Authorization = `Session-Token ${token}`

  if (isQuotesRequest) {
    // Quotes change constantly, so bypass caching to keep scanner prices accurate.
    const res = await fetch(url, {
      headers,
      cache: 'no-store',
    })
    if (res.ok) {
      // Smarkets renews active session tokens on authenticated use.
      renewCachedSessionExpiry(creds)
    }
    return res
  }

  const res = await fetch(url, {
    headers,
    next: { revalidate: 30 },
  })
  if (res.ok) {
    // Smarkets renews active session tokens on authenticated use.
    renewCachedSessionExpiry(creds)
  }
  return res
}

async function fetchSmarketsPublicJson(path: string, query: URLSearchParams) {
  const url = `${BASE}${path}${query.size ? `?${query.toString()}` : ''}`
  const isQuotesRequest = path.includes('/quotes/')
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'MatchLock/1.0',
  }

  if (isQuotesRequest) {
    return fetch(url, {
      headers,
      cache: 'no-store',
    })
  }

  return fetch(url, {
    headers,
    next: { revalidate: 30 },
  })
}

function shouldUsePublicFallback(path: string, errorText: string, allowPublicFallback: boolean): boolean {
  if (!allowPublicFallback) return false
  if (path === '/accounts/') return false
  return (
    errorText.includes('PASSWORD_RESET_NEEDED') ||
    errorText.includes('IP_NOT_TRUSTED') ||
    errorText.includes('RATE_LIMIT_EXCEEDED') ||
    errorText.includes('INVALID_CREDENTIALS') ||
    errorText.includes('INSUFFICIENT_PERMISSIONS')
  )
}

async function handleProxyRequest(
  path: string,
  forward: URLSearchParams,
  creds: Credentials,
  expectedAccountId: string,
  allowPublicFallback: boolean,
  preferPublic: boolean
) {
  try {
    if (preferPublic && allowPublicFallback && path !== '/accounts/') {
      const publicRes = await fetchSmarketsPublicJson(path, forward)
      if (!publicRes.ok) {
        const text = await publicRes.text()
        return NextResponse.json(
          { error: `Smarkets ${publicRes.status}`, detail: text, mode: 'public_fallback' },
          { status: publicRes.status }
        )
      }
      const data = await publicRes.json()
      return NextResponse.json(data)
    }

    if (expectedAccountId) {
      const session = await getSessionWithAccount(creds)
      if (session.accountId && expectedAccountId !== session.accountId) {
        return NextResponse.json(
          { error: 'Smarkets account mismatch', detail: 'Provided credentials do not match the verified account.' },
          { status: 403 }
        )
      }
    }

    let res = await fetchSmarketsJson(path, forward, creds)

    // If auth is configured and the session expired, refresh once and retry.
    if (res.status === 401 || res.status === 403) {
      res = await fetchSmarketsJson(path, forward, creds, true)
    }

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Smarkets ${res.status}`, detail: text }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    const errorText = String(err)
    if (shouldUsePublicFallback(path, errorText, allowPublicFallback)) {
      const fallbackRes = await fetchSmarketsPublicJson(path, forward)
      if (!fallbackRes.ok) {
        const text = await fallbackRes.text()
        return NextResponse.json(
          { error: `Smarkets ${fallbackRes.status}`, detail: text, mode: 'public_fallback' },
          { status: fallbackRes.status }
        )
      }
      const data = await fallbackRes.json()
      return NextResponse.json(data)
    }
    return NextResponse.json({ error: 'Failed to reach Smarkets', detail: String(err) }, { status: 502 })
  }
}

// Proxy Smarkets API to avoid CORS in browser
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400 })
  if (!path.startsWith('/')) {
    return NextResponse.json({ error: 'Path must start with "/"' }, { status: 400 })
  }
  const creds = getRequestCredentials(req)
  if (!creds) {
    return NextResponse.json(
      { error: 'Missing Smarkets credentials', detail: 'Provide x-smarkets-username and x-smarkets-password headers.' },
      { status: 401 }
    )
  }

  // Strip the 'path' param, pass the rest through
  const forward = new URLSearchParams(searchParams)
  forward.delete('path')
  const expectedAccountId = req.headers.get('x-smarkets-account-id')?.trim() || ''

  return handleProxyRequest(path, forward, creds, expectedAccountId, false, false)
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ProxyRequestBody
    const path = body.path
    if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400 })
    if (!path.startsWith('/')) {
      return NextResponse.json({ error: 'Path must start with "/"' }, { status: 400 })
    }

    const creds = getBodyCredentials(body) ?? getRequestCredentials(req)
    if (!creds) {
      return NextResponse.json(
        { error: 'Missing Smarkets credentials', detail: 'Provide credentials in request body or x-smarkets-* headers.' },
        { status: 401 }
      )
    }

    const forward = new URLSearchParams()
    const params = body.params ?? {}
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined) continue
      forward.set(key, String(value))
    }
    const expectedAccountId = body.accountId?.trim() || req.headers.get('x-smarkets-account-id')?.trim() || ''

    return handleProxyRequest(
      path,
      forward,
      creds,
      expectedAccountId,
      Boolean(body.allowPublicFallback),
      Boolean(body.preferPublic)
    )
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body', detail: String(err) }, { status: 400 })
  }
}
