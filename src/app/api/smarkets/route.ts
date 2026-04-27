import { NextRequest, NextResponse } from 'next/server'

const BASE = 'https://api.smarkets.com/v3'
const LOGIN_URL = `${BASE}/sessions/`

type LoginResponse = {
  token?: string
  error_type?: string
}

type Credentials = {
  username: string
  password: string
}

type CachedSession = {
  token: string
  expiryMs: number
  accountId: string | null
}

const tokenCache = new Map<string, CachedSession>()

function getRequestCredentials(req: NextRequest): Credentials | null {
  const username = req.headers.get('x-smarkets-username')?.trim()
  const password = req.headers.get('x-smarkets-password')?.trim()
  if (!username || !password) return null
  return { username, password }
}

function makeCacheKey(creds: Credentials): string {
  return `${creds.username}:${creds.password}`
}

async function fetchSessionToken(creds: Credentials, forceRefresh = false): Promise<string> {
  const cacheKey = makeCacheKey(creds)

  const now = Date.now()
  const cached = tokenCache.get(cacheKey)
  if (!forceRefresh && cached && now < cached.expiryMs) {
    return cached.token
  }

  const loginRes = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'MatchLock/1.0',
    },
    body: JSON.stringify({
      username: creds.username,
      password: creds.password,
      remember: true,
      create_social_member: false,
      reopen_account: false,
      use_auth_v2: false,
    }),
    cache: 'no-store',
  })

  const rawBody = await loginRes.text()
  let payload: LoginResponse = {}
  try {
    payload = rawBody ? (JSON.parse(rawBody) as LoginResponse) : {}
  } catch {
    payload = {}
  }

  if (!loginRes.ok || !payload.token) {
    const reason = payload.error_type || `HTTP ${loginRes.status}`
    throw new Error(`Smarkets login failed: ${reason}`)
  }

  // API docs: token validity is 30 minutes and renewed on use.
  tokenCache.set(cacheKey, {
    token: payload.token,
    expiryMs: now + 29 * 60 * 1000,
    accountId: null,
  })
  return payload.token
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
  const session = await getSessionWithAccount(creds, forceTokenRefresh)
  const token = session.token
  const isQuotesRequest = path.includes('/quotes/')

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'MatchLock/1.0',
  }
  if (token) headers.Authorization = `Session-Token ${token}`

  if (isQuotesRequest) {
    // Quotes change constantly, so bypass caching to keep scanner prices accurate.
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

  try {
    const session = await getSessionWithAccount(creds)
    if (expectedAccountId && session.accountId && expectedAccountId !== session.accountId) {
      return NextResponse.json(
        { error: 'Smarkets account mismatch', detail: 'Provided credentials do not match the verified account.' },
        { status: 403 }
      )
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
    return NextResponse.json({ error: 'Failed to reach Smarkets', detail: String(err) }, { status: 502 })
  }
}
