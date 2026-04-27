'use client'

import { useState } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import type { Offer } from './Dashboard'

const BOOKMAKERS = ['Bet365', 'Unibet', 'William Hill', 'Betway', 'Paddy Power', 'Coral', 'Ladbrokes', 'Sky Bet', 'BetVictor', 'Other']

const STATUS: Record<Offer['status'], { label: string; color: string; dim: string }> = {
  unused:     { label: 'Unused',     color: 'var(--muted)',   dim: 'var(--surface3)' },
  qualifying: { label: 'Qualifying', color: 'var(--warning)', dim: 'var(--warning-dim)' },
  free_bet:   { label: 'Free Bet',   color: 'var(--accent)',  dim: 'var(--accent-dim)' },
  complete:   { label: 'Complete',   color: 'var(--profit)',  dim: 'var(--profit-dim)' },
  failed:     { label: 'Failed',     color: 'var(--danger)',  dim: 'var(--danger-dim)' },
}

const EMPTY: Omit<Offer, 'id' | 'createdAt'> = {
  bookmaker: 'Bet365', offerName: '', type: 'signup',
  maxStake: 0, minOdds: 0, status: 'unused',
  qualifyingLoss: 0, freeBetValue: 0, freeBetAmount: 0, profit: 0, notes: '',
}

