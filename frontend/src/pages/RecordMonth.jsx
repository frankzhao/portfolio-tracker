import { useEffect, useState } from 'react'
import { getAssets, upsertSnapshot, upsertCashFlow, getSnapshots, getCashFlows, getFxRates, deriveCashflow } from '../api/client'
import { useToast } from '../components/Toast'

export default function RecordMonth() {
  const toast = useToast()
  const [assets, setAssets] = useState([])
  const [saving, setSaving] = useState(false)

  const now = new Date()
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const [period, setPeriod] = useState(defaultPeriod)
  const [income, setIncome] = useState('')
  const [expenses, setExpenses] = useState('')
  const [cfNotes, setCfNotes] = useState('')
  // Per-currency FX rates: { USD: '1.55', EUR: '1.63', GBP: '1.95' }
  const [fxRates, setFxRates] = useState({})
  const [fxLoading, setFxLoading] = useState(false)
  const [values, setValues] = useState({})   // { [assetId]: { native, aud, notes } }

  useEffect(() => {
    getAssets().then(setAssets)
  }, [])

  // Fetch monthly average FX rates when period changes
  useEffect(() => {
    if (!period) return
    setFxLoading(true)
    getFxRates(period)
      .then(rates => setFxRates(prev => {
        // Only overwrite rates that haven't been manually edited
        const next = { ...prev }
        for (const [ccy, rate] of Object.entries(rates)) {
          next[ccy] = String(rate)
        }
        return next
      }))
      .catch(() => { /* silently ignore — user can enter manually */ })
      .finally(() => setFxLoading(false))
  }, [period])

  // When period changes, load existing snapshot values to pre-fill
  useEffect(() => {
    if (!period || !assets.length) return
    Promise.all([
      getSnapshots({ from_period: period, to_period: period }),
      getCashFlows({ from_period: period, to_period: period }),
    ]).then(([snaps, cfs]) => {
      const v = {}
      snaps.forEach(s => {
        v[s.asset_id] = {
          native: String(s.value_native),
          aud: s.asset.currency !== 'AUD' ? String(s.value_aud) : '',
          notes: s.notes || '',
        }
      })
      setValues(v)
      if (cfs.length) {
        setIncome(String(cfs[0].income))
        setExpenses(String(cfs[0].expenses))
        setCfNotes(cfs[0].notes || '')
      }
    })
  }, [period, assets])

  const setVal = (id, field, v) =>
    setValues(prev => ({ ...prev, [id]: { ...prev[id], [field]: v } }))

  const setFxRate = (ccy, v) =>
    setFxRates(prev => ({ ...prev, [ccy]: v }))

  // Currencies actually used by non-AUD assets
  const nonAudCurrencies = [...new Set(assets.filter(a => a.currency !== 'AUD').map(a => a.currency))]

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await upsertCashFlow({
        period,
        income: parseFloat(income) || 0,
        expenses: parseFloat(expenses) || 0,
        notes: cfNotes || null,
      })

      for (const a of assets) {
        const v = values[a.id]
        if (!v?.native) continue
        const native = parseFloat(v.native)
        if (isNaN(native)) continue

        let aud
        if (a.currency !== 'AUD') {
          const fx = fxRates[a.currency] ? parseFloat(fxRates[a.currency]) : null
          aud = v.aud ? parseFloat(v.aud) : (fx ? native * fx : native)
        } else {
          aud = native
        }

        await upsertSnapshot({
          asset_id: a.id,
          period,
          value_native: native,
          fx_rate: a.currency !== 'AUD' && fxRates[a.currency] ? parseFloat(fxRates[a.currency]) : null,
          value_aud: aud,
          notes: v.notes || null,
        })
      }
      await deriveCashflow(period)
      toast('Snapshot saved ✓')
    } catch (err) {
      toast('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Record Month</h1>
        <p>Snapshot asset values and cash flows for any date. Saving the same date again will overwrite.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card section-gap">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Period &amp; Cash Flows</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={period} onChange={e => setPeriod(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Total Income (AUD)</label>
              <input type="number" step="0.01" placeholder="0.00" value={income} onChange={e => setIncome(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Total Expenses (AUD)</label>
              <input type="number" step="0.01" placeholder="0.00" value={expenses} onChange={e => setExpenses(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <input type="text" placeholder="Optional" value={cfNotes} onChange={e => setCfNotes(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card section-gap">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 600 }}>Asset Values</div>
            {nonAudCurrencies.length > 0 && (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                {fxLoading && (
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>Fetching rates…</span>
                )}
                {nonAudCurrencies.map(ccy => (
                  <div key={ccy} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <label style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {ccy}/AUD
                    </label>
                    <input
                      type="number" step="0.0001" placeholder="e.g. 1.55"
                      value={fxRates[ccy] || ''}
                      onChange={e => setFxRate(ccy, e.target.value)}
                      style={{ width: 110 }}
                    />
                  </div>
                ))}
                {!fxLoading && nonAudCurrencies.some(c => fxRates[c]) && (
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>monthly avg</span>
                )}
              </div>
            )}
          </div>

          {assets.length === 0 && (
            <p style={{ color: 'var(--muted)' }}>No assets configured — go to Assets to add some.</p>
          )}

          {assets.map(a => {
            const v = values[a.id] || {}
            const isNonAud = a.currency !== 'AUD'
            const fx = isNonAud && fxRates[a.currency] ? parseFloat(fxRates[a.currency]) : null
            const computedAud = fx && v.native && !isNaN(parseFloat(v.native))
              ? (parseFloat(v.native) * fx).toFixed(2)
              : null
            return (
              <div key={a.id} className="asset-row">
                <div>
                  <div className="asset-name">{a.name}</div>
                  <div className="asset-meta">
                    <span className={`pill pill-${a.type}`}>{a.type}</span>
                    {isNonAud && <span className="badge">{a.currency}</span>}
                  </div>
                </div>
                <div className="form-group">
                  <label>Value ({a.currency})</label>
                  <input
                    type="number" step="0.01" placeholder="0.00"
                    value={v.native || ''}
                    onChange={e => setVal(a.id, 'native', e.target.value)}
                  />
                </div>
                {isNonAud ? (
                  <div className="form-group">
                    <label>Value AUD (override)</label>
                    <input
                      type="number" step="0.01"
                      placeholder={computedAud ? `≈ ${computedAud}` : 'auto from FX'}
                      value={v.aud || ''}
                      onChange={e => setVal(a.id, 'aud', e.target.value)}
                    />
                  </div>
                ) : <div />}
                <div className="form-group">
                  <label>Notes</label>
                  <input
                    type="text" placeholder="—"
                    value={v.notes || ''}
                    onChange={e => setVal(a.id, 'notes', e.target.value)}
                  />
                </div>
              </div>
            )
          })}
        </div>

        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save Snapshot'}
        </button>
      </form>
    </div>
  )
}
