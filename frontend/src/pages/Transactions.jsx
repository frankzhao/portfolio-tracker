import { useEffect, useState, useCallback } from 'react'
import { getTransactions, getCategories, createTransaction, updateTransaction, createCategory, deleteCategory, getAssets } from '../api/client'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'

const PAGE = 100

function fmt(n) {
  const v = Number(n)
  return (v >= 0 ? '+' : '') + '$' + Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Transactions() {
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [cats, setCats] = useState([])           // [{id, name, tx_count}]
  const [assets, setAssets] = useState([])
  const [catFilter, setCatFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [assetFilter, setAssetFilter] = useState('')
  const [years, setYears] = useState([])
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [manageCatsModal, setManageCatsModal] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [catSaving, setCatSaving] = useState(false)

  const [form, setForm] = useState({ date: '', description: '', amount: '', category: '', from_asset_id: '', to_asset_id: '' })

  const refreshCats = () => getCategories().then(setCats)

  const loadRows = useCallback(async (reset = false) => {
    const off = reset ? 0 : offset
    const params = { limit: PAGE, offset: off }
    if (catFilter) params.category = catFilter
    if (yearFilter) { params.from_date = `${yearFilter}-01-01`; params.to_date = `${yearFilter}-12-31` }
    if (assetFilter) params.asset_id = assetFilter

    const data = await getTransactions(params)
    if (reset) {
      setRows(data)
      setOffset(data.length)
    } else {
      setRows(prev => [...prev, ...data])
      setOffset(off + data.length)
    }
    setHasMore(data.length === PAGE)
  }, [catFilter, yearFilter, assetFilter, offset])

  useEffect(() => {
    refreshCats()
    getAssets().then(setAssets)
  }, [])

  useEffect(() => {
    loadRows(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catFilter, yearFilter, assetFilter])

  // Derive years from loaded rows
  useEffect(() => {
    const ys = [...new Set(rows.map(r => r.date.substring(0, 4)))].sort((a, b) => b - a)
    setYears(ys)
  }, [rows])

  function openEdit(r) {
    setEditingId(r.id)
    setForm({
      date: r.date,
      description: r.description,
      amount: String(r.amount),
      category: r.category || '',
      from_asset_id: r.from_asset_id ? String(r.from_asset_id) : '',
      to_asset_id: r.to_asset_id ? String(r.to_asset_id) : '',
    })
    setModal(true)
  }

  function closeModal() {
    setModal(false)
    setEditingId(null)
    setForm({ date: '', description: '', amount: '', category: '', from_asset_id: '', to_asset_id: '' })
  }

  async function handleSave() {
    if (!form.date || !form.description || !form.amount) {
      toast('Fill in date, description, and amount')
      return
    }
    const body = {
      date: form.date,
      description: form.description,
      amount: parseFloat(form.amount),
      category: form.category || null,
      from_asset_id: form.from_asset_id ? parseInt(form.from_asset_id) : null,
      to_asset_id: form.to_asset_id ? parseInt(form.to_asset_id) : null,
    }
    try {
      if (editingId) {
        await updateTransaction(editingId, body)
        toast('Transaction updated ✓')
      } else {
        await createTransaction(body)
        toast('Transaction added ✓')
      }
      closeModal()
      loadRows(true)
      refreshCats()
    } catch (e) {
      toast('Error: ' + e.message)
    }
  }

  async function handleAddCategory(e) {
    e.preventDefault()
    const name = newCatName.trim()
    if (!name) return
    setCatSaving(true)
    try {
      await createCategory(name)
      setNewCatName('')
      refreshCats()
    } catch (e) {
      toast('Error: ' + e.message)
    } finally {
      setCatSaving(false)
    }
  }

  async function handleDeleteCategory(cat) {
    try {
      await deleteCategory(cat.id)
      refreshCats()
      // Clear filter if the deleted category was selected
      if (catFilter === cat.name) setCatFilter('')
    } catch (e) {
      toast('Error: ' + e.message)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Transactions</h1>
        <p>Individual income and expense entries.</p>
      </div>

      <div className="toolbar">
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">All categories</option>
          {cats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <select value={assetFilter} onChange={e => setAssetFilter(e.target.value)}>
          <option value="">All accounts</option>
          {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
          <option value="">All years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={() => setManageCatsModal(true)}>Categories</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setModal(true)}>+ Add</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>From</th>
              <th>To</th>
              <th>Category</th>
              <th className="td-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {new Date(r.date + 'T00:00:00').toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="td-trunc" title={r.description}>
                  {r.description}
                  {r.is_derived && (
                    <>
                      <span className="badge" style={{ marginLeft: 6 }}>derived</span>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '1px 6px', marginLeft: 4, fontSize: 11 }}
                        onClick={() => openEdit(r)}
                        title="Edit transaction"
                      >✎</button>
                    </>
                  )}
                </td>
                <td>{r.from_asset ? <span className="pill pill-other">{r.from_asset.name}</span> : '—'}</td>
                <td>{r.to_asset ? <span className="pill pill-other">{r.to_asset.name}</span> : '—'}</td>
                <td>
                  {r.category ? <span className="pill pill-other">{r.category}</span> : '—'}
                </td>
                <td className={`td-right td-mono ${Number(r.amount) >= 0 ? 'up' : 'down'}`}>
                  {fmt(r.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty">No transactions found.</div>}
      </div>

      {hasMore && (
        <div style={{ textAlign: 'center', paddingTop: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => loadRows()}>Load more</button>
        </div>
      )}

      {/* ── Add Transaction ──────────────────────────────────────────────── */}
      <Modal
        open={modal}
        onClose={closeModal}
        title={editingId ? 'Edit Transaction' : 'Add Transaction'}
        footer={<>
          <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </>}
      >
        <div className="form-grid" style={{ marginBottom: 12 }}>
          <div className="form-group">
            <label>Date</label>
            <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Amount (negative = expense)</label>
            <input type="number" step="0.01" placeholder="-45.00" value={form.amount}
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Category</label>
            <input type="text" placeholder="Dining, Retail…" list="cat-list" value={form.category}
              onChange={e => setForm(p => ({ ...p, category: e.target.value }))} />
            <datalist id="cat-list">{cats.map(c => <option key={c.id} value={c.name} />)}</datalist>
          </div>
          <div className="form-group">
            <label>From account</label>
            <select value={form.from_asset_id} onChange={e => setForm(p => ({ ...p, from_asset_id: e.target.value }))}>
              <option value="">None</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>To account</label>
            <select value={form.to_asset_id} onChange={e => setForm(p => ({ ...p, to_asset_id: e.target.value }))}>
              <option value="">None</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Description</label>
          <input type="text" placeholder="Merchant or note" value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        </div>
      </Modal>

      {/* ── Manage Categories ────────────────────────────────────────────── */}
      <Modal
        open={manageCatsModal}
        onClose={() => setManageCatsModal(false)}
        title="Manage Categories"
        footer={<button className="btn btn-ghost" onClick={() => setManageCatsModal(false)}>Done</button>}
      >
        <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input
            type="text"
            placeholder="New category name"
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary btn-sm" type="submit" disabled={catSaving || !newCatName.trim()}>
            Add
          </button>
        </form>

        {cats.length === 0 ? (
          <p style={{ color: 'var(--muted)', textAlign: 'center' }}>No categories yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cats.map(c => (
              <div key={c.id ?? c.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--surface)', borderRadius: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 500 }}>{c.name}</span>
                  {c.id == null && (
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>from transactions</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {c.tx_count > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{c.tx_count} tx</span>
                  )}
                  {c.id != null && (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--danger, #e55)' }}
                      onClick={() => handleDeleteCategory(c)}
                      title="Remove category"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
