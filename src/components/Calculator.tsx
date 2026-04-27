'use client'

import { useState, useEffect } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'

type Mode = 'qualifying' | 'free_bet_snr' | 'free_bet_sr'

function calcQualifying(bs: number, bo: number, lo: number, c: number) {
  const comm = c / 100
  const layStake = (bs * bo) / (lo - comm)
  const liability = layStake * (lo - 1)
  const backWin = bs * (bo - 1) - liability
  const backLose = -bs + layStake * (1 - comm)
  return { layStake, liability, backWin, backLose, qualifyingLoss: Math.min(backWin, backLose) }
}

function calcFreeBetSNR(bs: number, bo: number, lo: number, c: number) {
  const comm = c / 100
  const layStake = (bs * (bo - 1)) / (lo - comm)
  const liability = layStake * (lo - 1)
  const backWin = bs * (bo - 1) - liability
  const backLose = layStake * (1 - comm)
  return { layStake, liability, backWin, backLose, profit: Math.min(backWin, backLose) }
}

function calcFreeBetSR(bs: number, bo: number, lo: number, c: number) {
  const comm = c / 100
  const layStake = (bs * bo) / (lo - comm)
  const liability = layStake * (lo - 1)
  const backWin = bs * (bo - 1) - liability
  const backLose = -bs + layStake * (1 - comm)
  return { layStake, liability, backWin, backLose, profit: Math.min(backWin, backLose) }
}

const EXCHANGES: Record<string, number> = {
  'Smarkets': 2,
  'Betfair': 5,
  'Matchbook': 1.5,
  'No Comm': 0,
  'Custom': 2,
}

const MODES: Array<{ id: Mode; label: string; desc: string }> = [
  { id: 'qualifying',   label: 'Qualifying',     desc: 'Lock in both outcomes while placing required qualifying bet' },
  { id: 'free_bet_snr', label: 'Free Bet (SNR)', desc: 'Stake Not Returned — most common free bet type, aim for 4.0+ odds' },
  { id: 'free_bet_sr',  label: 'Free Bet (SR)',  desc: 'Stake Returned — treat like a qualifying bet, ~90%+ extraction' },
]

export type CalcPrefill = { backOdds: string; layOdds: string; label?: string }

