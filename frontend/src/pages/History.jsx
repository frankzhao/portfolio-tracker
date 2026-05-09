import { useEffect, useState } from 'react'
import { getDashboard, getAssets, getSnapshots } from '../api/client'

function fmt(n, dec = 0) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('en-AU', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function fmtPct(n) {
  if (n == null) return '—'
  const v = Number(n)
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}
function pctCls(n) {
  if (n == null) return ''
  return Number(n) >= 0 ? 'up' : 'down'
}

// ── Snapshot history subtab ───────────────────────────────────────────────────

function SnapshotHistory({ data }) {
  const [yearFilter, setYearFilter] = useState('')

  const years = [...new Set(data.history.map(h => new Date(h.period + 'T00:00:00').getFullYear()))].sort((a, b) => b - a)
  const filtered = yearFilter
    ? data.history.filter(h => new Date(h.period + 'T00:00:00').getFullYear() == yearFilter)
    : data.history

  function exportCSV() {
    const rows = [['Period', 'Net Worth AUD', 'MoM Growth %', 'Income', 'Expenses', 'Net Flow']]
    data.history.forEach(h => rows.push([h.period, h.total_aud, h.growth_pct ?? '', h.income, h.expenses, h.net_flow]))
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = 'portfolio_history.csv'
    a.click()
  }

  return (
    <>
      <div className="toolbar">
        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
          <option value="">All years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={exportCSV}>Export CSV</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th className="td-right">Net Worth</th>
              <th className="td-right">MoM Growth</th>
              <th className="td-right">Income</th>
              <th className="td-right">Expenses</th>
              <th className="td-right">Net Flow</th>
            </tr>
          </thead>
          <tbody>
            {[...filtered].reverse().map(h => (
              <tr key={h.period}>
                <td>{new Date(h.period + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                <td className="td-right td-mono">{fmt(h.total_aud)}</td>
                <td className={`td-right td-mono ${pctCls(h.growth_pct)}`}>{fmtPct(h.growth_pct)}</td>
                <td className="td-right td-mono up">{fmt(h.income)}</td>
                <td className="td-right td-mono down">{h.expenses > 0 ? '-' + fmt(h.expenses) : '—'}</td>
                <td className={`td-right td-mono ${pctCls(h.net_flow)}`}>{fmt(h.net_flow)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty">No snapshots found.</div>}
      </div>
    </>
  )
}

// ── By asset subtab ───────────────────────────────────────────────────────────

function AssetHistory({ assets }) {
  const [selectedId, setSelectedId] = useState('')
  const [snaps, setSnaps] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedId) { setSnaps([]); return }
    setLoading(true)
    getSnapshots({ asset_id: selectedId })
      .then(rows => setSnaps([...rows].sort((a, b) => b.period.localeCompare(a.period))))
      .finally(() => setLoading(false))
  }, [selectedId])

  const selected = assets.find(a => a.id === Number(selectedId))
  const isNonAud = selected && selected.currency !== 'AUD'

  return (
    <>
      <div className="toolbar">
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}>
          <option value="">Select asset…</option>
          {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {loading && <div className="loading">Loading…</div>}

      {!loading && selectedId && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Period</th>
                {isNonAud && <th className="td-right">Value ({selected.currency})</th>}
                <th className="td-right">Value (AUD)</th>
                {isNonAud && <th className="td-right">FX Rate</th>}
                <th className="td-right">MoM Change</th>
                <th className="td-right">MoM %</th>
              </tr>
            </thead>
            <tbody>
              {snaps.map((s, i) => {
                const prev = snaps[i + 1]
                const delta = prev ? Number(s.value_aud) - Number(prev.value_aud) : null
                return (
                  <tr key={s.id}>
                    <td>{new Date(s.period + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    {isNonAud && <td className="td-right td-mono">{fmt(s.value_native, 2)}</td>}
                    <td className="td-right td-mono">{fmt(s.value_aud)}</td>
                    {isNonAud && <td className="td-right td-mono">{s.fx_rate ? Number(s.fx_rate).toFixed(4) : '—'}</td>}
                    <td className={`td-right td-mono ${delta == null ? '' : delta >= 0 ? 'up' : 'down'}`}>
                      {delta == null ? '—' : (delta >= 0 ? '+' : '') + fmt(delta)}
                    </td>
                    <td className={`td-right td-mono ${delta == null ? '' : delta >= 0 ? 'up' : 'down'}`}>
                      {delta == null || !prev ? '—' : (delta >= 0 ? '+' : '') + (delta / Number(prev.value_aud) * 100).toFixed(2) + '%'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {snaps.length === 0 && <div className="empty">No snapshots for this asset.</div>}
        </div>
      )}

      {!selectedId && <div className="empty">Select an asset to view its history.</div>}
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function History() {
  const [data, setData] = useState(null)
  const [assets, setAssets] = useState([])
  const [tab, setTab] = useState('snapshots')

  useEffect(() => {
    getDashboard().then(setData)
    getAssets().then(setAssets)
  }, [])

  if (!data) return <div className="loading">Loading…</div>

  function exportExcel() {
    const a = document.createElement('a')
    a.href = '/api/export/xlsx'
    a.download = 'portfolio_export.xlsx'
    a.click()
  }

  return (
    <div>
      <div className="page-header">
        <h1>History</h1>
        <p>{data.history.length} snapshots recorded.</p>
        <button className="btn btn-ghost btn-sm" onClick={exportExcel}>Export Excel</button>
      </div>

      <div className="subtabs">
        <button className={`subtab ${tab === 'snapshots' ? 'active' : ''}`} onClick={() => setTab('snapshots')}>
          Snapshots
        </button>
        <button className={`subtab ${tab === 'asset' ? 'active' : ''}`} onClick={() => setTab('asset')}>
          By Asset
        </button>
      </div>

      {tab === 'snapshots' && <SnapshotHistory data={data} />}
      {tab === 'asset'     && <AssetHistory assets={assets} />}
    </div>
  )
}
