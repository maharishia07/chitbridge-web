// src/pages/ProductsManager.jsx — B3.7a manage the products in your catalogue
import { useState, useEffect } from 'react';
import { getMySchema, listProducts, addProduct, updateProduct, deleteProduct } from '../api/client';

export default function ProductsManager() {
  const [fields, setFields] = useState([]);   // product fields = schema fields minus 'quantity'
  const [items, setItems]   = useState([]);
  const [form, setForm]     = useState({});
  const [editId, setEditId] = useState(null);
  const [q, setQ]           = useState('');
  const [msg, setMsg]       = useState('');

  const productFields = fields.filter(f => f.field_key !== 'quantity');

  const loadSchema = async () => {
    const r = await getMySchema();
    setFields((r.data.schema?.fields || []).filter(Boolean));
  };
  const load = async () => { const r = await listProducts(q); setItems(r.data.items || []); };
  useEffect(() => { loadSchema(); load(); }, []);          // eslint-disable-line

  const save = async () => {
    try {
      if (editId) await updateProduct(editId, form);
      else        await addProduct(form);
      setForm({}); setEditId(null); setMsg(''); load();
    } catch (e) { setMsg(e.response?.data?.message || 'Save failed'); }
  };
  const edit = (it) => { setEditId(it.item_id); setForm(it.item_data); };
  const remove = async (id) => { await deleteProduct(id); load(); };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 mt-4">
      <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">Products in your catalogue</div>

      {/* add / edit form */}
      <div className="bg-gray-50 rounded-lg p-3 mb-3">
        {productFields.map(f => (
          <div key={f.field_key} className="mb-2">
            <label className="text-xs text-gray-500">{f.field_name}</label>
            <input type={f.field_type === 'number' ? 'number' : 'text'}
              value={form[f.field_key] || ''}
              onChange={e => setForm({ ...form, [f.field_key]: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
        ))}
        {msg && <div className="text-xs text-red-600 mb-2">{msg}</div>}
        <button onClick={save} className="w-full bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg">
          {editId ? 'Save changes' : 'Add product'}
        </button>
        {editId && <button onClick={() => { setEditId(null); setForm({}); }}
          className="w-full text-xs text-gray-400 mt-2">Cancel edit</button>}
      </div>

      {/* search */}
      <input value={q} onChange={e => setQ(e.target.value)} onKeyUp={e => e.key === 'Enter' && load()}
        placeholder="Search products…"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3" />

      {/* list */}
      {items.length === 0 ? (
        <div className="text-xs text-gray-400 text-center py-3">No products yet — add one above.</div>
      ) : items.map(it => (
        <div key={it.item_id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-none">
          <div className="text-sm text-gray-700">
            {productFields.map(f => it.item_data[f.field_key]).filter(Boolean).join(' · ')}
          </div>
          <div className="flex gap-3">
            <button onClick={() => edit(it)} className="text-xs text-blue-600">Edit</button>
            <button onClick={() => remove(it.item_id)} className="text-xs text-red-500">Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
