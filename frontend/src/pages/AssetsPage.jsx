import { useEffect, useState } from 'react'
import { getAssets, createAsset, updateAsset } from '../api/client'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'
import Pill from '../components/Pill'

const EMPTY_FORM = {
  name: '', type: 'cash', currency: 'AUD', color: '#6c8fff',
  display_order: 0, is_active: true, notes: '',
}

export default function AssetsPage() {
  const toast = useToast()
  const [assets, setAssets] = useState([])
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const reload = () => getAssets(true).then(setAssets)

  useEffect(() => { reload() }, [])

  function openNew() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setModal(true)
  }

  function openEdit(a) {
    setEditId(a.id)
    setForm({
      name: a.name, type: a.type, currency: a.currency,
      color: a.color || '#6c8fff', display_order: a.display_order,
      is_active: a.is_active, notes: a.notes || '',
    })
    setModal(true)
  }

  async function handleSave() {
    if (!form.name) { toast('Name is required'); return }
    const body = { ...form, display_order: Number(form.display_order) }
    try {
      if (editId) await updateAsset(editId, body)
      else await createAsset(body)
      setModal(false)
      toast('Asset saved ✓')
      reload()
    } catch (e) {
      toast('Error: ' + e.message)
    }
  }

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div>
      <div className="page-header">
        <h1>Assets</h1>
        <p>Configure the accounts and asset classes you track.</p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={openNew}>+ New Asset</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Currency</th>
              <th>Order</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {assets.map(a => (
              <tr key={a.id}>
                <td style={{ fontWeight: 500 }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: a.color || '#888', marginRight: 8 }} />
                  {a.name}
                </td>
                <td><Pill type={a.type} /></td>
                <td>{a.currency}</td>
                <td>{a.display_order}</td>
                <td style={{ color: a.is_active ? 'var(--green)' : 'var(--muted)' }}>
                  {a.is_active ? 'Yes' : 'No'}
                </td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(a)}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {assets.length === 0 && <div className="empty">No assets yet. Add one to get started.</div>}
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? 'Edit Asset' : 'New Asset'}
        footer={<>
          <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </>}
      >
        <div className="form-grid" style={{ marginBottom: 12 }}>
          <div className="form-group">
            <label>Name</label>
            <input type="text" placeholder="e.g. CBA Savings" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Type</label>
            <select value={form.type} onChange={e => set('type', e.target.value)}>
              <option value="cash">Cash</option>
              <option value="equities">Equities</option>
              <option value="crypto">Crypto</option>
              <option value="property">Property</option>
              <option value="bonds">Bonds</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label>Currency</label>
            <select value={form.currency} onChange={e => set('currency', e.target.value)}>
              <option value="AUD">AUD</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
          <div className="form-group">
            <label>Colour</label>
            <input type="color" value={form.color} onChange={e => set('color', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Display Order</label>
            <input type="number" value={form.display_order} onChange={e => set('display_order', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Active</label>
            <select value={String(form.is_active)} onChange={e => set('is_active', e.target.value === 'true')}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional" />
        </div>
      </Modal>
    </div>
  )
}
