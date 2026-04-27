'use client'

import { useState, useEffect } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import Calculator, { type CalcPrefill } from './Calculator'
import OfferTracker from './OfferTracker'
import AccaHelper from './AccaHelper'
import Overview from './Overview'
import OddsScanner from './OddsScanner'
import BetLog from './BetLog'

export type Offer = {
  id: string
  bookmaker: string
  offerName: string
  type: 'signup' | 'reload' | 'acca'
  maxStake: number
  minOdds: number
  status: 'unused' | 'qualifying' | 'free_bet' | 'complete' | 'failed'
  qualifyingLoss: number
  freeBetValue: number
  freeBetAmount: number
  profit: number
  notes: string
  createdAt: string
}

export type BetRecord = {
  id: string
  offerId: string
  date: string
  event: string
  backStake: number
  backOdds: number
  layStake: number
  layOdds: number
  commission: number
  type: 'qualifying' | 'free_bet'
  outcome: 'pending' | 'won' | 'lost'
  profit: number
}

const TABS = [
  { id: 'overview',    label: 'Overview'     },
  { id: 'calculator', label: 'Calculator'    },
  { id: 'scanner',    label: 'Odds Scanner'  },
  { id: 'offers',     label: 'Offers'        },
  { id: 'betlog',     label: 'Bet Log'       },
  { id: 'acca',       label: 'Acca Helper'   },
]

export default function Dashboard() {
  const [activeTab, setActiveTab]     = useState('overview')
  const [offers, setOffers]           = useState<Offer[]>([])
  const [bets, setBets]               = useState<BetRecord[]>([])
  const [calcPrefill, setCalcPrefill] = useState<CalcPrefill | null>(null)

  useEffect(() => {
    const savedOffers = localStorage.getItem('matchlock_offers')
    const savedBets   = localStorage.getItem('matchlock_bets')
    if (savedOffers) setOffers(JSON.parse(savedOffers))
    if (savedBets)   setBets(JSON.parse(savedBets))
  }, [])

  const saveOffers = (updated: Offer[]) => {
    setOffers(updated)
    localStorage.setItem('matchlock_offers', JSON.stringify(updated))
  }

  const saveBets = (updated: BetRecord[]) => {
    setBets(updated)
    localStorage.setItem('matchlock_bets', JSON.stringify(updated))
  }

  const sendToCalculator = (prefill: CalcPrefill) => {
    setCalcPrefill(prefill)
    setActiveTab('calculator')
  }

  const isMobile = useIsMobile()
  const totalProfit   = offers.reduce((s, o) => s + (o.profit || 0), 0)
  const totalPending  = offers.filter(o => o.status === 'qualifying' || o.status === 'free_bet').length
  const totalComplete = offers.filter(o => o.status === 'complete').length
  const inProfit      = totalProfit >= 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="site-header" style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0 32px',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: 'var(--shadow-sm)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="11" width="18" height="11" rx="2" fill="var(--accent)" opacity="0.2"/>
            <rect x="3" y="11" width="18" height="11" rx="2" stroke="var(--accent)" strokeWidth="1.8"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="12" cy="16.5" r="1.5" fill="var(--accent)"/>
          </svg>
          <span style={{
            fontFamily: "'Barlow Semi Condensed', sans-serif",
            fontWeight: 800,
            fontSize: isMobile ? '16px' : '18px',
            letterSpacing: '0.5px',
            color: 'var(--text)',
            textTransform: 'uppercase',
          }}>
            MatchLock
          </span>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '24px' }}>
          {/* Offer counters — hidden on mobile */}
          {!isMobile && (
            <div style={{ display: 'flex', gap: '20px' }}>
              <HeaderStat label="Offers" value={offers.length} />
              <div style={{ width: '1px', background: 'var(--border)', alignSelf: 'stretch' }} />
              <HeaderStat label="Active" value={totalPending} color="var(--warning)" />
              <HeaderStat label="Done"   value={totalComplete} color="var(--profit)" />
            </div>
          )}

          {/* P&L pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: inProfit ? 'var(--profit-dim)' : 'var(--danger-dim)',
            border: `1px solid ${inProfit ? 'oklch(0.64 0.160 145 / 0.25)' : 'oklch(0.61 0.190 22 / 0.25)'}`,
            borderRadius: '10px',
            padding: isMobile ? '6px 12px' : '8px 16px',
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: inProfit ? 'var(--profit)' : 'var(--danger)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.6px', textTransform: 'uppercase', fontWeight: 500 }}>P&L</div>
              <div style={{
                fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 700,
                fontSize: isMobile ? '17px' : '20px', lineHeight: 1,
                color: inProfit ? 'var(--profit)' : 'var(--danger)', fontVariantNumeric: 'tabular-nums',
              }}>
                {inProfit ? '+' : ''}£{totalProfit.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Tab nav ────────────────────────────────────────────── */}
      <nav className="tab-nav" style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: `0 ${isMobile ? '12px' : '32px'}`,
        display: 'flex',
        gap: '0',
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: isMobile ? '11px 12px' : '13px 18px',
                fontSize: isMobile ? '12px' : '13px',
                fontWeight: active ? 600 : 400,
                fontFamily: "'Hanken Grotesk', sans-serif",
                color: active ? 'var(--accent)' : 'var(--muted)',
                background: 'none',
                border: 'none',
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'color 0.12s, border-color 0.12s',
                marginBottom: '-1px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </nav>

      {/* ── Content — always mounted so tab state persists ─────── */}
      <main className="main-content" style={{ padding: '28px 32px', maxWidth: '1240px', margin: '0 auto' }}>
        <div style={{ display: activeTab === 'overview'   ? undefined : 'none' }}><Overview offers={offers} bets={bets} /></div>
        <div style={{ display: activeTab === 'calculator' ? undefined : 'none' }}><Calculator prefill={calcPrefill} /></div>
        <div style={{ display: activeTab === 'scanner'    ? undefined : 'none' }}><OddsScanner onUse={sendToCalculator} /></div>
        <div style={{ display: activeTab === 'offers'     ? undefined : 'none' }}><OfferTracker offers={offers} onUpdate={saveOffers} /></div>
        <div style={{ display: activeTab === 'betlog'     ? undefined : 'none' }}><BetLog bets={bets} offers={offers} onUpdate={saveBets} /></div>
        <div style={{ display: activeTab === 'acca'       ? undefined : 'none' }}><AccaHelper /></div>
      </main>
    </div>
  )
}

function HeaderStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontFamily: "'Barlow Semi Condensed', sans-serif",
        fontWeight: 700,
        fontSize: '19px',
        lineHeight: 1,
        color: color || 'var(--text)',
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '3px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  )
}
