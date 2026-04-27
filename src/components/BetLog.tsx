'use client'

import { useState } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import type { BetRecord, Offer } from './Dashboard'

const EMPTY: Omit<BetRecord, 'id'> = {
  offerId: '', date: new Date().toISOString().split('T')[0],
  event: '', backStake: 0, backOdds: 0, layStake: 0, layOdds: 0,
  commission: 2, type: 'qualifying', outcome: 'pending', profit: 0,
}

function calcProfit(bet: Omit<BetRecord, 'id'>, outcome: BetRecord['outcome']): number {
  if (outcome === 'pending') return 0
  const c = bet.commission / 100
  if (bet.type === 'qualifying') {
    return outcome === 'won'
      ? bet.backStake * (bet.backOdds - 1) - bet.layStake * (bet.layOdds - 1)
      : bet.layStake * (1 - c) - bet.backStake
  } else {
    return outcome === 'won'
      ? bet.backStake * (bet.backOdds - 1) - bet.layStake * (bet.layOdds - 1)
      : bet.layStake * (1 - c)
  }
}

export default function BetLog({ bets, offers, onUpdate }: {
  bets: BetRecord[]; offers: Offer[]; onUpdate: (b: BetRecord[]) => void
}) {
  const isMobile = useIsMobile()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(EMPTY)
  const [editId, setEditId]     = useState<string | null>(null)
  const [filterType, setFilterType]       = useState<'all' | BetRecord['type']>('all')
  const [filterOutcome, setFilterOutcome] = useState<'all' | BetRecord['outcome']>('all')

  const set = <K extends keyof typeof EMPTY>(k: K, v: typeof EMPTY[K]) => setForm(f => ({ ...f, [k]: v }))

  const save = () => {
    if (!form.event || !form.backStake) return
    const profit = calcProfit(form, form.outcome)
    const final  = { ...form, profit }
    if (editId) {
      onUpdate(bets.map(b => b.id === editId ? { ...final, id: editId } : b))
      setEditId(null)
    } else {
      onUpdate([...bets, { ...final, id: Date.now().toString() }])
    }
    setForm(EMPTY); setShowForm(false)
  }

  const edit = (b: BetRecord) => { setForm({ ...b }); setEditId(b.id); setShowForm(true) }
  const del  = (id: string)   => { if (confirm('Delete bet?')) onUpdate(bets.filter(b => b.id !== id)) }

  const setOutcome = (id: string, outcome: BetRecord['outcome']) => {
    onUpdate(bets.map(b => b.id !== id ? b : { ...b, outcome, profit: calcProfit(b, outcome) }))
  }

  const exportCSV = () => {
    const offerMap = new Map(offers.map(o => [o.id, o]))
    const h = ['Date','Event','Offer','Type','Back Stake','Back Odds','Lay Stake','Lay Odds','Commission %','Outcome','P&L']
    const r = bets.map(b => {
      const o = offerMap.get(b.offerId)
      return [b.date, `"${b.event}"`, o ? `"${o.bookmaker} - ${o.offerName}"` : '', b.type === 'qualifying' ? 'Qualifying' : 'Free Bet', b.backStake.toFixed(2), b.backOdds.toFixed(2), b.layStake.toFixed(2), b.layOdds.toFixed(2), b.commission, b.outcome, b.profit.toFixed(2)].join(',')
    })
    const blob = new Blob([[h.join(','), ...r].join('\n')], { type: 'text/csv' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `matchlock-bets-${new Date().toISOString().split('T')[0]}.csv` })
    a.click(); URL.revokeObjectURL(a.href)
  }

  const filtered = bets.filter(b => {
    if (filterType    !== 'all' && b.type    !== filterType)    return false
    if (filterOutcome !== 'all' && b.outcome !== filterOutcome) return false
    return true
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const totalPL      = bets.reduce((s, b) => s + b.profit, 0)
  const pendingCount = bets.filter(b => b.outcome === 'pending').length
  const wonCount     = bets.filter(b => b.outcome === 'won').length
  const preview      = form.backStake && form.backOdds && form.layStake && form.layOdds && form.outcome !== 'pending'
    ? calcProfit(form, form.outcome) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Stats */}
      <div className="stats-4col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {[
          { label: 'Total Bets', value: bets.length.toString() },
          { label: 'Pending',    value: pendingCount.toString(), color: 'var(--warning)' },
          { label: 'Won',        value: wonCount.toString(),     color: 'var(--profit)'  },
          { label: 'Net P&L',    value: `${totalPL >= 0 ? '+' : ''}£${totalPL.toFixed(2)}`, color: totalPL >= 0 ? 'var(--profit)' : 'var(--danger)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 18px' }}>
            <div className="label" style={{ marginBottom: '5px' }}>{s.label}</div>
            <div style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 700, fontSize: '22px', color: s.color || 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div className="filter-strip" style={{ display: 'flex', gap: '5px', flexWrap: isMobile ? 'nowrap' : 'wrap' }}>
          {(['all', 'qualifying', 'free_bet'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)} style={{ padding: '5px 12px', borderRadius: '100px', fontSize: '12px', cursor: 'pointer', border: filterType === t ? '1px solid var(--accent)' : '1px solid var(--border)', background: filterType === t ? 'var(--accent-dim)' : 'transparent', color: filterType === t ? 'var(--accent)' : 'var(--muted)', fontWeight: filterType === t ? 600 : 400 }}>
              {t === 'all' ? 'All types' : t === 'qualifying' ? 'Qualifying' : 'Free Bet'}
            </button>
          ))}
          <div style={{ width: '1px', background: 'var(--border)', margin: '0 2px' }} />
          {(['all', 'pending', 'won', 'lost'] as const).map(o => (
            <button key={o} onClick={() => setFilterOutcome(o)} style={{ padding: '5px 12px', borderRadius: '100px', fontSize: '12px', cursor: 'pointer', border: filterOutcome === o ? '1px solid var(--border-strong)' : '1px solid var(--border)', background: filterOutcome === o ? 'var(--surface2)' : 'transparent', color: filterOutcome === o ? 'var(--text)' : 'var(--muted)', fontWeight: filterOutcome === o ? 600 : 400 }}>
              {o.charAt(0).toUpperCase() + o.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={exportCSV} disabled={bets.length === 0} className="btn-ghost" style={{ fontSize: '12px', padding: '7px 14px' }}>↓ CSV</button>
          <button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY) }} className="btn-primary">+ Log Bet</button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 700, fontSize: '16px', marginBottom: '16px' }}>
            {editId ? 'Edit Bet' : 'Log Bet'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '12px' }}>
            <FL label="Date"><input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input-field" /></FL>
            <FL label="Event / Match"><input value={form.event} onChange={e => set('event', e.target.value)} placeholder="e.g. Arsenal vs Chelsea" className="input-field" /></FL>
            <FL label="Linked Offer">
              <select value={form.offerId} onChange={e => set('offerId', e.target.value)} className="select-field">
                <option value="">None</option>
                {offers.map(o => <option key={o.id} value={o.id}>{o.bookmaker} — {o.offerName}</option>)}
              </select>
            </FL>
            <FL label="Type">
              <select value={form.type} onChange={e => set('type', e.target.value as BetRecord['type'])} className="select-field">
                <option value="qualifying">Qualifying</option><option value="free_bet">Free Bet</option>
              </select>
            </FL>
            <FL label="Back Stake (£)"><input type="number" value={form.backStake||''} onChange={e => set('backStake', parseFloat(e.target.value)||0)} step="0.01" className="input-field" style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 600, fontSize: '16px' }} /></FL>
            <FL label="Back Odds"><input type="number" value={form.backOdds||''} onChange={e => set('backOdds', parseFloat(e.target.value)||0)} step="0.01" className="input-field" style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 600, fontSize: '16px' }} /></FL>
            <FL label="Lay Stake (£)"><input type="number" value={form.layStake||''} onChange={e => set('layStake', parseFloat(e.target.value)||0)} step="0.01" className="input-field" style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 600, fontSize: '16px' }} /></FL>
            <FL label="Lay Odds"><input type="number" value={form.layOdds||''} onChange={e => set('layOdds', parseFloat(e.target.value)||0)} step="0.01" className="input-field" style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 600, fontSize: '16px' }} /></FL>
            <FL label="Commission (%)"><input type="number" value={form.commission||''} onChange={e => set('commission', parseFloat(e.target.value)||0)} step="0.5" className="input-field" /></FL>
            <FL label="Outcome">
              <select value={form.outcome} onChange={e => set('outcome', e.target.value as BetRecord['outcome'])} className="select-field">
                <option value="pending">Pending</option><option value="won">Back Won</option><option value="lost">Back Lost</option>
              </select>
            </FL>
          </div>

          {preview !== null && (
            <div style={{
              marginTop: '14px', padding: '14px 16px', borderRadius: 'var(--radius)',
              background: preview >= 0 ? 'var(--profit-dim)' : 'var(--danger-dim)',
              border: `1px solid ${preview >= 0 ? 'oklch(0.64 0.160 145 / 0.25)' : 'oklch(0.61 0.190 22 / 0.25)'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Calculated P&L</span>
              <span style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 800, fontSize: '24px', color: preview >= 0 ? 'var(--profit)' : 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>
                {preview >= 0 ? '+' : ''}£{preview.toFixed(2)}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowForm(false); setEditId(null) }} className="btn-ghost">Cancel</button>
            <button onClick={save} className="btn-primary">{editId ? 'Save Changes' : 'Log Bet'}</button>
          </div>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>No bets logged</div>
          <div style={{ fontSize: '12px' }}>Log each back and lay bet to track your real P&L</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {!isMobile && (
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 90px 200px 80px 110px 80px auto', gap: '10px', padding: '5px 14px', fontSize: '10px', color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <span>Date</span><span>Event</span><span>Type</span><span>Back / Lay</span><span>Comm</span><span>Outcome</span><span style={{ textAlign: 'right' }}>P&L</span><span />
            </div>
          )}
          {filtered.map(bet => {
            const linked = offers.find(o => o.id === bet.offerId)
            if (isMobile) {
              return (
                <div key={bet.id} className="row-hover" style={{
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px',
                }}>
                  {/* Row 1: event + type + actions */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bet.event}</div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '1px' }}>
                        {new Date(bet.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {linked ? ` · ${linked.bookmaker}` : ''}
                      </div>
                    </div>
                    <div style={{
                      fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', flexShrink: 0,
                      color: bet.type === 'qualifying' ? 'var(--warning)' : 'var(--accent)',
                      background: bet.type === 'qualifying' ? 'var(--warning-dim)' : 'var(--accent-dim)',
                    }}>
                      {bet.type === 'qualifying' ? 'Qual' : 'Free'}
                    </div>
                    <button onClick={() => edit(bet)} style={iconBtn}><EditIcon /></button>
                    <button onClick={() => del(bet.id)} style={{ ...iconBtn, color: 'var(--danger)' }}><TrashIcon /></button>
                  </div>
                  {/* Row 2: back/lay + outcome + P&L */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, fontSize: '11px', fontVariantNumeric: 'tabular-nums', fontFamily: "'Barlow Semi Condensed', sans-serif" }}>
                      <span style={{ color: 'var(--profit)' }}>£{bet.backStake.toFixed(2)}@{bet.backOdds}</span>
                      <span style={{ color: 'var(--subtle)', margin: '0 4px' }}>·</span>
                      <span style={{ color: 'var(--danger)' }}>£{bet.layStake.toFixed(2)}@{bet.layOdds}</span>
                    </div>
                    <select value={bet.outcome} onChange={e => setOutcome(bet.id, e.target.value as BetRecord['outcome'])} style={{
                      fontSize: '11px', fontWeight: 600, padding: '4px 8px', borderRadius: '5px', outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      color: bet.outcome === 'pending' ? 'var(--warning)' : bet.outcome === 'won' ? 'var(--profit)' : 'var(--danger)',
                      background: bet.outcome === 'pending' ? 'var(--warning-dim)' : bet.outcome === 'won' ? 'var(--profit-dim)' : 'var(--danger-dim)',
                      border: `1px solid ${bet.outcome === 'pending' ? 'oklch(0.73 0.150 75 / 0.3)' : bet.outcome === 'won' ? 'oklch(0.64 0.160 145 / 0.3)' : 'oklch(0.61 0.190 22 / 0.3)'}`,
                    }}>
                      <option value="pending">Pending</option>
                      <option value="won">Back Won</option>
                      <option value="lost">Back Lost</option>
                    </select>
                    <div style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 700, fontSize: '14px', fontVariantNumeric: 'tabular-nums', color: bet.outcome === 'pending' ? 'var(--subtle)' : bet.profit >= 0 ? 'var(--profit)' : 'var(--danger)', flexShrink: 0 }}>
                      {bet.outcome === 'pending' ? '—' : `${bet.profit >= 0 ? '+' : ''}£${bet.profit.toFixed(2)}`}
                    </div>
                  </div>
                </div>
              )
            }
            return (
              <div key={bet.id} className="row-hover" style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                padding: '11px 14px',
                display: 'grid', gridTemplateColumns: '80px 1fr 90px 200px 80px 110px 80px auto',
                gap: '10px', alignItems: 'center',
              }}>
                <div style={{ fontSize: '11px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {new Date(bet.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bet.event}</div>
                  {linked && <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{linked.bookmaker}</div>}
                </div>
                <div style={{
                  fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', textAlign: 'center',
                  color: bet.type === 'qualifying' ? 'var(--warning)' : 'var(--accent)',
                  background: bet.type === 'qualifying' ? 'var(--warning-dim)' : 'var(--accent-dim)',
                }}>
                  {bet.type === 'qualifying' ? 'Qual' : 'Free'}
                </div>
                <div style={{ fontSize: '11px', fontVariantNumeric: 'tabular-nums', fontFamily: "'Barlow Semi Condensed', sans-serif" }}>
                  <span style={{ color: 'var(--profit)' }}>£{bet.backStake.toFixed(2)} @ {bet.backOdds}</span>
                  <span style={{ color: 'var(--subtle)', margin: '0 5px' }}>·</span>
                  <span style={{ color: 'var(--danger)' }}>£{bet.layStake.toFixed(2)} @ {bet.layOdds}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{bet.commission}%</div>
                <select value={bet.outcome} onChange={e => setOutcome(bet.id, e.target.value as BetRecord['outcome'])} style={{
                  fontSize: '11px', fontWeight: 600, padding: '4px 8px', borderRadius: '5px', outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  color: bet.outcome === 'pending' ? 'var(--warning)' : bet.outcome === 'won' ? 'var(--profit)' : 'var(--danger)',
                  background: bet.outcome === 'pending' ? 'var(--warning-dim)' : bet.outcome === 'won' ? 'var(--profit-dim)' : 'var(--danger-dim)',
                  border: `1px solid ${bet.outcome === 'pending' ? 'oklch(0.73 0.150 75 / 0.3)' : bet.outcome === 'won' ? 'oklch(0.64 0.160 145 / 0.3)' : 'oklch(0.61 0.190 22 / 0.3)'}`,
                }}>
                  <option value="pending">Pending</option>
                  <option value="won">Back Won</option>
                  <option value="lost">Back Lost</option>
                </select>
                <div style={{ textAlign: 'right', fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 700, fontSize: '14px', fontVariantNumeric: 'tabular-nums', color: bet.outcome === 'pending' ? 'var(--subtle)' : bet.profit >= 0 ? 'var(--profit)' : 'var(--danger)' }}>
                  {bet.outcome === 'pending' ? '—' : `${bet.profit >= 0 ? '+' : ''}£${bet.profit.toFixed(2)}`}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => edit(bet)}       style={iconBtn}><EditIcon /></button>
                  <button onClick={() => del(bet.id)} style={{ ...iconBtn, color: 'var(--danger)' }}><TrashIcon /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FL({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: '5px' }}>{label}</div>
      {children}
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  width: '30px', height: '30px', borderRadius: '6px', cursor: 'pointer',
  border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  transition: 'border-color 0.12s, color 0.12s',
}

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  )
}
