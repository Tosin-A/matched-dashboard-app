'use client'

import { useState, useCallback } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'

function priceToDecimal(price: number): number {
  if (!price || price <= 0) return 0
  return parseFloat((10000 / price).toFixed(2))
}

function getBestDecimalFromLevels(
  levels: Array<{ price?: number }> | undefined,
  mode: 'back' | 'lay'
): number {
  if (!levels || levels.length === 0) return 0
  const decimals = levels
    .map(level => priceToDecimal(level.price ?? 0))
    .filter(odd => odd >= 1.01)
  if (decimals.length === 0) return 0
  // For scanner ranking we want the most back-friendly and lay-friendly edge from available levels.
  return mode === 'back' ? Math.max(...decimals) : Math.min(...decimals)
}

type ContractQuote = {
  id?: string
  bids?: Array<{ price?: number }>
  offers?: Array<{ price?: number }>
}

type QuotesContainer = {
  [contractId: string]: ContractQuote | unknown
  quotes?: Record<string, ContractQuote> | ContractQuote[]
  contracts?: ContractQuote[]
}

function getContractQuote(quotesPayload: unknown, contractId: string): ContractQuote | null {
  if (!quotesPayload || typeof quotesPayload !== 'object') return null
  const payload = quotesPayload as QuotesContainer

  const direct = payload[contractId]
  if (direct && typeof direct === 'object') return direct as ContractQuote
  if (payload.quotes && !Array.isArray(payload.quotes)) {
    const q = (payload.quotes as Record<string, ContractQuote>)[contractId]
    if (q) return q
  }

  const quotesArray = payload.quotes || payload.contracts
  if (Array.isArray(quotesArray)) {
    const match = quotesArray.find(entry => String(entry?.id) === String(contractId))
    if (match) return match
  }
  return null
}

const SPORTS = [
  { id: 'football',     type: 'football_match',     label: 'Football'     },
  { id: 'horse_racing', type: 'horse_racing_race',   label: 'Horse Racing' },
  { id: 'cricket',      type: 'cricket_match',       label: 'Cricket'      },
  { id: 'basketball',   type: 'basketball_match',    label: 'Basketball'   },
  { id: 'tennis',       type: 'tennis_match',        label: 'Tennis'       },
]

const SPORT_COLOR: Record<string, string> = {
  football:     'var(--accent)',
  horse_racing: 'var(--warning)',
  cricket:      'var(--profit)',
  basketball:   'oklch(0.65 0.19 55)',
  tennis:       'oklch(0.60 0.18 310)',
}

type Selection = {
  contractId: string
  name: string
  marketName: string
  eventName: string
  eventDate: string
  sport: string
  backOdds: number
  layOdds: number
  spread: number
}

type FilterMode = 'auto' | 'qualifying' | 'free_bet' | 'custom'
type ScanMode   = 'all' | 'single'
type Timeframe  = 'any' | '3h' | 'today' | 'tomorrow' | '7d'

function getDateRange(timeframe: Timeframe): { min?: string; max?: string } {
  const now = new Date()
  if (timeframe === '3h') {
    return { min: now.toISOString(), max: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString() }
  }
  if (timeframe === 'today') {
    const max = new Date(now); max.setHours(23, 59, 59, 999)
    return { min: now.toISOString(), max: max.toISOString() }
  }
  if (timeframe === 'tomorrow') {
    const min = new Date(now); min.setDate(min.getDate() + 1); min.setHours(0, 0, 0, 0)
    const max = new Date(min); max.setHours(23, 59, 59, 999)
    return { min: min.toISOString(), max: max.toISOString() }
  }
  if (timeframe === '7d') {
    return { min: now.toISOString(), max: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() }
  }
  return {}
}
type SmarketsCredentials = { username: string; password: string }
type LoginStatus = 'idle' | 'checking' | 'valid' | 'limited' | 'invalid'
type AccountResponse = { account?: { account_id?: string; currency?: string } }

function getLimitedModeReason(message: string): string | null {
  if (message.includes('PASSWORD_RESET_NEEDED')) return 'PASSWORD_RESET_NEEDED'
  if (message.includes('IP_NOT_TRUSTED')) return 'IP_NOT_TRUSTED'
  if (message.includes('INSUFFICIENT_PERMISSIONS')) return 'INSUFFICIENT_PERMISSIONS'
  return null
}

const BOOKMAKERS = [
  'Bet365', 'Unibet', 'William Hill', 'Betway',
  'Paddy Power', 'Coral', 'Ladbrokes', 'Sky Bet', 'BetVictor',
]

function bookmakerUrl(bookmaker: string, eventName: string): string {
  // Use only the event name — market/selection names pollute the query and cause mismatches
  const q = encodeURIComponent(eventName.trim())

  const bookmakerSearchUrls: Record<string, string> = {
    Bet365:         `https://www.bet365.com/en/sports/search#?q=${q}`,
    Unibet:         `https://www.unibet.co.uk/betting/sports/filter/all/all/all/all/matches?search=${q}`,
    'William Hill': `https://sports.williamhill.com/betting/en-gb/search?q=${q}`,
    Betway:         `https://betway.com/en/sports/search?q=${q}`,
    'Paddy Power':  `https://www.paddypower.com/search?q=${q}`,
    Coral:          `https://www.coral.co.uk/en/sports/search?query=${q}`,
    Ladbrokes:      `https://www.ladbrokes.com/en/sports/search?query=${q}`,
    'Sky Bet':      `https://www.skybet.com/search?searchText=${q}`,
    BetVictor:      `https://www.betvictor.com/en-gb/search?q=${q}`,
  }

  if (bookmakerSearchUrls[bookmaker]) return bookmakerSearchUrls[bookmaker]

  // Safe fallback if a bookmaker is added later but not mapped yet.
  const slug = bookmaker.toLowerCase().replace(/[^a-z0-9]+/g, '')
  return `https://www.${slug}.com/search?q=${q}`
}

