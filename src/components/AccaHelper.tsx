'use client'

import { useState } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'

type Leg = {
  id: string
  event: string
  backOdds: number
  layOdds: number
}

type CommissionMode = 'smarkets' | 'betfair' | 'matchbook' | 'none' | 'custom'

const COMM: Record<CommissionMode, number> = { smarkets: 2, betfair: 5, matchbook: 1.5, none: 0, custom: 2 }
const COMM_LABELS: Record<CommissionMode, string> = { smarkets: 'Smarkets 2%', betfair: 'Betfair 5%', matchbook: 'Matchbook 1.5%', none: 'No Comm', custom: 'Custom' }

export default function AccaHelper() {
  const isMobile = useIsMobile()
  const [accaStake, setAccaStake] = useState('')
  const [legs, setLegs] = useState<Leg[]>([
    { id: '1', event: '', backOdds: 0, layOdds: 0 },
    { id: '2', event: '', backOdds: 0, layOdds: 0 },
  ])
  const [commMode, setCommMode] = useState<CommissionMode>('smarkets')
  const [customComm, setCustomComm] = useState('2')
  const [approach, setApproach] = useState<'each_leg' | 'full_cover'>('each_leg')

  const commission = commMode === 'custom' ? parseFloat(customComm) || 0 : COMM[commMode]
  const c = commission / 100
  const stake = parseFloat(accaStake) || 0

  const addLeg = () => setLegs(l => [...l, { id: Date.now().toString(), event: '', backOdds: 0, layOdds: 0 }])
  const removeLeg = (id: string) => setLegs(l => l.filter(leg => leg.id !== id))
  const updateLeg = (id: string, field: keyof Leg, value: string | number) =>
    setLegs(l => l.map(leg => leg.id === id ? { ...leg, [field]: value } : leg))

  const accaOdds = legs.reduce((prod, leg) => prod * (leg.backOdds || 1), 1)
  const validLegs = legs.filter(l => l.backOdds > 1 && l.layOdds > 1)
  const allValid = validLegs.length === legs.length && stake > 0

  const legResults = legs.map(leg => {
    if (!allValid || leg.backOdds <= 1 || leg.layOdds <= 1) return null
    const layStake = (stake * leg.backOdds) / (leg.layOdds - c)
    const liability = layStake * (leg.layOdds - 1)
    const layWin = layStake * (1 - c)
    return { layStake, liability, layWin }
  })

  const totalLiability = legResults.reduce((s, r) => s + (r?.liability || 0), 0)
  const accaReturn = stake * accaOdds

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: '20px' }}>

      {/* ── Left: input ───────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Setup panel */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div className="label" style={{ marginBottom: '16px' }}>Acca Setup</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
            <div>
              <div className="label" style={{ marginBottom: '6px' }}>Acca Stake (£)</div>
              <input
                type="number" value={accaStake} onChange={e => setAccaStake(e.target.value)}
                placeholder="10.00" step="0.01" className="input-field"
                style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 600, fontSize: '18px', fontVariantNumeric: 'tabular-nums' }}
              />
            </div>
            <div>
              <div className="label" style={{ marginBottom: '6px' }}>Exchange Commission</div>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {(Object.keys(COMM) as CommissionMode[]).map(m => (
                  <button key={m} onClick={() => setCommMode(m)} style={{
                    padding: '5px 10px', borderRadius: 'var(--radius)', fontSize: '11px', cursor: 'pointer',
                    border: commMode === m ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: commMode === m ? 'var(--accent-dim)' : 'transparent',
                    color: commMode === m ? 'var(--accent)' : 'var(--muted)',
                    transition: 'all 0.12s',
                  }}>{COMM_LABELS[m]}</button>
                ))}
              </div>
              {commMode === 'custom' && (
                <input type="number" value={customComm} onChange={e => setCustomComm(e.target.value)}
                  placeholder="Commission %" step="0.5" className="input-field" style={{ marginTop: '8px' }} />
              )}
              <div style={{ fontSize: '11px', color: 'var(--subtle)', marginTop: '6px' }}>
                {commission}% on lay winnings
              </div>
            </div>
          </div>

          {/* Approach selector */}
          <div>
            <div className="label" style={{ marginBottom: '8px' }}>Approach</div>
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              {[
                { id: 'each_leg' as const, label: 'Lay Each Leg', desc: 'Lay each selection individually. If a leg loses, the acca dies and you keep the lay winnings.' },
                { id: 'full_cover' as const, label: 'Lay Full Acca', desc: 'Lay the entire acca on the exchange. Requires the exchange to offer acca markets (less common).' },
              ].map((opt, i) => (
                <button key={opt.id} onClick={() => setApproach(opt.id)} style={{
                  width: '100%', textAlign: 'left', padding: '12px 16px', cursor: 'pointer',
                  background: approach === opt.id ? 'var(--accent-muted)' : 'transparent',
                  border: 'none',
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                  display: 'flex', alignItems: 'flex-start', gap: '12px', transition: 'background 0.12s',
                }}>
                  <div style={{
                    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, marginTop: '5px',
                    background: approach === opt.id ? 'var(--accent)' : 'var(--border-strong)',
                  }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: approach === opt.id ? 600 : 400, color: approach === opt.id ? 'var(--text)' : 'var(--muted)' }}>
                      {opt.label}
                    </div>
                    {approach === opt.id && (
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', lineHeight: 1.4 }}>{opt.desc}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Legs */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div className="label">Legs ({legs.length})</div>
            <button onClick={addLeg} className="btn-ghost" style={{ fontSize: '12px', padding: '5px 12px' }}>
              + Add Leg
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {legs.map((leg, i) => {
              const res = legResults[i]
              return (
                <div key={leg.id} style={{
                  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px',
                }}>
                  {isMobile ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="label">Leg {i + 1}</div>
                        <button onClick={() => removeLeg(leg.id)} disabled={legs.length <= 2} style={{
                          padding: '4px 10px', borderRadius: 'var(--radius)', fontSize: '12px', cursor: legs.length <= 2 ? 'not-allowed' : 'pointer',
                          border: '1px solid var(--border)', background: 'transparent',
                          color: legs.length <= 2 ? 'var(--border-strong)' : 'var(--danger)',
                        }}>Remove</button>
                      </div>
                      <input value={leg.event} onChange={e => updateLeg(leg.id, 'event', e.target.value)}
                        placeholder="Man City vs Arsenal" className="input-field" style={{ fontSize: '13px' }} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <div className="label" style={{ marginBottom: '4px' }}>Back Odds</div>
                          <input type="number" value={leg.backOdds || ''} step="0.01"
                            onChange={e => updateLeg(leg.id, 'backOdds', parseFloat(e.target.value) || 0)}
                            placeholder="2.50" className="input-field"
                            style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 600, fontVariantNumeric: 'tabular-nums' }} />
                        </div>
                        <div>
                          <div className="label" style={{ marginBottom: '4px' }}>Lay Odds</div>
                          <input type="number" value={leg.layOdds || ''} step="0.01"
                            onChange={e => updateLeg(leg.id, 'layOdds', parseFloat(e.target.value) || 0)}
                            placeholder="2.60" className="input-field"
                            style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 600, fontVariantNumeric: 'tabular-nums' }} />
                        </div>
                      </div>
                    </div>
                  ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 36px', gap: '8px', alignItems: 'end' }}>
                    <div>
                      <div className="label" style={{ marginBottom: '4px' }}>Leg {i + 1}</div>
                      <input
                        value={leg.event}
                        onChange={e => updateLeg(leg.id, 'event', e.target.value)}
                        placeholder="Man City vs Arsenal"
                        className="input-field"
                        style={{ fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <div className="label" style={{ marginBottom: '4px' }}>Back Odds</div>
                      <input
                        type="number" value={leg.backOdds || ''} step="0.01"
                        onChange={e => updateLeg(leg.id, 'backOdds', parseFloat(e.target.value) || 0)}
                        placeholder="2.50" className="input-field"
                        style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                      />
                    </div>
                    <div>
                      <div className="label" style={{ marginBottom: '4px' }}>Lay Odds</div>
                      <input
                        type="number" value={leg.layOdds || ''} step="0.01"
                        onChange={e => updateLeg(leg.id, 'layOdds', parseFloat(e.target.value) || 0)}
                        placeholder="2.60" className="input-field"
                        style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                      />
                    </div>
                    <button
                      onClick={() => removeLeg(leg.id)}
                      disabled={legs.length <= 2}
                      style={{
                        padding: '0', height: '38px', borderRadius: 'var(--radius)', fontSize: '14px', cursor: legs.length <= 2 ? 'not-allowed' : 'pointer',
                        border: '1px solid var(--border)', background: 'transparent',
                        color: legs.length <= 2 ? 'var(--border-strong)' : 'var(--danger)',
                      }}
                    >✕</button>
                  </div>
                  )}

                  {res && (
                    <div style={{ display: 'flex', gap: '24px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                      <MiniStat label="Lay Stake" value={`£${res.layStake.toFixed(2)}`} color="var(--accent)" />
                      <MiniStat label="Liability" value={`£${res.liability.toFixed(2)}`} color="var(--danger)" />
                      <MiniStat label="Leg fails → you win" value={`+£${res.layWin.toFixed(2)}`} color="var(--profit)" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Right: summary ────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Summary card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div className="label" style={{ marginBottom: '16px' }}>Acca Summary</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            <SummaryRow label="Legs" value={legs.length.toString()} />
            <SummaryRow label="Combined odds" value={`${accaOdds.toFixed(2)}×`} />
            <SummaryRow label="Stake" value={stake > 0 ? `£${stake.toFixed(2)}` : '—'} />
            <SummaryRow label="Potential return" value={stake > 0 ? `£${accaReturn.toFixed(2)}` : '—'} color="var(--profit)" />
          </div>
        </div>

        {/* Liability callout */}
        {allValid && (
          <div style={{
            background: 'var(--danger-dim)', border: '1px solid oklch(0.61 0.190 22 / 0.2)',
            borderRadius: 'var(--radius-lg)', padding: '20px',
          }}>
            <div className="label" style={{ marginBottom: '6px', color: 'var(--danger)' }}>Total Lay Liability</div>
            <div style={{
              fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 800, fontSize: '38px',
              color: 'var(--danger)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px', lineHeight: 1,
            }}>
              £{totalLiability.toFixed(2)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px', lineHeight: 1.5 }}>
              You need this in your exchange account across all {legs.length} legs.
            </div>
          </div>
        )}

        {/* Strategy tips */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px' }}>
          <div className="label" style={{ marginBottom: '14px' }}>Strategy</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Tip tag="Markets" text="Lay odds closest to back odds = smallest liability. Football 1X2 on Smarkets is tightest." />
            <Tip tag="Legs" text="3–5 legs balance value vs exposure. More legs means bigger odds but harder to hit." />
            <Tip tag="Insurance" text="Bet365 often refunds 1-leg losers as a free bet. Convert with the Free Bet (SNR) calculator." />
            <Tip tag="T&Cs" text="Most bookmaker accas require minimum 1.2–1.5 per leg. Always check before placing." />
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: 'var(--subtle)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
      <div style={{
        fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 700, fontSize: '15px',
        color: color || 'var(--text)', fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
    </div>
  )
}

function SummaryRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 0', borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{label}</span>
      <span style={{
        fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 600, fontSize: '15px',
        color: color || 'var(--text)', fontVariantNumeric: 'tabular-nums',
      }}>{value}</span>
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
