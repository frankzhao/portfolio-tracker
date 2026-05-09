const BASE = '/api'

async function request(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(BASE + path, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || res.statusText)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, 'POST', body),
  patch: (path, body) => request(path, 'PATCH', body),
  delete: (path) => request(path, 'DELETE'),
}

// ── Assets ────────────────────────────────────────────────────────────────────
export const getAssets = (includeInactive = false) =>
  api.get(`/assets/?include_inactive=${includeInactive}`)
export const createAsset = (body) => api.post('/assets/', body)
export const updateAsset = (id, body) => api.patch(`/assets/${id}`, body)
export const deleteAsset = (id) => api.delete(`/assets/${id}`)

// ── Snapshots ─────────────────────────────────────────────────────────────────
export const getSnapshots = (params = {}) => {
  const q = new URLSearchParams(params).toString()
  return api.get(`/snapshots/?${q}`)
}
export const upsertSnapshot = (body) => api.post('/snapshots/', body)
export const updateSnapshot = (id, body) => api.patch(`/snapshots/${id}`, body)
export const deriveCashflow = (period) => api.post(`/snapshots/derive-cashflow?period=${period}`)

// ── Cash Flows ────────────────────────────────────────────────────────────────
export const getCashFlows = (params = {}) => {
  const q = new URLSearchParams(params).toString()
  return api.get(`/cashflows/?${q}`)
}
export const upsertCashFlow = (body) => api.post('/cashflows/', body)

// ── Transactions ──────────────────────────────────────────────────────────────
export const getTransactions = (params = {}) => {
  const q = new URLSearchParams(params).toString()
  return api.get(`/transactions/?${q}`)
}
export const createTransaction = (body) => api.post('/transactions/', body)
export const updateTransaction = (id, body) => api.patch(`/transactions/${id}`, body)
export const bulkCreateTransactions = (body) => api.post('/transactions/bulk', body)

// ── Categories ────────────────────────────────────────────────────────────────
export const getCategories = () => api.get('/categories/')
export const createCategory = (name) => api.post('/categories/', { name })
export const deleteCategory = (id) => api.delete(`/categories/${id}`)

// ── FX Rates ──────────────────────────────────────────────────────────────────
export const getFxRates = (period) => api.get(`/fx-rates/?period=${period}`)

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const getDashboard = () => api.get('/dashboard/')