async function apiGet(
  path: string,
  creds: SmarketsCredentials,
  params?: Record<string, string>,
  accountId?: string,
  options?: { allowPublicFallback?: boolean; preferPublic?: boolean }
) {
  const maxAttempts = 3
  let lastError = 'Unknown API error'

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch('/api/smarkets', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path,
        params: params ?? {},
        credentials: {
          username: creds.username,
          password: creds.password,
        },
        accountId: accountId ?? undefined,
        allowPublicFallback: Boolean(options?.allowPublicFallback),
        preferPublic: Boolean(options?.preferPublic),
      }),
    })
    const bodyText = await res.text()
    let json: Record<string, unknown> = {}
    try {
      json = bodyText ? (JSON.parse(bodyText) as Record<string, unknown>) : {}
    } catch {
      json = { detail: bodyText }
    }

    if (res.ok) return json

    const detail = String(json.detail || json.error || `HTTP ${res.status}`)
    lastError = detail

    const retryable = res.status === 429 || res.status >= 500
    if (!retryable || attempt === maxAttempts - 1) break

    const backoffMs = 250 * 2 ** attempt
    await new Promise(resolve => setTimeout(resolve, backoffMs))
  }

  throw new Error(lastError)
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let cursor = 0

  async function runWorker() {
    while (cursor < items.length) {
      const idx = cursor++
      try {
        const value = await worker(items[idx])
        results[idx] = { status: 'fulfilled', value }
      } catch (error) {
        results[idx] = { status: 'rejected', reason: error }
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runWorker())
  await Promise.all(workers)
  return results
}

async function scanSport(
  sportType: string,
  sportId: string,
  creds: SmarketsCredentials,
  query?: string,
  accountId?: string,
  preferPublic = false,
  dateRange?: { min?: string; max?: string }
): Promise<Selection[]> {
  const evParams: Record<string, string> = {
    type: sportType, state: 'upcoming', sort: 'start_datetime,id', limit: '15',
  }
  if (query?.trim()) evParams.name = query.trim()
  if (dateRange?.min) evParams.start_datetime_min = dateRange.min
  if (dateRange?.max) evParams.start_datetime_max = dateRange.max

  const evData = await apiGet('/events/', creds, evParams, accountId, {
    allowPublicFallback: true,
    preferPublic,
  })
  const eventList = evData.events
  const events: Array<{ id: string; name: string; start_datetime: string }> = Array.isArray(eventList)
    ? (eventList as Array<{ id: string; name: string; start_datetime: string }>)
    : []
  if (events.length === 0) return []

  const targetEvents = events.slice(0, 6)
  const marketResults = await mapWithConcurrency(
    targetEvents,
    3,
    ev =>
      apiGet(`/events/${ev.id}/markets/`, creds, undefined, accountId, {
        allowPublicFallback: true,
        preferPublic,
      })
  )

  type EM = { event: typeof targetEvents[number]; market: { id: string; name: string } }
  const eventMarkets: EM[] = []
  for (let i = 0; i < targetEvents.length; i++) {
    const settled = marketResults[i]
    if (settled.status !== 'fulfilled') continue
    const marketList = settled.value.markets
    const markets: Array<{ id: string; name: string; state: string; category: string }> = Array.isArray(marketList)
      ? (marketList as Array<{ id: string; name: string; state: string; category: string }>)
      : []
    const winner = markets.find(m => m.category === 'winner' && m.state === 'open')
    if (winner) eventMarkets.push({ event: targetEvents[i], market: winner })
  }

  if (eventMarkets.length === 0) return []

  const marketData = await mapWithConcurrency(
    eventMarkets,
    3,
    async ({ event, market }) => {
      const [ctData, qtData] = await Promise.all([
        apiGet(`/markets/${market.id}/contracts/`, creds, undefined, accountId, {
          allowPublicFallback: true,
          preferPublic,
        }),
        apiGet(`/markets/${market.id}/quotes/`, creds, undefined, accountId, {
          allowPublicFallback: true,
          preferPublic,
        }),
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { event, market, contracts: (ctData.contracts as any[]) || [], quotes: qtData }
    }
  )

  const selections: Selection[] = []
  const failedMarketRequests = marketData.filter(result => result.status === 'rejected').length
  const firstMarketFailure = marketData.find(result => result.status === 'rejected') as PromiseRejectedResult | undefined
  for (const result of marketData) {
    if (result.status !== 'fulfilled') continue
    const { event, market, contracts, quotes } = result.value
    for (const contract of contracts) {
      const q = getContractQuote(quotes, contract.id)
      if (!q) continue
      const backOdds = getBestDecimalFromLevels(q.offers, 'back')
      const layOdds  = getBestDecimalFromLevels(q.bids, 'lay')
      if (backOdds < 1.01 || layOdds < 1.01) continue
      selections.push({
        contractId: contract.id,
        name: contract.name,
        marketName: market.name,
        eventName: event.name,
        eventDate: event.start_datetime,
        sport: sportId,
        backOdds,
        layOdds,
        spread: parseFloat(Math.abs(layOdds - backOdds).toFixed(2)),
      })
    }
  }

  if (selections.length === 0 && eventMarkets.length > 0 && failedMarketRequests === marketData.length) {
    const reason = firstMarketFailure?.reason instanceof Error
      ? firstMarketFailure.reason.message
      : String(firstMarketFailure?.reason || 'Unknown failure')
    throw new Error(`Unable to load market contracts/quotes from Smarkets: ${reason}`)
  }
  return selections
}

type OnUse = (prefill: { backOdds: string; layOdds: string; label: string }) => void

export default function OddsScanner({ onUse }: { onUse?: OnUse }) {
  const isMobile = useIsMobile()
  const [loginExpanded, setLoginExpanded] = useState(true)
  const [useSmarketsApi, setUseSmarketsApi] = useState(() => (
    typeof window === 'undefined' ? true : localStorage.getItem('matchlock_use_smarkets_api') !== 'false'
  ))
  const [scanMode, setScanMode]       = useState<ScanMode>('all')
  const [selectedSport, setSelectedSport] = useState('football')
  const [bookmaker, setBookmaker]     = useState('Bet365')
  const [smarketsEmail, setSmarketsEmail] = useState(() => (
    typeof window === 'undefined' ? '' : localStorage.getItem('matchlock_smarkets_email') || ''
  ))
  const [smarketsPassword, setSmarketsPassword] = useState(() => (
    typeof window === 'undefined' ? '' : localStorage.getItem('matchlock_smarkets_password') || ''
  ))
  const [showPassword, setShowPassword] = useState(false)
  const [loginStatus, setLoginStatus] = useState<LoginStatus>('idle')
  const [loginStatusMessage, setLoginStatusMessage] = useState('')
  const [loginVerifiedAt, setLoginVerifiedAt] = useState<string | null>(null)
  const [verifiedAccountId, setVerifiedAccountId] = useState<string | null>(null)
  const [verifiedAccountCurrency, setVerifiedAccountCurrency] = useState<string | null>(null)
  const [timeframe, setTimeframe]     = useState<Timeframe>('any')
  const [query, setQuery]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [progress, setProgress]       = useState<string[]>([])
  const [error, setError]             = useState('')
  const [results, setResults]         = useState<Selection[]>([])
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [used, setUsed]               = useState<string | null>(null)
  const [filterMode, setFilterMode]   = useState<FilterMode>('auto')
  const [customMin, setCustomMin]     = useState('1.01')
  const [customMax, setCustomMax]     = useState('10.0')
  const [manualBackOdds, setManualBackOdds] = useState('')
  const [manualLayOdds, setManualLayOdds] = useState('')
  const [manualLabel, setManualLabel] = useState('')

  const scan = useCallback(async () => {
    if (!useSmarketsApi) {
      setError('Smarkets API is turned off. Use manual odds entry below.')
      return
    }
    const email = smarketsEmail.trim()
    const password = smarketsPassword
    if (!email || password.length === 0) {
      setError('Enter your own Smarkets email and password before scanning.')
      return
    }
    if (loginStatus !== 'valid' && loginStatus !== 'limited') {
      setError('Verify your Smarkets login before scanning.')
      return
    }

    setLoading(true)
    setError('')
    setResults([])
    setProgress([])
    const creds: SmarketsCredentials = { username: email, password }
    const preferPublic = loginStatus === 'limited'

    const dateRange = getDateRange(timeframe)

    try {
      if (scanMode === 'all') {
        // Scan all sports in parallel, stream progress
        const sportList = SPORTS
        setProgress(sportList.map(s => `${s.label}…`))

        const sportResults = await Promise.all(
          sportList.map(async (s, idx) => {
            const sels = await scanSport(s.type, s.id, creds, query, verifiedAccountId ?? undefined, preferPublic, dateRange)
            setProgress(prev => {
              const next = [...prev]
              next[idx] = `${s.label} — ${sels.length} found`
              return next
            })
            return sels
          })
        )

        const all = sportResults.flat()
        // Sort by efficiency (backOdds / layOdds) descending — highest profit / smallest loss first
        all.sort((a, b) => (b.backOdds / b.layOdds) - (a.backOdds / a.layOdds))
        setResults(all)
        setLastUpdatedAt(new Date().toISOString())
        if (all.length === 0) setError('No live quotes found across any sport. Markets may not be open yet.')
      } else {
        // Single sport
        const s = SPORTS.find(sp => sp.id === selectedSport)!
        setProgress([`Scanning ${s.label}…`])
        const sels = await scanSport(s.type, s.id, creds, query, verifiedAccountId ?? undefined, preferPublic, dateRange)
        // Sort by efficiency descending — highest profit / smallest loss first
        sels.sort((a, b) => (b.backOdds / b.layOdds) - (a.backOdds / a.layOdds))
        setResults(sels)
        setLastUpdatedAt(new Date().toISOString())
        if (sels.length === 0) setError('No valid quotes right now. Try again in a moment.')
        setProgress([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      if (scanMode === 'all') setTimeout(() => setProgress([]), 2000)
    }
  }, [scanMode, selectedSport, query, timeframe, smarketsEmail, smarketsPassword, loginStatus, verifiedAccountId, useSmarketsApi])

  const handleVerifyAndSaveCredentials = async () => {
    const email = smarketsEmail.trim()
    const password = smarketsPassword
    if (!email || password.length === 0) {
      setError('Both Smarkets email and password are required.')
      setLoginStatus('invalid')
      setLoginStatusMessage('Enter both email and password.')
      setLoginVerifiedAt(null)
      return
    }

    setLoginStatus('checking')
    setLoginStatusMessage(
      'Checking your Smarkets login… If Smarkets emails you, approve the sign-in request (it may appear as coming from the US).'
    )
    setLoginVerifiedAt(null)
    setVerifiedAccountId(null)
    setVerifiedAccountCurrency(null)
    setError('')

    try {
      const creds: SmarketsCredentials = { username: email, password }
      const accountData = await apiGet('/accounts/', creds) as AccountResponse
      const accountId = accountData.account?.account_id
      const currency = accountData.account?.currency
      if (!accountId) {
        throw new Error('Could not resolve account identity from Smarkets.')
      }
      localStorage.setItem('matchlock_smarkets_email', email)
      localStorage.setItem('matchlock_smarkets_password', password)
      setLoginStatus('valid')
      setLoginStatusMessage('Login verified. Requests are locked to this account.')
      setLoginVerifiedAt(new Date().toISOString())
      setVerifiedAccountId(accountId)
      setVerifiedAccountCurrency(currency ?? null)
      setTimeout(() => setLoginExpanded(false), 800)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      const limitedReason = getLimitedModeReason(detail)
      if (limitedReason) {
        localStorage.setItem('matchlock_smarkets_email', email)
        localStorage.setItem('matchlock_smarkets_password', password)
        setLoginStatus('limited')
        setLoginStatusMessage(
          `Smarkets restricted this login (${limitedReason}). Limited mode enabled for public market scanning.`
        )
        setLoginVerifiedAt(new Date().toISOString())
        setVerifiedAccountId(null)
        setVerifiedAccountCurrency(null)
        setError('')
        setTimeout(() => setLoginExpanded(false), 800)
        return
      }
      setLoginStatus('invalid')
      setLoginStatusMessage(`Could not verify login: ${detail}`)
      setError(`Smarkets login failed: ${detail}`)
      setLoginVerifiedAt(null)
      setVerifiedAccountId(null)
      setVerifiedAccountCurrency(null)
    }
  }

  const handleUse = (sel: Selection) => {
    onUse?.({ backOdds: sel.backOdds.toString(), layOdds: sel.layOdds.toString(), label: `${sel.name} — ${sel.eventName}` })
    setUsed(sel.contractId)
    setTimeout(() => setUsed(null), 2000)
  }

  const handleUseManualOdds = () => {
    const back = parseFloat(manualBackOdds)
    const lay = parseFloat(manualLayOdds)
    if (!Number.isFinite(back) || back < 1.01 || !Number.isFinite(lay) || lay < 1.01) {
      setError('Enter valid manual back/lay odds (minimum 1.01).')
      return
    }
    onUse?.({
      backOdds: back.toString(),
      layOdds: lay.toString(),
      label: manualLabel.trim() || 'Manual selection',
    })
    setError('')
    setUsed('manual')
    setTimeout(() => setUsed(null), 2000)
  }

  const getFiltered = () => {
    if (filterMode === 'custom') {
      const min = parseFloat(customMin) || 1.01
      const max = parseFloat(customMax) || 999
      return results.filter(s => s.backOdds >= min && s.backOdds <= max)
    }
    if (filterMode === 'qualifying') return results.filter(s => s.backOdds <= 3.0)
    if (filterMode === 'free_bet')   return results.filter(s => s.backOdds >= 5.0)
    return results
  }

  const filteredResults = getFiltered()
  // For auto mode: both buckets sorted by efficiency (backOdds / layOdds) descending — most profitable first
  const qualifying = results.filter(s => s.backOdds <= 3.0).sort((a, b) => (b.backOdds / b.layOdds) - (a.backOdds / a.layOdds))
  const freeBets   = results.filter(s => s.backOdds >= 5.0).sort((a, b) => (b.backOdds / b.layOdds) - (a.backOdds / a.layOdds))

  const filterColor: Record<FilterMode, string> = {
    auto: 'var(--accent)', qualifying: 'var(--profit)', free_bet: 'var(--accent)', custom: 'var(--text)',
  }
  const filterDim: Record<FilterMode, string> = {
    auto: 'var(--accent-dim)', qualifying: 'var(--profit-dim)', free_bet: 'var(--accent-dim)', custom: 'var(--surface2)',
  }

  const statusText = loading
    ? scanMode === 'all' ? `Scanning ${SPORTS.length} sports in parallel…` : 'Scanning…'
    : results.length > 0
      ? `${results.length} selections · ${qualifying.length} qualifying · ${freeBets.length} free bet${lastUpdatedAt ? ` · updated ${formatTime(lastUpdatedAt)}` : ''}`
      : loginStatus === 'valid' || loginStatus === 'limited'
        ? 'Ready — hit Scan to fetch live exchange odds'
        : 'Verify your Smarkets login above to start scanning'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Control panel ─────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
        <div className="label" style={{ marginBottom: '14px' }}>Live Odds Scanner — Smarkets Exchange</div>

        <div style={{
          marginBottom: '14px',
          padding: '10px 12px',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          background: 'var(--surface2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Data Source
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !useSmarketsApi
                setUseSmarketsApi(next)
                localStorage.setItem('matchlock_use_smarkets_api', String(next))
                setError('')
              }}
              style={{
                padding: '5px 12px',
                borderRadius: '100px',
                fontSize: '12px',
                border: useSmarketsApi ? '1px solid var(--accent)' : '1px solid var(--warning)',
                background: useSmarketsApi ? 'var(--accent-dim)' : 'var(--warning-dim)',
                color: useSmarketsApi ? 'var(--accent)' : 'var(--warning)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {useSmarketsApi ? 'Smarkets API: On' : 'Smarkets API: Off'}
            </button>
          </div>
          {!useSmarketsApi && (
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
              API scanning is disabled. You can still add manual odds below and send them to the calculator.
            </div>
          )}
        </div>

        {/* ── Smarkets login ── */}
        {useSmarketsApi && (loginStatus === 'valid' || loginStatus === 'limited') && !loginExpanded ? (
          /* Compact verified bar */
          <div style={{
            marginBottom: '14px', padding: '9px 12px',
            borderRadius: 'var(--radius)',
            border: loginStatus === 'limited'
              ? '1px solid oklch(0.75 0.13 85 / 0.35)'
              : '1px solid oklch(0.64 0.160 145 / 0.35)',
            background: loginStatus === 'limited' ? 'var(--warning-dim)' : 'var(--profit-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: loginStatus === 'limited' ? 'var(--warning)' : 'var(--profit)',
                flexShrink: 0,
              }} />
              <span style={{ fontSize: '12px', color: loginStatus === 'limited' ? 'var(--warning)' : 'var(--profit)', fontWeight: 500 }}>
                {loginStatus === 'limited' ? 'Smarkets limited mode' : 'Smarkets verified'}
              </span>
              {loginVerifiedAt && (
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>· {formatTime(loginVerifiedAt)}</span>
              )}
            </div>
            <button onClick={() => setLoginExpanded(true)} style={{
              fontSize: '11px', color: 'var(--muted)', background: 'transparent', border: 'none',
              cursor: 'pointer', padding: '2px 6px',
            }}>Change</button>
          </div>
        ) : useSmarketsApi ? (
          <div style={{
            marginBottom: '14px', padding: '12px', borderRadius: 'var(--radius)',
            border: loginStatus === 'valid'
              ? '1px solid oklch(0.64 0.160 145 / 0.35)'
              : loginStatus === 'limited'
                ? '1px solid oklch(0.75 0.13 85 / 0.35)'
              : loginStatus === 'invalid'
                ? '1px solid oklch(0.61 0.190 22 / 0.35)'
                : '1px solid var(--border)',
            background: 'var(--surface2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div className="label">Smarkets Login</div>
              {(loginStatus === 'valid' || loginStatus === 'limited') && (
                <button onClick={() => setLoginExpanded(false)} style={{
                  fontSize: '11px', color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer',
                }}>Collapse ↑</button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr minmax(0, 1fr) auto', gap: '8px' }}>
              <input
                value={smarketsEmail}
                onChange={e => {
                  setSmarketsEmail(e.target.value)
                if (loginStatus !== 'idle') {
                  setLoginStatus('idle')
                  setLoginStatusMessage('')
                  setLoginVerifiedAt(null)
                  setVerifiedAccountId(null)
                  setVerifiedAccountCurrency(null)
                }
                }}
                placeholder="Email"
                className="input-field"
                autoComplete="username"
              />
              <div style={{ position: 'relative', minWidth: 0 }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={smarketsPassword}
                  onChange={e => {
                    setSmarketsPassword(e.target.value)
                  if (loginStatus !== 'idle') {
                    setLoginStatus('idle')
                    setLoginStatusMessage('')
                    setLoginVerifiedAt(null)
                    setVerifiedAccountId(null)
                    setVerifiedAccountCurrency(null)
                  }
                  }}
                  placeholder="Password"
                  className="input-field"
                  autoComplete="current-password"
                  style={{ paddingRight: '52px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--muted)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                    lineHeight: 1,
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <button
                onClick={handleVerifyAndSaveCredentials}
                disabled={loginStatus === 'checking'}
                className="btn-primary"
                style={{ minWidth: '120px', opacity: loginStatus === 'checking' ? 0.75 : 1 }}
              >
                {loginStatus === 'checking' ? 'Verifying…' : 'Verify'}
              </button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--subtle)', marginTop: '6px' }}>
              Stored only in your browser. Used to authenticate with Smarkets API.
            </div>
            <div style={{ fontSize: '11px', color: 'var(--warning)', marginTop: '6px' }}>
              If Smarkets sends a security email after you enter details or click Verify, check your inbox and approve the
              request. It may show as originating from the app/US location.
            </div>
            {(loginStatus === 'valid' || loginStatus === 'limited' || loginStatus === 'invalid') && (
              <div style={{
                marginTop: '8px', padding: '8px 10px', borderRadius: 'var(--radius)', fontSize: '12px',
                border: loginStatus === 'valid'
                  ? '1px solid oklch(0.64 0.160 145 / 0.35)'
                  : loginStatus === 'limited'
                    ? '1px solid oklch(0.75 0.13 85 / 0.35)'
                    : '1px solid oklch(0.61 0.190 22 / 0.35)',
                background: loginStatus === 'valid'
                  ? 'var(--profit-dim)'
                  : loginStatus === 'limited'
                    ? 'var(--warning-dim)'
                    : 'var(--danger-dim)',
                color: loginStatus === 'valid' ? 'var(--profit)' : loginStatus === 'limited' ? 'var(--warning)' : 'var(--danger)',
              }}>
                <div>{loginStatusMessage}</div>
                {loginStatus === 'valid' && verifiedAccountId && (
                  <div style={{ marginTop: '4px', color: 'var(--muted)', fontSize: '11px' }}>
                    Connected account: #{verifiedAccountId}{verifiedAccountCurrency ? ` (${verifiedAccountCurrency})` : ''}
                    {loginVerifiedAt ? ` · Verified ${formatTime(loginVerifiedAt)}` : ''}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        {/* Scan mode toggle */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
          <button onClick={() => setScanMode('all')} style={{
            padding: '6px 16px', borderRadius: 'var(--radius)', fontSize: '13px', cursor: 'pointer', fontWeight: scanMode === 'all' ? 700 : 400,
            border: scanMode === 'all' ? '1px solid var(--accent)' : '1px solid var(--border)',
            background: scanMode === 'all' ? 'var(--accent-dim)' : 'transparent',
            color: scanMode === 'all' ? 'var(--accent)' : 'var(--muted)', transition: 'all 0.12s',
          }}>
            Scan All Sports
          </button>
          <button onClick={() => setScanMode('single')} style={{
            padding: '6px 16px', borderRadius: 'var(--radius)', fontSize: '13px', cursor: 'pointer', fontWeight: scanMode === 'single' ? 700 : 400,
            border: scanMode === 'single' ? '1px solid var(--accent)' : '1px solid var(--border)',
            background: scanMode === 'single' ? 'var(--accent-dim)' : 'transparent',
            color: scanMode === 'single' ? 'var(--accent)' : 'var(--muted)', transition: 'all 0.12s',
          }}>
            Single Sport
          </button>
        </div>

        {/* Single sport pills (only in single mode) */}
        {scanMode === 'single' && (
          <div className="filter-strip" style={{ display: 'flex', gap: '5px', flexWrap: isMobile ? 'nowrap' : 'wrap', marginBottom: '14px' }}>
            {SPORTS.map(s => {
              const active = selectedSport === s.id
              return (
                <button key={s.id} onClick={() => setSelectedSport(s.id)} style={{
                  padding: '5px 13px', borderRadius: '100px', fontSize: '12px', cursor: 'pointer', flexShrink: 0,
                  border: active ? `1px solid ${SPORT_COLOR[s.id]}` : '1px solid var(--border)',
                  background: active ? `${SPORT_COLOR[s.id]}22` : 'transparent',
                  color: active ? SPORT_COLOR[s.id] : 'var(--muted)',
                  fontWeight: active ? 600 : 400, transition: 'all 0.12s',
                }}>{s.label}</button>
              )
            })}
          </div>
        )}

        {/* All sports chips (read-only, show in all mode) */}
        {scanMode === 'all' && (
          <div className="filter-strip" style={{ display: 'flex', gap: '5px', flexWrap: isMobile ? 'nowrap' : 'wrap', marginBottom: '14px' }}>
            {SPORTS.map(s => (
              <div key={s.id} style={{
                padding: '4px 12px', borderRadius: '100px', fontSize: '11px', flexShrink: 0,
                border: `1px solid ${SPORT_COLOR[s.id]}44`,
                background: `${SPORT_COLOR[s.id]}11`,
                color: SPORT_COLOR[s.id], fontWeight: 500,
              }}>{s.label}</div>
            ))}
          </div>
        )}

        {/* Timeframe picker */}
        <div style={{ marginBottom: '14px' }}>
          <div className="label" style={{ marginBottom: '8px' }}>Timeframe</div>
          <div style={{ display: 'flex', gap: '5px', flexWrap: isMobile ? 'nowrap' : 'wrap' }}>
            {([
              { id: 'any'      as Timeframe, label: 'Any time'  },
              { id: '3h'       as Timeframe, label: 'Next 3h'   },
              { id: 'today'    as Timeframe, label: 'Today'     },
              { id: 'tomorrow' as Timeframe, label: 'Tomorrow'  },
              { id: '7d'       as Timeframe, label: 'Next 7d'   },
            ]).map(tf => {
              const active = timeframe === tf.id
              return (
                <button
                  key={tf.id}
                  onClick={() => setTimeframe(tf.id)}
                  style={{
                    padding: '5px 13px', borderRadius: '100px', fontSize: '12px', cursor: 'pointer', flexShrink: 0,
                    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: active ? 'var(--accent-dim)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--muted)',
                    fontWeight: active ? 600 : 400, transition: 'all 0.12s',
                  }}
                >
                  {tf.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Search + scan row */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && scan()}
            placeholder={isMobile ? 'Filter event name (optional)' : scanMode === 'all' ? 'Filter by team / event name across all sports (optional)' : 'Filter by team / event name (optional)'}
            className="input-field" style={{ flex: 1 }}
            disabled={!useSmarketsApi}
          />
          <button onClick={scan} disabled={!useSmarketsApi || loading || (loginStatus !== 'valid' && loginStatus !== 'limited')} className="btn-primary" style={{
            minWidth: isMobile ? '80px' : '130px',
            opacity: (!useSmarketsApi || loading || (loginStatus !== 'valid' && loginStatus !== 'limited')) ? 0.6 : 1,
            cursor: (!useSmarketsApi || loading || (loginStatus !== 'valid' && loginStatus !== 'limited')) ? 'not-allowed' : 'pointer',
          }}>
            {loading ? '…' : scanMode === 'all' ? (isMobile ? 'Scan' : 'Scan All') : 'Scan'}
          </button>
        </div>
        {useSmarketsApi && loginStatus !== 'valid' && loginStatus !== 'limited' && (
          <div style={{ fontSize: '11px', color: 'var(--warning)', marginTop: '6px' }}>
            Verify your Smarkets login to enable scanning.
          </div>
        )}

        {!useSmarketsApi && (
          <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
            <div className="label" style={{ marginBottom: '8px' }}>Manual Odds Entry</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 110px 110px auto', gap: '8px' }}>
              <input
                value={manualLabel}
                onChange={e => setManualLabel(e.target.value)}
                placeholder="Selection label (optional)"
                className="input-field"
              />
              <input
                type="number"
                step="0.01"
                min="1.01"
                value={manualBackOdds}
                onChange={e => setManualBackOdds(e.target.value)}
                placeholder="Back"
                className="input-field"
              />
              <input
                type="number"
                step="0.01"
                min="1.01"
                value={manualLayOdds}
                onChange={e => setManualLayOdds(e.target.value)}
                placeholder="Lay"
                className="input-field"
              />
              <button
                type="button"
                onClick={handleUseManualOdds}
                className="btn-primary"
                style={{ minWidth: '130px' }}
              >
                {used === 'manual' ? '✓ Sent' : 'Use in Calculator'}
              </button>
            </div>
          </div>
        )}

        {/* Bookmaker selector */}
        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
          <div className="label" style={{ marginBottom: '8px' }}>Your Bookmaker</div>
          <div className="filter-strip" style={{ display: 'flex', gap: '5px', flexWrap: isMobile ? 'nowrap' : 'wrap' }}>
            {BOOKMAKERS.map(bm => {
              const active = bookmaker === bm
              return (
                <button key={bm} onClick={() => setBookmaker(bm)} style={{
                  padding: '5px 12px', borderRadius: 'var(--radius)', fontSize: '12px', cursor: 'pointer', flexShrink: 0,
                  border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: active ? 'var(--accent-dim)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--muted)',
                  fontWeight: active ? 600 : 400, transition: 'all 0.12s',
                }}>{bm}</button>
              )
            })}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--subtle)', marginTop: '6px' }}>
            Each result will open {bookmaker} with event + market + selection prefilled
          </div>
        </div>

        <div style={{ fontSize: '11px', color: loading ? 'var(--accent)' : 'var(--subtle)', marginTop: '10px' }}>
          {statusText}
        </div>

        {/* Per-sport progress (during all-sports scan) */}
        {loading && scanMode === 'all' && progress.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
            {SPORTS.map((s, i) => (
              <div key={s.id} style={{
                fontSize: '11px', padding: '3px 10px', borderRadius: '100px',
                background: `${SPORT_COLOR[s.id]}15`,
                border: `1px solid ${SPORT_COLOR[s.id]}33`,
                color: progress[i]?.includes('found') ? SPORT_COLOR[s.id] : 'var(--muted)',
                transition: 'color 0.3s',
              }}>
                {progress[i] || `${s.label}…`}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Error ─────────────────────────────────────────────── */}
      {error && (
        <div style={{
          background: 'var(--danger-dim)', border: '1px solid oklch(0.61 0.190 22 / 0.2)',
          borderRadius: 'var(--radius-lg)', padding: '14px 16px', color: 'var(--danger)', fontSize: '13px',
        }}>{error}</div>
      )}

      {/* ── Filter bar ────────────────────────────────────────── */}
      {results.length > 0 && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
        }}>
          <div className="label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>Filter</div>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {([
              { id: 'auto'       as FilterMode, label: 'Auto (Both)'   },
              { id: 'qualifying' as FilterMode, label: 'Qualifying'    },
              { id: 'free_bet'   as FilterMode, label: 'Free Bet 5.0+' },
              { id: 'custom'     as FilterMode, label: 'Custom'        },
            ]).map(fc => {
              const active = filterMode === fc.id
              return (
                <button key={fc.id} onClick={() => setFilterMode(fc.id)} style={{
                  padding: '5px 12px', borderRadius: '100px', fontSize: '12px', cursor: 'pointer',
                  border: active ? `1px solid ${filterColor[fc.id]}` : '1px solid var(--border)',
                  background: active ? filterDim[fc.id] : 'transparent',
                  color: active ? filterColor[fc.id] : 'var(--muted)',
                  fontWeight: active ? 600 : 400, transition: 'all 0.12s',
                }}>{fc.label}</button>
              )
            })}
          </div>
          {filterMode === 'custom' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="number" step="0.1" value={customMin} onChange={e => setCustomMin(e.target.value)}
                placeholder="Min" className="input-field"
                style={{ width: '70px', padding: '5px 8px', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }} />
              <span style={{ color: 'var(--muted)', fontSize: '13px' }}>–</span>
              <input type="number" step="0.1" value={customMax} onChange={e => setCustomMax(e.target.value)}
                placeholder="Max" className="input-field"
                style={{ width: '70px', padding: '5px 8px', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }} />
            </div>
          )}
          <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--muted)' }}>
            {filterMode !== 'auto' ? `${filteredResults.length} of ${results.length}` : `${results.length} total`}
          </div>
        </div>
      )}

      {/* ── Auto: two buckets ─────────────────────────────────── */}
      {!loading && results.length > 0 && filterMode === 'auto' && (
        <div className="bucket-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Bucket
            title="Qualifying Bets"
            subtitle="Under 3.0 — least qualifying loss first"
            accentColor="var(--profit)"
            dimColor="var(--profit-dim)"
            selections={qualifying}
            used={used}
            onUse={handleUse}
            sortLabel="by profit ↓"
            bookmaker={bookmaker}
          />
          <Bucket
            title="Free Bets — Best Value"
            subtitle="5.0+ — max cash extraction from free bet (SNR)"
            accentColor="var(--accent)"
            dimColor="var(--accent-dim)"
            selections={freeBets}
            used={used}
            onUse={handleUse}
            sortLabel="by profit ↓"
            bookmaker={bookmaker}
          />
        </div>
      )}

      {/* ── Filtered / custom: flat list ──────────────────────── */}
      {!loading && results.length > 0 && filterMode !== 'auto' && (
        <ResultsList
          selections={filteredResults}
          accentColor={filterColor[filterMode]}
          used={used}
          onUse={handleUse}
          bookmaker={bookmaker}
        />
      )}

      {/* ── Empty state ───────────────────────────────────────── */}
      {!loading && results.length === 0 && !error && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          padding: '70px 40px', textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'var(--accent-muted)', border: '1px solid var(--accent-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 700, fontSize: '18px', color: 'var(--text)', marginBottom: '6px' }}>
              Ready to scan
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--accent)' }}>Scan All Sports</strong> fetches Football, Horse Racing, Cricket, Basketball and Tennis simultaneously
              and returns the highest odds across all of them.
              <br />
              Results split into <strong style={{ color: 'var(--profit)' }}>Qualifying</strong> (&lt;3.0) and <strong style={{ color: 'var(--accent)' }}>Free Bet</strong> (5.0+) buckets.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Bucket ──────────────────────────────────────────────────────────────────
function Bucket({ title, subtitle, accentColor, dimColor, selections, used, onUse, sortLabel, bookmaker }: {
  title: string; subtitle: string; accentColor: string; dimColor: string
  selections: Selection[]; used: string | null; onUse: (s: Selection) => void; sortLabel: string; bookmaker: string
}) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: dimColor }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 700, fontSize: '15px', color: accentColor }}>
            {title}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{sortLabel}</div>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{subtitle}</div>
      </div>

      {selections.length === 0 ? (
        <div style={{ padding: '36px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
          No selections in this range right now
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {selections.map((sel, i) => (
            <div key={sel.contractId} style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px',
              borderBottom: i < selections.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{
                width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                background: i === 0 ? accentColor : 'var(--surface2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700, color: i === 0 ? 'var(--bg)' : 'var(--muted)',
              }}>{i + 1}</div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sel.name}
                  </div>
                  <SportBadge sport={sel.sport} />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sel.eventName} · {formatDate(sel.eventDate)}
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{
                  fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 800,
                  fontSize: '20px', color: accentColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                }}>{sel.backOdds.toFixed(2)}</div>
                <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '1px' }}>
                  lay {sel.layOdds.toFixed(2)} · sp {sel.spread.toFixed(2)}
                </div>
                <div style={{
                  fontSize: '10px', fontWeight: 700, marginTop: '2px',
                  color: sel.backOdds >= sel.layOdds ? 'var(--profit)' : 'var(--warning)',
                }}>
                  {((sel.backOdds / sel.layOdds - 1) * 100).toFixed(1)}% eff
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                <button onClick={() => onUse(sel)} style={{
                  padding: '4px 10px', borderRadius: 'var(--radius)', fontSize: '11px',
                  fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  border: '1px solid var(--border)',
                  background: used === sel.contractId ? accentColor : 'transparent',
                  color: used === sel.contractId ? 'var(--bg)' : 'var(--muted)',
                }}>
                  {used === sel.contractId ? '✓' : 'Calc →'}
                </button>
                <a
                  href={bookmakerUrl(bookmaker, sel.eventName)}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'block', textAlign: 'center',
                    padding: '4px 10px', borderRadius: 'var(--radius)', fontSize: '11px',
                    fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s', textDecoration: 'none',
                    border: '1px solid var(--accent)', background: 'var(--accent-dim)', color: 'var(--accent)',
                  }}
                >
                  Bet ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Flat list ───────────────────────────────────────────────────────────────
function ResultsList({ selections, accentColor, used, onUse, bookmaker }: {
  selections: Selection[]; accentColor: string; used: string | null; onUse: (s: Selection) => void; bookmaker: string
}) {
  if (selections.length === 0) {
    return (
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
        padding: '48px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px',
      }}>
        No selections match this filter. Try widening the range or scanning a different sport.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '28px 1fr 76px 64px 54px 56px 60px auto auto',
        gap: '12px', padding: '6px 14px',
        fontSize: '10px', color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>
        <span>#</span><span>Selection</span>
        <span style={{ textAlign: 'right' }}>Back</span>
        <span style={{ textAlign: 'right' }}>Lay</span>
        <span style={{ textAlign: 'center' }}>Spread</span>
        <span style={{ textAlign: 'center' }}>Eff %</span>
        <span>Sport</span>
        <span /><span />
      </div>

      {selections.map((sel, i) => {
        const spreadGood = sel.spread <= 0.05
        const spreadOk   = sel.spread <= 0.15
        return (
          <div key={sel.contractId} style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            padding: '11px 14px',
            display: 'grid', gridTemplateColumns: '28px 1fr 76px 64px 54px 56px 60px auto auto',
            gap: '12px', alignItems: 'center',
          }}>
            <div style={{
              width: '22px', height: '22px', borderRadius: '50%',
              background: i === 0 ? accentColor : 'var(--surface2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 700, color: i === 0 ? 'var(--bg)' : 'var(--muted)',
            }}>{i + 1}</div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sel.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {sel.eventName} · {formatDate(sel.eventDate)}
              </div>
            </div>

            <div style={{
              textAlign: 'right', fontFamily: "'Barlow Semi Condensed', sans-serif",
              fontWeight: 800, fontSize: '18px', color: accentColor, fontVariantNumeric: 'tabular-nums',
            }}>{sel.backOdds.toFixed(2)}</div>

            <div style={{
              textAlign: 'right', fontFamily: "'Barlow Semi Condensed', sans-serif",
              fontWeight: 600, fontSize: '14px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums',
            }}>{sel.layOdds.toFixed(2)}</div>

            <div style={{ textAlign: 'center' }}>
              <span style={{
                display: 'inline-block', fontSize: '11px', fontWeight: 700,
                padding: '2px 6px', borderRadius: '4px', fontVariantNumeric: 'tabular-nums',
                color: spreadGood ? 'var(--profit)' : spreadOk ? 'var(--warning)' : 'var(--danger)',
                background: spreadGood ? 'var(--profit-dim)' : spreadOk ? 'var(--warning-dim)' : 'var(--danger-dim)',
              }}>{sel.spread.toFixed(2)}</span>
            </div>

            <div style={{ textAlign: 'center' }}>
              <span style={{
                display: 'inline-block', fontSize: '11px', fontWeight: 700,
                padding: '2px 6px', borderRadius: '4px', fontVariantNumeric: 'tabular-nums',
                color: sel.backOdds >= sel.layOdds ? 'var(--profit)' : 'var(--warning)',
                background: sel.backOdds >= sel.layOdds ? 'var(--profit-dim)' : 'var(--warning-dim)',
              }}>
                {((sel.backOdds / sel.layOdds - 1) * 100).toFixed(1)}%
              </span>
            </div>

            <SportBadge sport={sel.sport} />

            <button onClick={() => onUse(sel)} style={{
              padding: '5px 12px', borderRadius: 'var(--radius)', fontSize: '11px',
              fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              border: '1px solid var(--border)',
              background: used === sel.contractId ? accentColor : 'transparent',
              color: used === sel.contractId ? 'var(--bg)' : 'var(--muted)',
            }}>
              {used === sel.contractId ? '✓ Calc' : 'Calc →'}
            </button>
            <a
              href={bookmakerUrl(bookmaker, sel.eventName)}
              target="_blank" rel="noopener noreferrer"
              style={{
                padding: '5px 12px', borderRadius: 'var(--radius)', fontSize: '11px',
                fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s', textDecoration: 'none',
                border: '1px solid var(--accent)', background: 'var(--accent-dim)', color: 'var(--accent)',
              }}
            >
              Bet ↗
            </a>
          </div>
        )
      })}
    </div>
  )
}

function SportBadge({ sport }: { sport: string }) {
  const label = SPORTS.find(s => s.id === sport)?.label ?? sport
  const color = SPORT_COLOR[sport] ?? 'var(--muted)'
  return (
    <span style={{
      display: 'inline-block', flexShrink: 0,
      fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px',
      color, background: `${color}18`, letterSpacing: '0.2px',
    }}>{label}</span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
