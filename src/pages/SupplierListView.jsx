// src/pages/SupplierListView.jsx — B3.6 Supplier list (no consent)
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { addSupplier, getSuppliers, removeSupplier, searchEntities } from '../api/client';
import ListControls from '../components/ListControls';
import { filterList } from '../utils/filterList';

export default function SupplierListView() {
  const navigate = useNavigate();
  const [list, setList]     = useState([]);
  const [searchQ, setSearchQ] = useState('');   // what the user typed (name search)
  const [results, setResults] = useState([]);   // entity matches
  const [selected, setSelected] = useState(null); // chosen { identity_id, display_name, bridge_id }
  const [cat, setCat]       = useState('');
  const [msg, setMsg]       = useState('');
  const [q, setQ]           = useState('');          // filter the displayed list
  const [supFilter, setSupFilter] = useState('all'); // all | catalogue
  const timerRef = useRef(null);

  const load = async () => {
    try { const r = await getSuppliers(); setList(r.data.suppliers || []); } catch {}
  };
  useEffect(() => { load(); }, []);

  // Live entity search by name (2+ chars), like the Network / Compose pickers
  useEffect(() => {
    if (selected || searchQ.trim().length < 2) { setResults([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await searchEntities(searchQ.trim());
        const inList = new Set(list.map(s => s.supplier_entity_id));
        setResults((res.data.results || []).filter(r => !inList.has(r.identity_id)));
      } catch {}
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [searchQ, selected]);

  const pick = (r) => { setSelected(r); setSearchQ(r.display_name); setResults([]); };
  const clearPick = () => { setSelected(null); setSearchQ(''); setResults([]); };

  const add = async (e) => {
    e.preventDefault(); setMsg('');
    // Use the picked entity's bridge id; fall back to raw typed text (pasted bridge id)
    const bridge = (selected?.bridge_id || searchQ).trim();
    if (!bridge) { setMsg('Search and select an entity, or paste a bridge ID'); return; }
    try {
      await addSupplier({ supplier_bridge_id: bridge, category: cat.trim() });
      clearPick(); setCat(''); load();
    } catch (err) { setMsg(err.response?.data?.message || 'Could not add'); }
  };

  // Open the supplier's catalogue to draft an order chit (mirrors PHP supplierCompose)
  const order = (s) => navigate(`/supplier-order/${s.supplier_entity_id}`);

  let shown = filterList(list, q, ['display_name', 'category', 'bridge_id']);
  if (supFilter === 'catalogue') shown = shown.filter(s => s.has_catalogue);

  return (
    <div>
      <form onSubmit={add} className="mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input value={searchQ}
              onChange={e => { setSearchQ(e.target.value); setSelected(null); }}
              placeholder="Search by name or paste bridge ID"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"/>
            {results.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1 max-h-48 overflow-y-auto">
                {results.map(r => (
                  <button key={r.identity_id} type="button" onClick={() => pick(r)}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-50 last:border-0">
                    <div className="text-sm font-medium text-gray-800">{r.display_name}</div>
                    <div className="text-xs text-gray-400 font-mono">{r.bridge_id}</div>
                  </button>
                ))}
              </div>
            )}
            {searchQ.trim().length >= 2 && !selected && results.length === 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1 px-3 py-2">
                <span className="text-xs text-gray-400">No matching entities — you can still paste an exact bridge ID</span>
              </div>
            )}
          </div>
          <input value={cat} onChange={e => setCat(e.target.value)}
            placeholder="Category (optional)"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28"/>
          <button className="bg-blue-600 text-white rounded-lg px-4 text-sm">Add</button>
        </div>
        {selected && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-500">Selected:</span>
            <span className="inline-flex items-center gap-1 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
              <span className="text-xs font-medium text-green-800">{selected.display_name}</span>
              <span className="text-xs text-green-500 font-mono">{selected.bridge_id}</span>
              <button type="button" onClick={clearPick} className="text-green-500 text-xs ml-0.5 hover:text-red-500">✕</button>
            </span>
          </div>
        )}
      </form>
      {msg && <div className="text-red-600 text-xs mb-3">{msg}</div>}
      {list.length > 0 && (
        <ListControls query={q} onQuery={setQ} placeholder="Filter your suppliers…"
          filters={[{ value: 'all', label: 'All' }, { value: 'catalogue', label: 'Has catalogue' }]}
          value={supFilter} onFilter={setSupFilter}/>
      )}
      {list.length === 0
        ? <div className="text-gray-400 text-sm text-center py-8">No suppliers yet. Search by name or paste a bridge ID.</div>
        : shown.length === 0
        ? <div className="text-gray-400 text-sm text-center py-6">No suppliers match your filter.</div>
        : shown.map(s => (
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
