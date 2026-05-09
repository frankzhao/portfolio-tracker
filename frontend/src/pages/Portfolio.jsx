import { useEffect, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Tooltip, Legend, Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { getDashboard, getAssets } from '../api/client'
import Pill from '../components/Pill'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const TYPE_COLORS = {
  cash: '#60a5fa', equities: '#4ade80', crypto: '#c084fc',
  property: '#fbbf24', bonds: '#67e8f9', other: '#8b91a8',
}

function fmtAUD(n) {
  if (n == null) return '—'
  return '$' + Math.round(Number(n)).toLocaleString('en-AU')
}
function fmtDelta(n) {
  if (n == null) return '—'
  const v = Number(n)
  return (v >= 0 ? '+$' : '-$') + Math.abs(Math.round(v)).toLocaleString('en-AU')
}
function fmtPct(n) {
  if (n == null) return '—'
  const v = Number(n)
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'
}
function cls(n) {
  if (n == null) return ''
  return Number(n) >= 0 ? 'up' : 'down'
}

export default function Portfolio() {
  const [data, setData] = useState(null)
  const [assets, setAssets] = useState([])
  const [selected, setSelected] = useState(null) // asset name, null = all

  useEffect(() => {
    Promise.all([getDashboard(), getAssets()])
      .then(([d, a]) => { setData(d); setAssets(a) })
  }, [])

  if (!data) return <div className="loading">Loading…</div>

  const { history } = data
  const latest = history[history.length - 1]
  const prev   = history[history.length - 2]

  const labels = history.map(h =>
    new Date(h.period + 'T00:00:00').toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })
  )

  // Summary rows — one per asset
  const rows = assets.map(a => {
    const current  = latest?.breakdown[a.name] ?? null
    const previous = prev?.breakdown[a.name] ?? null
    const firstSnap = history.find(h => h.breakdown[a.name] != null)
    const first    = firstSnap?.breakdown[a.name] ?? null

    const momDelta  = (current != null && previous != null) ? Number(current) - Number(previous) : null
    const momPct    = (momDelta != null && Number(previous) > 0) ? momDelta / Number(previous) * 100 : null
    const allTimePct = (current != null && first != null && Number(first) > 0)
      ? (Number(current) - Number(first)) / Number(first) * 100 : null

    return { ...a, current, momDelta, momPct, allTimePct }
  })

  // Chart — filtered to selected asset or all
  const visibleAssets = selected ? assets.filter(a => a.name === selected) : assets
  const chartData = {
    labels,
    datasets: visibleAssets.map(a => {
      const color = a.color || TYPE_COLORS[a.type] || '#8b91a8'
      return {
        label: a.name,
        data: history.map(h => h.breakdown[a.name] != null ? Number(h.breakdown[a.name]) : null),
        borderColor: color,
        backgroundColor: color + '55',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 5,
        spanGaps: true,
      }
    }),
  }

  return (
    <div>
      <div className="page-header">
        <h1>Portfolio</h1>
        <p>Per-asset valuations and history. Click a row to isolate its chart.</p>
      </div>

      <div className="table-wrap" style={{ marginBottom: 24 }}>
        <table>
          <thead>
            <tr>
              <th>Asset</th>
              <th>Type</th>
              <th className="td-right">Current (AUD)</th>
              <th className="td-right">MoM Δ</th>
              <th className="td-right">MoM %</th>
              <th className="td-right">All-time %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr
                key={r.id}
                onClick={() => setSelected(selected === r.name ? null : r.name)}
                style={{
                  cursor: 'pointer',
                  background: selected === r.name ? 'rgba(108,143,255,0.08)' : undefined,
                }}
              >
                <td style={{ fontWeight: 500 }}>
                  <span style={{
                    display: 'inline-block', width: 10, height: 10,
                    borderRadius: '50%', background: r.color || '#888', marginRight: 8,
                  }} />
                  {r.name}
                </td>
                <td><Pill type={r.type} /></td>
                <td className="td-right td-mono">{fmtAUD(r.current)}</td>
                <td className={`td-right td-mono ${cls(r.momDelta)}`}>{fmtDelta(r.momDelta)}</td>
                <td className={`td-right td-mono ${cls(r.momPct)}`}>{fmtPct(r.momPct)}</td>
                <td className={`td-right td-mono ${cls(r.allTimePct)}`}>{fmtPct(r.allTimePct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="chart-card">
        <div className="chart-title">
          {selected ? `${selected} — Value History (AUD)` : 'All Assets — Value History (AUD)'}
        </div>
        <Line
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: {
                display: !selected,
                labels: { color: '#8b91a8', font: { size: 11 } },
              },
              tooltip: {
                callbacks: {
                  label: ctx => ` ${ctx.dataset.label}: ${fmtAUD(ctx.raw)}`,
                },
              },
            },
            scales: {
              x: {
                ticks: { color: '#8b91a8', maxTicksLimit: 12, font: { size: 11 } },
                grid: { color: '#2e3347' },
              },
              y: {
                stacked: true,
                ticks: { color: '#8b91a8', callback: v => '$' + (v / 1000).toFixed(0) + 'k', font: { size: 11 } },
                grid: { color: '#2e3347' },
              },
            },
          }}
        />
      </div>
    </div>
  )
}