export default function OfferTracker({ offers, onUpdate }: { offers: Offer[]; onUpdate: (o: Offer[]) => void }) {
  const isMobile = useIsMobile()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(EMPTY)
  const [editId, setEditId]     = useState<string | null>(null)
  const [filter, setFilter]     = useState<Offer['status'] | 'all'>('all')

  const set = <K extends keyof typeof EMPTY>(k: K, v: typeof EMPTY[K]) => setForm(f => ({ ...f, [k]: v }))

  const save = () => {
    if (!form.offerName) return
    if (editId) {
      onUpdate(offers.map(o => o.id === editId ? { ...form, id: editId, createdAt: o.createdAt } : o))
      setEditId(null)
    } else {
      onUpdate([...offers, { ...form, id: Date.now().toString(), createdAt: new Date().toISOString() }])
    }
    setForm(EMPTY); setShowForm(false)
  }

  const edit = (o: Offer) => { setForm({ ...o }); setEditId(o.id); setShowForm(true) }
  const del  = (id: string) => { if (confirm('Delete this offer?')) onUpdate(offers.filter(o => o.id !== id)) }
  const setStatus = (id: string, status: Offer['status']) => onUpdate(offers.map(o => o.id === id ? { ...o, status } : o))

  const exportCSV = () => {
    const h = ['Bookmaker','Offer Name','Type','Max Stake','Min Odds','Free Bet Amount','Qualifying Loss','Free Bet Value','Profit','Status','Notes','Created']
    const r = offers.map(o => [o.bookmaker, `"${o.offerName}"`, o.type, o.maxStake, o.minOdds, o.freeBetAmount, o.qualifyingLoss, o.freeBetValue, o.profit, o.status, `"${o.notes}"`, o.createdAt.split('T')[0]].join(','))
    const blob = new Blob([[h.join(','), ...r].join('\n')], { type: 'text/csv' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `matchlock-offers-${new Date().toISOString().split('T')[0]}.csv` })
    a.click(); URL.revokeObjectURL(a.href)
  }

  const filtered = filter === 'all' ? offers : offers.filter(o => o.status === filter)
  const totalQL  = offers.reduce((s, o) => s + (o.qualifyingLoss || 0), 0)
  const totalFBV = offers.reduce((s, o) => s + (o.freeBetValue || 0), 0)
  const totalP   = offers.reduce((s, o) => s + (o.profit || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Stats */}
      <div className="stats-4col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {[
          { label: 'Total Offers',    value: offers.length.toString(),                                        color: undefined },
          { label: 'Qualifying Loss', value: `-£${Math.abs(totalQL).toFixed(2)}`,                             color: 'var(--danger)' },
          { label: 'Free Bet Value',  value: `£${totalFBV.toFixed(2)}`,                                       color: 'var(--accent)' },
          { label: 'Net Profit',      value: `${totalP >= 0 ? '+' : ''}£${totalP.toFixed(2)}`,                color: totalP >= 0 ? 'var(--profit)' : 'var(--danger)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 18px' }}>
            <div className="label" style={{ marginBottom: '5px' }}>{s.label}</div>
            <div style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 700, fontSize: '22px', color: s.color || 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div className="filter-strip" style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {(['all', 'unused', 'qualifying', 'free_bet', 'complete', 'failed'] as const).map(s => {
            const active = filter === s
            const sc = s !== 'all' ? STATUS[s] : null
            return (
              <button key={s} onClick={() => setFilter(s)} style={{
                padding: '5px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: active ? 600 : 400,
                cursor: 'pointer', transition: 'all 0.12s',
                border: active && sc ? `1px solid ${sc.color}` : '1px solid var(--border)',
                background: active && sc ? sc.dim : active ? 'var(--surface2)' : 'transparent',
                color: active && sc ? sc.color : active ? 'var(--text)' : 'var(--muted)',
              }}>{s === 'all' ? 'All' : STATUS[s].label}</button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={exportCSV} disabled={offers.length === 0} className="btn-ghost" style={{ fontSize: '12px', padding: '7px 14px' }}>
            ↓ Export CSV
          </button>
          <button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY) }} className="btn-primary">
            + Add Offer
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 700, fontSize: '16px', marginBottom: '16px' }}>
            {editId ? 'Edit Offer' : 'New Offer'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '12px' }}>
            <FL label="Bookmaker"><select value={form.bookmaker} onChange={e => set('bookmaker', e.target.value)} className="select-field">{BOOKMAKERS.map(b => <option key={b}>{b}</option>)}</select></FL>
            <FL label="Offer Name"><input value={form.offerName} onChange={e => set('offerName', e.target.value)} placeholder="e.g. Bet £10 Get £30" className="input-field" /></FL>
            <FL label="Type">
              <select value={form.type} onChange={e => set('type', e.target.value as Offer['type'])} className="select-field">
                <option value="signup">Sign-up</option><option value="reload">Reload</option><option value="acca">Acca</option>
              </select>
            </FL>
            <FL label="Max Stake (£)"><input type="number" value={form.maxStake || ''} onChange={e => set('maxStake', parseFloat(e.target.value)||0)} className="input-field" /></FL>
            <FL label="Min Odds"><input type="number" value={form.minOdds || ''} onChange={e => set('minOdds', parseFloat(e.target.value)||0)} step="0.01" className="input-field" /></FL>
            <FL label="Free Bet Amount (£)"><input type="number" value={form.freeBetAmount || ''} onChange={e => set('freeBetAmount', parseFloat(e.target.value)||0)} className="input-field" /></FL>
            <FL label="Qualifying Loss (£)"><input type="number" value={form.qualifyingLoss || ''} onChange={e => set('qualifyingLoss', parseFloat(e.target.value)||0)} step="0.01" className="input-field" /></FL>
            <FL label="Cash Extracted (£)"><input type="number" value={form.freeBetValue || ''} onChange={e => set('freeBetValue', parseFloat(e.target.value)||0)} step="0.01" className="input-field" /></FL>
            <FL label="Net Profit (£)"><input type="number" value={form.profit || ''} onChange={e => set('profit', parseFloat(e.target.value)||0)} step="0.01" className="input-field" /></FL>
            <FL label="Status">
              <select value={form.status} onChange={e => set('status', e.target.value as Offer['status'])} className="select-field">
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </FL>
            <FL label="Notes" style={{ gridColumn: 'span 2' }}><input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any notes…" className="input-field" /></FL>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowForm(false); setEditId(null) }} className="btn-ghost">Cancel</button>
            <button onClick={save} className="btn-primary">{editId ? 'Save Changes' : 'Add Offer'}</button>
          </div>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          padding: '60px', textAlign: 'center', color: 'var(--muted)',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>No offers {filter !== 'all' ? `with status "${STATUS[filter as Offer['status']].label}"` : 'yet'}</div>
          <div style={{ fontSize: '12px' }}>Click + Add Offer to get started</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {/* Header row — desktop only */}
          {!isMobile && (
            <div style={{
              display: 'grid', gridTemplateColumns: '180px 1fr 80px 90px 90px 90px 130px auto',
              gap: '12px', padding: '6px 14px',
              fontSize: '10px', color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              <span>Bookmaker</span><span>Offer</span><span>Type</span>
              <span style={{ textAlign: 'right' }}>Free Bet</span>
              <span style={{ textAlign: 'right' }}>Qual. Loss</span>
              <span style={{ textAlign: 'right' }}>Profit</span>
              <span>Status</span><span />
            </div>
          )}

          {filtered.map(offer => {
            const sc = STATUS[offer.status]
            if (isMobile) {
              return (
                <div key={offer.id} className="row-hover" style={{
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px',
                }}>
                  {/* Row 1: bookmaker + status + actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{offer.bookmaker}</div>
                      {offer.offerName && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{offer.offerName}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <select value={offer.status} onChange={e => setStatus(offer.id, e.target.value as Offer['status'])} style={{
                        background: sc.dim, color: sc.color, border: `1px solid ${sc.color}33`,
                        borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontWeight: 600,
                        outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                        {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                      <button onClick={() => edit(offer)} style={{ ...iconBtn }}><EditIcon /></button>
                      <button onClick={() => del(offer.id)} style={{ ...iconBtn, color: 'var(--danger)' }}><TrashIcon /></button>
                    </div>
                  </div>
                  {/* Row 2: key numbers */}
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <MobileNum label="Free Bet" value={`£${offer.freeBetAmount.toFixed(2)}`} color="var(--accent)" />
                    <MobileNum label="Qual. Loss" value={`-£${Math.abs(offer.qualifyingLoss).toFixed(2)}`} color="var(--danger)" />
                    <MobileNum label="Profit" value={offer.profit !== 0 ? `${offer.profit >= 0 ? '+' : ''}£${offer.profit.toFixed(2)}` : '—'} color={offer.profit >= 0 ? 'var(--profit)' : 'var(--danger)'} />
                  </div>
                </div>
              )
            }
            return (
              <div key={offer.id} className="row-hover" style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                padding: '12px 14px',
                display: 'grid', gridTemplateColumns: '180px 1fr 80px 90px 90px 90px 130px auto',
                gap: '12px', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>{offer.bookmaker}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>
                    Min {offer.minOdds}+ · max £{offer.maxStake}
                  </div>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{offer.offerName || '—'}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'capitalize' }}>{offer.type}</div>
                <div style={{ textAlign: 'right', fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 600, fontSize: '14px', color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                  £{offer.freeBetAmount.toFixed(2)}
                </div>
                <div style={{ textAlign: 'right', fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 600, fontSize: '14px', color: 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>
                  -£{Math.abs(offer.qualifyingLoss).toFixed(2)}
                </div>
                <div style={{ textAlign: 'right', fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 700, fontSize: '14px', color: offer.profit >= 0 ? 'var(--profit)' : 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>
                  {offer.profit !== 0 ? `${offer.profit >= 0 ? '+' : ''}£${offer.profit.toFixed(2)}` : '—'}
                </div>
                <select value={offer.status} onChange={e => setStatus(offer.id, e.target.value as Offer['status'])} style={{
                  background: sc.dim, color: sc.color, border: `1px solid ${sc.color}33`,
                  borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontWeight: 600,
                  outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => edit(offer)} style={{ ...iconBtn }}><EditIcon /></button>
                  <button onClick={() => del(offer.id)} style={{ ...iconBtn, color: 'var(--danger)' }}><TrashIcon /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FL({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
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

function MobileNum({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '1px' }}>{label}</div>
      <div style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 700, fontSize: '14px', color: color || 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}