export default function Calculator({ prefill }: { prefill?: CalcPrefill | null }) {
  const isMobile = useIsMobile()
  const [mode, setMode]           = useState<Mode>('qualifying')
  const [backStake, setBackStake] = useState('')
  const [backOdds, setBackOdds]   = useState('')
  const [layOdds, setLayOdds]     = useState('')
  const [exchange, setExchange]   = useState('Smarkets')
  const [customComm, setCustomComm] = useState('2')
  const [copied, setCopied]       = useState(false)

  useEffect(() => {
    if (prefill) {
      setBackOdds(prefill.backOdds)
      setLayOdds(prefill.layOdds)
    }
  }, [prefill])

  const commission = exchange === 'Custom' ? parseFloat(customComm) || 0 : EXCHANGES[exchange]
  const bs = parseFloat(backStake)
  const bo = parseFloat(backOdds)
  const lo = parseFloat(layOdds)
  const valid = bs > 0 && bo > 1 && lo > 1

  type CalcResult = ReturnType<typeof calcQualifying> | ReturnType<typeof calcFreeBetSNR>
  let result: CalcResult | null = null
  if (valid) {
    if (mode === 'qualifying')        result = calcQualifying(bs, bo, lo, commission)
    else if (mode === 'free_bet_snr') result = calcFreeBetSNR(bs, bo, lo, commission)
    else                              result = calcFreeBetSR(bs, bo, lo, commission)
  }

  const retention = result && mode !== 'qualifying' && bs > 0
    ? (((result as ReturnType<typeof calcFreeBetSNR>).profit ?? 0) / bs * 100).toFixed(1)
    : null

  return (
    <div className="calc-grid" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '420px 1fr', gap: '20px' }}>

      {/* ── Left: inputs ─────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Mode tabs */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {MODES.map((m, i) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              style={{
                width: '100%', textAlign: 'left',
                padding: '12px 16px',
                background: mode === m.id ? 'var(--accent-muted)' : 'transparent',
                border: 'none',
                borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
                transition: 'background 0.12s',
                display: 'flex', alignItems: 'center', gap: '12px',
              }}
            >
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                background: mode === m.id ? 'var(--accent)' : 'var(--border-strong)',
              }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: mode === m.id ? 600 : 400, color: mode === m.id ? 'var(--text)' : 'var(--muted)' }}>
                  {m.label}
                </div>
                {mode === m.id && (
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', lineHeight: 1.4 }}>{m.desc}</div>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {prefill?.label && (
            <div style={{
              background: 'var(--accent-muted)', border: '1px solid var(--accent-dim)',
              borderRadius: 'var(--radius)', padding: '8px 12px',
              fontSize: '12px', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', gap: '7px',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4M3.5 3.5a12 12 0 0 0 0 17M20.5 3.5a12 12 0 0 1 0 17"/></svg>
              {prefill.label}
            </div>
          )}
          <Field label={mode === 'qualifying' ? 'Back Stake (£)' : 'Free Bet Amount (£)'} value={backStake} onChange={setBackStake} placeholder="25.00" />
          <Field label="Back Odds" value={backOdds} onChange={setBackOdds} placeholder="3.00" />
          <Field label="Lay Odds" value={layOdds} onChange={setLayOdds} placeholder="3.10" />

          {/* Exchange */}
          <div>
            <div className="label" style={{ marginBottom: '8px' }}>Exchange</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {Object.keys(EXCHANGES).map(ex => (
                <button key={ex} onClick={() => setExchange(ex)} style={{
                  padding: '5px 12px', borderRadius: 'var(--radius)', fontSize: '12px', fontWeight: 500,
                  cursor: 'pointer', transition: 'all 0.12s',
                  border: exchange === ex ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: exchange === ex ? 'var(--accent-dim)' : 'transparent',
                  color: exchange === ex ? 'var(--accent)' : 'var(--muted)',
                }}>
                  {ex !== 'Custom' ? `${ex} ${EXCHANGES[ex]}%` : 'Custom'}
                </button>
              ))}
            </div>
            {exchange === 'Custom' && (
              <input type="number" value={customComm} onChange={e => setCustomComm(e.target.value)}
                placeholder="Commission %" step="0.5" className="input-field" style={{ marginTop: '8px' }} />
            )}
            <div style={{ fontSize: '11px', color: 'var(--subtle)', marginTop: '6px' }}>
              Commission: {commission}% on lay winnings
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: results ───────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {!valid ? (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
            padding: '60px 40px', textAlign: 'center', color: 'var(--muted)', flex: 1,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px',
          }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '10px',
              background: 'var(--surface2)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--subtle)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="16" y2="18"/>
              </svg>
            </div>
            <div style={{ fontSize: '13px' }}>Enter stake, back odds, and lay odds</div>
          </div>
        ) : result ? (
          <>
            {/* Lay stake — the key action number */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px',
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px',
            }}>
              <div>
                <div className="label" style={{ marginBottom: '6px' }}>Lay Stake</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 800, fontSize: '36px',
                    color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px', lineHeight: 1,
                  }}>
                    £{result.layStake.toFixed(2)}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(result!.layStake.toFixed(2))
                      setCopied(true)
                      setTimeout(() => setCopied(false), 1800)
                    }}
                    title="Copy lay stake"
                    style={{
                      padding: '4px 9px', borderRadius: 'var(--radius)', fontSize: '11px', fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.15s', border: '1px solid var(--border)',
                      background: copied ? 'var(--accent-dim)' : 'transparent',
                      color: copied ? 'var(--accent)' : 'var(--muted)',
                    }}
                  >
                    {copied ? '✓' : 'Copy'}
                  </button>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>Place this on {exchange}</div>
              </div>
              <div>
                <div className="label" style={{ marginBottom: '6px' }}>Exchange Liability</div>
                <div style={{
                  fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 700, fontSize: '28px',
                  color: 'var(--danger)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.3px', lineHeight: 1,
                }}>
                  £{result.liability.toFixed(2)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>Must have in exchange account</div>
              </div>
            </div>

            {/* Outcome scenarios */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px',
            }}>
              <div className="label" style={{ marginBottom: '14px' }}>Both Outcomes</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <ScenarioBox label="Back bet WINS" value={result.backWin} />
                <ScenarioBox label="Back bet LOSES" value={result.backLose} />
              </div>
            </div>

            {/* Profit result */}
            {mode === 'qualifying' && 'qualifyingLoss' in result && (
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px',
              }}>
                <div className="label" style={{ marginBottom: '8px' }}>Qualifying Loss</div>
                <div style={{
                  fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 800, fontSize: '42px',
                  color: 'var(--danger)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px', lineHeight: 1,
                }}>
                  -£{Math.abs(result.qualifyingLoss).toFixed(2)}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px', lineHeight: 1.5 }}>
                  The cost to unlock your free bet. You recover this through the free bet conversion.
                </div>
              </div>
            )}

            {mode !== 'qualifying' && 'profit' in result && result.profit !== undefined && (
              <div style={{
                background: 'var(--profit-dim)',
                border: '1px solid oklch(0.64 0.160 145 / 0.25)',
                borderRadius: 'var(--radius-lg)', padding: '24px 20px',
              }}>
                <div className="label" style={{ marginBottom: '8px', color: 'var(--profit)' }}>Guaranteed Profit</div>
                <div style={{
                  fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 800, fontSize: '52px',
                  color: 'var(--profit)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-1.5px', lineHeight: 1,
                }}>
                  +£{result.profit.toFixed(2)}
                </div>
                {retention && (
                  <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '10px' }}>
                    {retention}% of £{bs.toFixed(2)} free bet extracted as cash
                  </div>
                )}
              </div>
            )}

            {/* Summary */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px',
            }}>
              <div className="label" style={{ marginBottom: '10px' }}>Summary</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <SummaryRow label="Back"       value={`£${bs.toFixed(2)} @ ${bo} on bookmaker`} />
                <SummaryRow label="Lay"        value={`£${result.layStake.toFixed(2)} @ ${lo} on ${exchange}`} />
                <SummaryRow label="Spread"     value={`${(lo - bo).toFixed(2)}`} warn={lo - bo > 0.3} />
                <SummaryRow label="Commission" value={`${commission}%`} />
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: '6px' }}>{label}</div>
      <input
        type="number" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} step="0.01" className="input-field"
        style={{
          fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 600,
          fontSize: '18px', fontVariantNumeric: 'tabular-nums',
        }}
      />
    </div>
  )
}

function ScenarioBox({ label, value }: { label: string; value: number }) {
  const pos = value >= 0
  return (
    <div style={{
      background: pos ? 'var(--profit-dim)' : 'var(--danger-dim)',
      border: `1px solid ${pos ? 'oklch(0.64 0.160 145 / 0.2)' : 'oklch(0.61 0.190 22 / 0.2)'}`,
      borderRadius: 'var(--radius)', padding: '14px',
    }}>
      <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>{label}</div>
      <div style={{
        fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 700, fontSize: '22px',
        color: pos ? 'var(--profit)' : 'var(--danger)', fontVariantNumeric: 'tabular-nums',
      }}>
        {pos ? '+' : ''}£{value.toFixed(2)}
      </div>
    </div>
  )
}

function SummaryRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: 500, color: warn ? 'var(--warning)' : 'var(--text)' }}>{value}</span>
    </div>
  )
}
