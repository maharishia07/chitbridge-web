// src/pages/SupplierListView.jsx — B3.6 Supplier list (no consent)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { addSupplier, getSuppliers, removeSupplier } from '../api/client';

export default function SupplierListView() {
  const navigate = useNavigate();
  const [list, setList]   = useState([]);
  const [bridge, setBridge] = useState('');
  const [cat, setCat]     = useState('');
  const [msg, setMsg]     = useState('');

  const load = async () => {
    try { const r = await getSuppliers(); setList(r.data.suppliers || []); } catch {}
  };
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault(); setMsg('');
    try {
      await addSupplier({ supplier_bridge_id: bridge.trim(), category: cat.trim() });
      setBridge(''); setCat(''); load();
    } catch (err) { setMsg(err.response?.data?.message || 'Could not add'); }
  };

  // Preselect this supplier on the Compose page, then send a guaranteed chit
  const order = (s) => {
    sessionStorage.setItem('cb_order_supplier', JSON.stringify({
      identity_id: s.supplier_entity_id,
      display_name: s.display_name,
    }));
    navigate('/send?supplier=1');
  };

  return (
    <div>
      <form onSubmit={add} className="flex gap-2 mb-4">
        <input value={bridge} onChange={e => setBridge(e.target.value)}
          placeholder="Supplier bridge ID (e.g. CB1A2B3C4D)" required
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1"/>
        <input value={cat} onChange={e => setCat(e.target.value)}
          placeholder="Category (optional)"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32"/>
        <button className="bg-blue-600 text-white rounded-lg px-4 text-sm">Add</button>
      </form>
      {msg && <div className="text-red-600 text-xs mb-3">{msg}</div>}
      {list.length === 0
        ? <div className="text-gray-400 text-sm text-center py-8">No suppliers yet. Add one by bridge ID.</div>
        : list.map(s => (
          <div key={s.supplier_list_id}
            className="flex items-center justify-between border border-gray-200 rounded-lg p-3 mb-2 bg-white">
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">{s.display_name}</div>
              <div className="text-xs text-gray-400 font-mono truncate">{s.bridge_id}{s.category ? ` · ${s.category}` : ''}
                {s.has_catalogue ? ' · catalogue' : ''}</div>
            </div>
            <div className="flex gap-2 flex-shrink-0 ml-2">
              {s.has_catalogue && (
                <button onClick={() => order(s)}
                  className="text-blue-600 text-xs px-3 py-1.5 border border-blue-200 rounded-lg hover:bg-blue-50">Order</button>
              )}
              <button onClick={() => removeSupplier(s.supplier_list_id).then(load)}
                className="text-red-500 text-xs px-2">Remove</button>
            </div>
          </div>
        ))}
    </div>
  );
}
