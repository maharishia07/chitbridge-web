// src/pages/CustomerListView.jsx — B3.6 Customer list + segmentation + promotions
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCustomers, setCustomerSegment } from '../api/client';
import ListControls from '../components/ListControls';
import { filterList } from '../utils/filterList';

const SEGMENTS = ['all','high_value','regular','new','inactive'];
const OVERRIDES = ['high_value','regular','new','inactive'];

const SEG_BADGE = {
  high_value: 'bg-amber-100 text-amber-800',
  regular:    'bg-green-100 text-green-700',
  new:        'bg-blue-100 text-blue-700',
  inactive:   'bg-gray-100 text-gray-500',
};

export default function CustomerListView() {
  const navigate = useNavigate();
  const [seg, setSeg]   = useState('all');
  const [list, setList] = useState([]);
  const [picked, setPicked] = useState([]);   // [{ identity_id, display_name }]
  const [editing, setEditing] = useState(null); // customer_list_id whose override is open
  const [q, setQ]           = useState('');   // search on top of the segment filter

  const load = async (s) => {
    try { const r = await getCustomers(s === 'all' ? '' : s); setList(r.data.customers || []); } catch {}
  };
  useEffect(() => { load(seg); setPicked([]); }, [seg]);

  const toggle = (c) =>
    setPicked(p => p.some(x => x.identity_id === c.customer_identity_id)
      ? p.filter(x => x.identity_id !== c.customer_identity_id)
      : [...p, { identity_id: c.customer_identity_id, display_name: c.display_name }]);

  // Hand the selected receivers to Compose; it sends one guaranteed chit each
  const promote = () => {
    sessionStorage.setItem('cb_promote_receivers', JSON.stringify(picked));
    navigate('/send?promote=1');
  };

  const override = async (id, value) => {
    try { await setCustomerSegment(id, value); setEditing(null); load(seg); } catch {}
  };

  const shown = filterList(list, q, ['display_name', 'bridge_id']);

  return (
    <div>
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {SEGMENTS.map(s => (
          <button key={s} onClick={() => setSeg(s)}
            className={`text-xs px-3 py-1.5 rounded-full border capitalize ${
              seg === s ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-500'}`}>
            {s.replace('_',' ')}
          </button>
        ))}
      </div>

      <ListControls query={q} onQuery={setQ} placeholder="Search customers by name or bridge ID…"/>

      {picked.length > 0 && (
        <button onClick={promote}
          className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm mb-3 w-full">
          Send promotion to {picked.length} selected
        </button>
      )}

      {shown.length === 0
        ? <div className="text-gray-400 text-sm text-center py-8">
            {list.length === 0 ? 'No customers in this segment yet.' : 'No customers match your search.'}
          </div>
        : shown.map(c => {
          const isPicked = picked.some(x => x.identity_id === c.customer_identity_id);
          return (
            <div key={c.customer_list_id}
              className="border border-gray-200 rounded-lg p-3 mb-2 bg-white">
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={isPicked} onChange={() => toggle(c)}/>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{c.display_name}</div>
                  <div className="text-xs text-gray-400">
                    {c.customer_type} · {c.txn_count} order{c.txn_count !== 1 ? 's' : ''} · via {c.added_via}</div>
                  <div className="text-xs text-gray-300 truncate">
                    {c.identity_type || 'entity'} · scope {c.owner_scope || 'entity'}
                    {c.email ? ` · ${c.email}` : ''}
                  </div>
                </div>
                <button onClick={() => setEditing(p => p === c.customer_list_id ? null : c.customer_list_id)}
                  className={`text-xs px-2 py-0.5 rounded-full capitalize ${SEG_BADGE[c.segment] || 'bg-gray-100 text-gray-500'}`}>
                  {c.segment.replace('_',' ')} ▾
                </button>
              </div>
              {editing === c.customer_list_id && (
                <div className="flex gap-1.5 flex-wrap mt-2 pl-7">
                  {OVERRIDES.map(o => (
                    <button key={o} onClick={() => override(c.customer_list_id, o)}
                      className={`text-xs px-2.5 py-1 rounded-full border capitalize ${
                        c.segment === o ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600'}`}>
                      {o.replace('_',' ')}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
