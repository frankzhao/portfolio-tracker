import { useEffect, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Tooltip, Legend, Filler,
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { getDashboard, getAssets } from '../api/client'

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Tooltip, Legend, Filler,
)

const TYPE_COLORS = {
  cash:     '#4e8ef7',  // blue
  equities: '#2ec27e',  // green
  crypto:   '#f5a623',  // amber
  property: '#e05c5c',  // red
  bonds:    '#b07fd4',  // violet
  other:    '#8b91a8',  // grey
}

function fmt(n, dec = 2) {
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

const CHART_OPTS_BASE = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: { legend: { display: false } },
}

function darkScales(yFmt) {
  return {
    x: {
      ticks: { color: '#8b91a8', maxTicksLimit: 12, font: { size: 11 } },
      grid: { color: '#2e3347' },
    },
    y: {
      ticks: { color: '#8b91a8', callback: yFmt, font: { size: 11 } },
      grid: { color: '#2e3347' },
    },
  }
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [assets, setAssets] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([getDashboard(), getAssets()])
      .then(([d, a]) => { setData(d); setAssets(a) })
      .catch(e => setError(e.message))
  }, [])

  if (error) return (
    <div>
      <div className="page-header"><h1>Dashboard</h1></div>
      <div className="card" style={{ color: 'var(--red)' }}>
        API error: {error} — is the backend running on :8000?
      </div>
    </div>
  )

  if (!data) return <div className="loading">Loading…</div>

  const { history, latest_total, latest_period, growth_3m_pct, growth_6m_pct, ytd_growth_pct, all_time_growth_pct } = data
  const latest = history[history.length - 1]

  const periodLabel = latest_period
    ? new Date(latest_period + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

  const labels = history.map(h =>
    new Date(h.period + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' })
  )
  const totals = history.map(h => Number(h.total_aud))

  // Growth chart
  const growthData = {
    labels,
    datasets: [{
      label: 'Net Worth (AUD)',
      data: totals,
      borderColor: '#6c8fff',
      backgroundColor: 'rgba(108,143,255,0.10)',
      fill: true,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 5,
    }],
  }

  // Donut — latest breakdown by type
  const typeGroups = {}
  if (latest) {
    for (const [name, val] of Object.entries(latest.breakdown)) {
      const asset = assets.find(a => a.name === name)
      const type = asset?.type || 'other'
      typeGroups[type] = (typeGroups[type] || 0) + Number(val)
    }
  }
  const donutData = {
    labels: Object.keys(typeGroups),
    datasets: [{
      data: Object.values(typeGroups),
      backgroundColor: Object.keys(typeGroups).map(t => TYPE_COLORS[t] || '#8b91a8'),
      borderWidth: 0,
      hoverOffset: 6,
    }],
  }

  // Cash flow — last 24 months
  const cfSlice = history.slice(-24)
  const cfLabels = cfSlice.map(h =>
    new Date(h.period + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' })
  )
  const cashflowData = {
    labels: cfLabels,
    datasets: [
      { label: 'Income', data: cfSlice.map(h => Number(h.income)), backgroundColor: 'rgba(74,222,128,0.7)' },
      { label: 'Expenses', data: cfSlice.map(h => -Number(h.expenses)), backgroundColor: 'rgba(248,113,113,0.7)' },
    ],
  }

  // MoM growth %
  const gpSlice = history.slice(-24)
  const growthPctData = {
    labels: gpSlice.map(h =>
      new Date(h.period + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' })
    ),
    datasets: [{
      label: 'MoM %',
      data: gpSlice.map(h => h.growth_pct != null ? Number(h.growth_pct) : null),
      backgroundColor: gpSlice.map(h => Number(h.growth_pct) >= 0 ? 'rgba(74,222,128,0.7)' : 'rgba(248,113,113,0.7)'),
    }],
  }

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>As of {periodLabel}</p>
      </div>

      <div className="cards-grid">
        <div className="card">
          <div className="stat-label">Net Worth</div>
          <div className="stat-value">{fmt(latest_total, 0)}</div>
          <div className="stat-sub">Total AUD</div>
        </div>
        <div className="card">
          <div className="stat-label">3-Month Growth</div>
          <div className={`stat-value ${pctCls(growth_3m_pct)}`}>{fmtPct(growth_3m_pct)}</div>
          <div className="stat-sub">Last 3 months</div>
        </div>
        <div className="card">
          <div className="stat-label">6-Month Growth</div>
          <div className={`stat-value ${pctCls(growth_6m_pct)}`}>{fmtPct(growth_6m_pct)}</div>
          <div className="stat-sub">Last 6 months</div>
        </div>
        <div className="card">
          <div className="stat-label">YTD Growth</div>
          <div className={`stat-value ${pctCls(ytd_growth_pct)}`}>{fmtPct(ytd_growth_pct)}</div>
          <div className="stat-sub">Year to date</div>
        </div>
        <div className="card">
          <div className="stat-label">All-Time Growth</div>
          <div className={`stat-value ${pctCls(all_time_growth_pct)}`}>{fmtPct(all_time_growth_pct)}</div>
          <div className="stat-sub">Since first record</div>
        </div>
        <div className="card">
          <div className="stat-label">Last Month Net Flow</div>
          <div className={`stat-value ${pctCls(latest?.net_flow)}`}>{fmt(latest?.net_flow, 0)}</div>
          <div className="stat-sub">
            Income {fmt(latest?.income, 0)} · Exp {fmt(latest?.expenses, 0)}
          </div>
        </div>
      </div>

      <div className="charts-grid-2-1">
        <div className="chart-card">
          <div className="chart-title">Portfolio Growth (AUD)</div>
          <Line
            data={growthData}
            options={{
              ...CHART_OPTS_BASE,
              scales: darkScales(v => '$' + (v / 1000).toFixed(0) + 'k'),
            }}
          />
        </div>
        <div className="chart-card">
          <div className="chart-title">Asset Distribution</div>
          <Doughnut
            data={donutData}
            options={{
              responsive: true,
              maintainAspectRatio: true,
              cutout: '65%',
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: { color: '#8b91a8', padding: 12, font: { size: 11 } },
                },
                tooltip: {
                  callbacks: {
                    label: ctx => {
                      const total = Object.values(typeGroups).reduce((a, b) => a + b, 0)
                      return ` ${fmt(ctx.raw, 0)} (${(ctx.raw / total * 100).toFixed(1)}%)`
                    },
                  },
                },
              },
            }}
          />
        </div>
      </div>

      <div className="charts-grid-2">
        <div className="chart-card">
          <div className="chart-title">Monthly Cash Flow (last 24)</div>
          <Bar
            data={cashflowData}
            options={{
              ...CHART_OPTS_BASE,
              plugins: { legend: { display: true, labels: { color: '#8b91a8', font: { size: 11 } } } },
              scales: {
                x: { stacked: true, ticks: { color: '#8b91a8', maxTicksLimit: 10, font:{size:10} }, grid: { color: '#2e3347' } },
                y: { stacked: true, ticks: { color: '#8b91a8', callback: v => '$' + (v / 1000).toFixed(0) + 'k', font:{size:10} }, grid: { color: '#2e3347' } },
              },
            }}
          />
        </div>
        <div className="chart-card">
          <div className="chart-title">MoM Growth % (last 24)</div>
          <Bar
            data={growthPctData}
            options={{
              ...CHART_OPTS_BASE,
              scales: darkScales(v => v + '%'),
            }}
          />
        </div>
      </div>
    </div>
  )
}
