'use client'

import type { Offer, BetRecord } from './Dashboard'
import { useIsMobile } from '@/hooks/useIsMobile'

const STAGES: Array<{ status: Offer['status']; label: string; color: string; dimColor: string }> = [
  { status: 'unused',     label: 'Unused',     color: 'var(--muted)',   dimColor: 'var(--surface3)' },
  { status: 'qualifying', label: 'Qualifying', color: 'var(--warning)', dimColor: 'var(--warning-dim)' },
  { status: 'free_bet',   label: 'Free Bet',   color: 'var(--accent)',  dimColor: 'var(--accent-dim)' },
  { status: 'complete',   label: 'Complete',   color: 'var(--profit)',  dimColor: 'var(--profit-dim)' },
]

const BOOKMAKERS = ['Bet365', 'Unibet', 'William Hill', 'Betway', 'Paddy Power', 'Coral', 'Ladbrokes', 'Sky Bet']

export default function Overview({ offers, bets }: { offers: Offer[]; bets: BetRecord[] }) {
  const isMobile = useIsMobile()
  const totalProfit   = offers.reduce((s, o) => s + (o.profit || 0), 0)
  const totalQualLoss = offers.reduce((s, o) => s + (o.qualifyingLoss || 0), 0)
  const totalFBAmount = offers.reduce((s, o) => s + (o.freeBetAmount || 0), 0)
  const totalFBValue  = offers.reduce((s, o) => s + (o.freeBetValue || 0), 0)
  const retention     = totalFBAmount > 0 ? (totalFBValue / totalFBAmount * 100) : 0
  const inProfit      = totalProfit >= 0

  if (offers.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '55vh', gap: '14px', textAlign: 'center' }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '14px',
          background: 'var(--accent-muted)', border: '1px solid var(--accent-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </div>
        <div>
          <div style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 700, fontSize: '20px', marginBottom: '6px' }}>
            Start tracking offers
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '13px', maxWidth: '320px', lineHeight: 1.6 }}>
            Add your first sign-up offer. MatchLock tracks qualifying losses, free bet value, and profit automatically.
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--subtle)', marginTop: '4px' }}>Offers → Add Offer</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Stats strip ─────────────────────────────────────────── */}
      <div className="stats-5col" style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)',
      }}>
        <StatCell label="Total P&L"           value={`${inProfit?'+':''}£${totalProfit.toFixed(2)}`}    color={inProfit ? 'var(--profit)' : 'var(--danger)'} large />
        <StatCell label="Qual. Cost"           value={`-£${Math.abs(totalQualLoss).toFixed(2)}`}         color="var(--danger)" divider={!isMobile} />
        <StatCell label="Free Bets"            value={`£${totalFBAmount.toFixed(2)}`}                    color="var(--accent)" divider={!isMobile} />
        <StatCell label="Extracted"            value={`£${totalFBValue.toFixed(2)}`}                     divider={!isMobile} />
        <StatCell label="Retention"            value={`${retention.toFixed(1)}%`}                        color={retention >= 70 ? 'var(--profit)' : retention >= 50 ? 'var(--warning)' : 'var(--muted)'} divider={!isMobile} />
      </div>

      {/* ── Pipeline + sidebar ──────────────────────────────────── */}
      <div className="panel-2col" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 360px', gap: '16px' }}>

        {/* Pipeline */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div className="label" style={{ marginBottom: '18px' }}>Offer Pipeline</div>

          {/* Stage counters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px' }}>
            {STAGES.map((stage, i) => {
              const count = offers.filter(o => o.status === stage.status).length
              return (
                <div key={stage.status} style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                  <div style={{
                    flex: 1, padding: '10px 12px', borderRadius: 'var(--radius)', textAlign: 'center',
                    background: count > 0 ? stage.dimColor : 'var(--surface2)',
                    border: `1px solid ${count > 0 ? stage.color.replace(')', ' / 0.3)').replace('var(', 'var(') : 'var(--border)'}`,
                  }}>
                    <div style={{
                      fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 700,
                      fontSize: '26px', lineHeight: 1, color: count > 0 ? stage.color : 'var(--subtle)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>{count}</div>
                    <div style={{ fontSize: '11px', marginTop: '3px', fontWeight: 500, color: count > 0 ? stage.color : 'var(--subtle)', letterSpacing: '0.2px' }}>
                      {stage.label}
                    </div>
                  </div>
                  {i < STAGES.length - 1 && <div style={{ color: 'var(--subtle)', fontSize: '18px', flexShrink: 0 }}>›</div>}
                </div>
              )
            })}
          </div>

          {/* Offer rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {offers.slice(0, 8).map(offer => {
              const stage = STAGES.find(s => s.status === offer.status) || STAGES[0]
              return (
                <div key={offer.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 12px', borderRadius: 'var(--radius)', background: 'var(--surface2)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>{offer.bookmaker}</span>
                    {offer.offerName && (
                      <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: '8px' }}>{offer.offerName}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', flexShrink: 0 }}>£{offer.freeBetAmount} fb</div>
                  <div style={{
                    fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px',
                    color: stage.color, background: stage.dimColor, flexShrink: 0,
                  }}>
                    {stage.label}
                  </div>
                  <div style={{
                    fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 700, fontSize: '13px',
                    color: offer.profit > 0 ? 'var(--profit)' : offer.profit < 0 ? 'var(--danger)' : 'var(--subtle)',
                    fontVariantNumeric: 'tabular-nums', minWidth: '56px', textAlign: 'right', flexShrink: 0,
                  }}>
                    {offer.profit !== 0 ? `${offer.profit > 0 ? '+' : ''}£${offer.profit.toFixed(2)}` : '—'}
                  </div>
                </div>
              )
            })}
            {offers.length > 8 && (
              <div style={{ fontSize: '11px', color: 'var(--subtle)', textAlign: 'center', padding: '8px' }}>
                +{offers.length - 8} more offers in the Offers tab
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Bookmakers */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px' }}>
            <div className="label" style={{ marginBottom: '12px' }}>Bookmakers</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
              {BOOKMAKERS.map(bm => {
                const bmOffers = offers.filter(o => o.bookmaker === bm)
                const complete = bmOffers.some(o => o.status === 'complete')
                const active   = bmOffers.some(o => o.status === 'qualifying' || o.status === 'free_bet')
                const profit   = bmOffers.reduce((s, o) => s + o.profit, 0)
                return (
                  <div key={bm} style={{
                    background: 'var(--surface2)',
                    border: `1px solid ${complete ? 'oklch(0.64 0.160 145 / 0.2)' : active ? 'var(--accent-dim)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)', padding: '8px 10px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 500 }}>{bm}</div>
                      <div style={{ fontSize: '10px', marginTop: '1px', color: complete ? 'var(--profit)' : active ? 'var(--accent)' : 'var(--subtle)' }}>
                        {complete ? '✓ Done' : active ? 'Active' : 'Available'}
                      </div>
                    </div>
                    {profit !== 0 && (
                      <div style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 700, fontSize: '12px', color: profit > 0 ? 'var(--profit)' : 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>
                        {profit > 0 ? '+' : ''}£{profit.toFixed(2)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Strategy tips */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px' }}>
            <div className="label" style={{ marginBottom: '12px' }}>Strategy</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Tip tag="Qualify" text="Use the minimum qualifying odds to minimise the qualifying loss." />
              <Tip tag="Convert" text="Free bets (SNR) at 4.0–6.0 odds extract 70–80%+ as cash." />
              <Tip tag="Exchange" text="Smarkets 2% beats Betfair 5% — meaningful on larger free bets." />
            </div>
          </div>
        </div>
      </div>

      {/* Recent bets */}
      {bets.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div className="label">Recent Bets</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{bets.length} logged</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
            {bets.slice(0, 6).map(b => (
              <div key={b.id} style={{
                background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '10px 12px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>{b.event}</div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                    {b.type === 'qualifying' ? 'Qualifying' : 'Free Bet'}
                  </div>
                </div>
                <div style={{
                  fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 700, fontSize: '14px',
                  color: b.outcome === 'pending' ? 'var(--muted)' : b.profit >= 0 ? 'var(--profit)' : 'var(--danger)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {b.outcome === 'pending' ? '—' : `${b.profit >= 0 ? '+' : ''}£${b.profit.toFixed(2)}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCell({ label, value, color, divider, large }: {
  label: string; value: string; color?: string; divider?: boolean; large?: boolean
}) {
  return (
    <div style={{ padding: '18px 22px', position: 'relative' }}>
      {divider && <div style={{ position: 'absolute', left: 0, top: '18%', bottom: '18%', width: '1px', background: 'var(--border)' }} />}
      <div className="label" style={{ marginBottom: '6px' }}>{label}</div>
      <div style={{
        fontFamily: "'Barlow Semi Condensed', sans-serif",
        fontWeight: large ? 800 : 700,
        fontSize: large ? '28px' : '22px',
        lineHeight: 1, letterSpacing: '-0.3px',
        color: color || 'var(--text)',
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
    </div>
  )
}

function Tip({ tag, text }: { tag: string; text: string }) {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
      <span style={{
        fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px',
        color: 'var(--accent)', background: 'var(--accent-muted)', flexShrink: 0,
        marginTop: '2px', letterSpacing: '0.5px', textTransform: 'uppercase',
      }}>{tag}</span>
      <span style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.55 }}>{text}</span>
    </div>
  )
}
