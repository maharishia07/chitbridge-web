// src/pages/ConnectionsPage.jsx — Full connections screen
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { getConnections, getPendingConnections, requestConnection, respondToConnection, searchEntities } from '../api/client';
import SupplierListView from './SupplierListView';
import CustomerListView from './CustomerListView';

const RIBBON = [
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'customers', label: 'Customers' },
  { id: 'network',   label: 'Network' },
];

const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });

const Avatar = ({ name, size = 'md' }) => {
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-10 h-10 text-sm';
  return (
    <div className={`${sz} rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium flex-shrink-0`}>
      {name?.slice(0,2)?.toUpperCase() || 'CB'}
    </div>
  );
};

export default function ConnectionsPage() {
  const location = useLocation();
  const urlTab = new URLSearchParams(location.search).get('tab');
  // Network deep-links (?tab=pending / ?tab=partners) land on the Network ribbon
  const [ribbon, setRibbon]     = useState(
    urlTab === 'pending' || urlTab === 'partners' ? 'network' : 'suppliers');
  const initialTab = urlTab === 'pending' ? 'pending' : 'partners';
  const [tab, setTab]           = useState(initialTab);
  const [connections, setConns] = useState([]);
  const [pending, setPending]   = useState([]);
  const [searchQ, setSearchQ]   = useState('');
  const [results, setResults]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [note, setNote]         = useState('');
  const [loading, setLoading]   = useState(true);
  const [msg, setMsg]           = useState({ text: '', type: '' });
  const timerRef = useRef(null);

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (searchQ.length < 2) { setResults([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await searchEntities(searchQ);
        const connectedIds = connections.map(c => c.partner_entity_id);
        setResults((res.data.results || []).filter(r => !connectedIds.includes(r.identity_id)));
      } catch {}
    }, 300);
  }, [searchQ]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([getConnections(), getPendingConnections()]);
      setConns(c.data.connections || []);
      setPending(p.data.requests || []);
    } catch {}
    setLoading(false);
  };

  const showMsg = (text, type = 'info') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 3000);
  };

  const handleSelect = (r) => {
    setSelected(r);
    setSearchQ(r.display_name);
    setResults([]);
  };

  const handleConnect = async () => {
    if (!selected) return;
    try {
      await requestConnection({ to_entity_id: selected.identity_id, note: note || undefined });
      showMsg(`Connection request sent to ${selected.display_name}`, 'success');
      setSelected(null); setNote(''); setSearchQ('');
      loadAll();
    } catch (err) {
      showMsg(err.response?.data?.message || 'Failed to send request', 'error');
    }
  };

  const handleRespond = async (id, action) => {
    try {
      await respondToConnection(id, action);
      showMsg(action === 'accept' ? 'Connection accepted' : 'Connection rejected', 'success');
      loadAll();
    } catch (err) {
      showMsg(err.response?.data?.message || 'Failed', 'error');
    }
  };

  const msgStyle = msg.type === 'success' ? 'bg-green-50 text-green-700 border-green-200'
    : msg.type === 'error' ? 'bg-red-50 text-red-700 border-red-200'
    : 'bg-blue-50 text-blue-700 border-blue-200';

  return (
    <Layout title="Connections">
      <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">

        {msg.text && (
          <div className={`text-xs px-3 py-2 rounded-lg border ${msgStyle}`}>{msg.text}</div>
        )}

        {/* Three-ribbon — Suppliers / Customers / Network (D-063) */}
        <div className="flex border-b border-gray-200">
          {RIBBON.map(r => (
            <button key={r.id} onClick={() => setRibbon(r.id)}
              className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                ribbon === r.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
              }`}>
              {r.label}
            </button>
          ))}
        </div>

        {ribbon === 'suppliers' && <SupplierListView/>}
        {ribbon === 'customers' && <CustomerListView/>}

        {ribbon === 'network' && (<>
        {/* Search and connect */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Find and connect</div>
          <div className="relative">
            <input
              type="text" value={searchQ}
              onChange={e => { setSearchQ(e.target.value); setSelected(null); }}
              placeholder="Search by name..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
            {results.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-10 mt-1 overflow-hidden">
                {results.map(r => (
                  <button key={r.identity_id} onClick={() => handleSelect(r)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-none flex items-center gap-3">
                    <Avatar name={r.display_name} size="sm"/>
                    <div>
                      <div className="text-sm font-medium text-gray-800">{r.display_name}</div>
                      <div className="text-xs text-gray-400 font-mono">{r.bridge_id}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searchQ.length >= 2 && results.length === 0 && !selected && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-10 mt-1 px-4 py-3">
                <span className="text-xs text-gray-400">No entities found</span>
              </div>
            )}
          </div>
          {selected && (
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-2">
                <Avatar name={selected.display_name} size="sm"/>
                <div>
                  <div className="text-xs font-medium text-gray-800">{selected.display_name}</div>
                  <div className="text-xs text-gray-400 font-mono">{selected.bridge_id}</div>
                </div>
              </div>
              <input type="text" value={note} onChange={e => setNote(e.target.value)}
                placeholder="Introduction note (optional)..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-blue-400"/>
              <div className="flex gap-2">
                <button onClick={handleConnect}
                  className="flex-1 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg">
                  Send request
                </button>
                <button onClick={() => { setSelected(null); setSearchQ(''); }}
                  className="px-4 border border-gray-200 text-gray-500 text-sm rounded-lg">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {[
            { id: 'partners', label: `My connections${connections.length ? ` (${connections.length})` : ''}` },
            { id: 'pending',  label: `Pending${pending.length ? ` (${pending.length})` : ''}` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
        ) : tab === 'partners' ? (
          connections.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">🤝</div>
              <div className="text-sm">No connections yet</div>
              <div className="text-xs mt-1">Search above to connect with entities</div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {connections.map(c => (
                <div key={c.connection_id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-3">
                  <Avatar name={c.partner_display_name}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900 truncate">{c.partner_display_name}</span>
                      <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded flex-shrink-0">✓</span>
                    </div>
                    <div className="text-xs text-gray-400 font-mono mt-0.5">{c.partner_bridge_id}</div>
                    <div className="text-xs text-gray-400 mt-1">Connected {formatDate(c.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          pending.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">📨</div>
              <div className="text-sm">No pending requests</div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pending.map(r => (
                <div key={r.connection_id} className="bg-white rounded-xl border border-blue-100 p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar name={r.from_display_name}/>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900">{r.from_display_name}</div>
                      <div className="text-xs text-gray-400 font-mono">{r.from_bridge_id}</div>
                      {r.note && (
                        <div className="text-xs text-gray-500 italic mt-1 bg-gray-50 rounded px-2 py-1">
                          "{r.note}"
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleRespond(r.connection_id, 'accept')}
                      className="flex-1 bg-green-100 text-green-800 text-xs font-medium py-2 rounded-lg border border-green-200">
                      ✓ Accept
                    </button>
                    <button onClick={() => handleRespond(r.connection_id, 'reject')}
                      className="flex-1 bg-red-50 text-red-700 text-xs font-medium py-2 rounded-lg border border-red-200">
                      ✗ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
        </>)}
      </div>
    </Layout>
  );
}
