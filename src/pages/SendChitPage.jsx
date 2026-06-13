// src/pages/SendChitPage.jsx — Compose screen — full lifecycle
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendChit, searchEntities } from '../api/client';

const emptyItem = () => ({ id: Date.now() + Math.random(), name: '', quantity: 1, price: 0 });

const calcTotal = (item) => Math.round(item.quantity * item.price * 100) / 100;

const TEST_ITEMS = [
  { id: 1, name: 'Test Product A', quantity: 10, price: 100 },
  { id: 2, name: 'Test Product B', quantity: 5, price: 250 },
];

export default function SendChitPage() {
  const navigate = useNavigate();
  const [receivers, setReceivers] = useState([]);
  const [searchQ, setSearchQ]     = useState('');
  const [results, setResults]     = useState([]);
  const [lineItems, setLineItems] = useState([emptyItem()]);
  const [purpose, setPurpose]     = useState('order');
  const [sending, setSending]     = useState(false);
  const [error, setError]         = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    if (searchQ.length < 2) { setResults([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await searchEntities(searchQ);
        setResults((res.data.results || []).filter(r => !receivers.find(x => x.identity_id === r.identity_id)));
      } catch {}
    }, 300);
  }, [searchQ]);

  const addReceiver = (r) => { setReceivers(p => [...p, r]); setSearchQ(''); setResults([]); };
  const removeReceiver = (id) => setReceivers(p => p.filter(r => r.identity_id !== id));

  const updateItem = (id, field, val) => {
    setLineItems(p => p.map(i => i.id === id ? { ...i, [field]: field === 'name' ? val : parseFloat(val) || 0 } : i));
  };

  const autoPopulate = () => setLineItems(TEST_ITEMS);

  const grandTotal = lineItems.reduce((s, i) => s + calcTotal(i), 0);

  const handleSend = async () => {
    setError('');
    if (receivers.length === 0) { setError('Add at least one receiver'); return; }
    const valid = lineItems.filter(i => i.name.trim());
    setSending(true);
    try {
      await sendChit({
        receivers: receivers.map(r => ({ entity_id: r.identity_id })),
        purpose,
        line_items: valid.map(i => ({
          name: i.name, quantity: i.quantity, price: i.price,
          total: calcTotal(i), currency_code: 'INR'
        })),
      });
      navigate('/inbox');
    } catch (err) {
      setError(err.response?.data?.message || 'Send failed');
    } finally { setSending(false); }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-blue-600 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <button onClick={() => navigate('/inbox')} className="text-white text-sm opacity-80">Cancel</button>
        <span className="text-white font-medium text-sm">Compose</span>
        <button onClick={handleSend} disabled={sending || receivers.length === 0}
          className="bg-white text-blue-700 text-sm font-medium px-4 py-1.5 rounded-lg disabled:opacity-40">
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">

          {error && <div className="bg-red-50 text-red-700 text-xs p-3 rounded-xl border border-red-200">{error}</div>}

          {/* Receivers */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">To</div>
            {receivers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {receivers.map(r => (
                  <span key={r.identity_id} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full">
                    {r.display_name}
                    <button onClick={() => removeReceiver(r.identity_id)} className="text-blue-400 hover:text-blue-700 ml-0.5">×</button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="Search by name... (add multiple)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"/>
              {results.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-10 mt-1 overflow-hidden">
                  {results.map(r => (
                    <button key={r.identity_id} onClick={() => addReceiver(r)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-none">
                      <div className="text-sm font-medium text-gray-800">{r.display_name}</div>
                      <div className="text-xs text-gray-400 font-mono">{r.bridge_id}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-1.5">Search and select — you can add multiple receivers</div>
          </div>

          {/* Purpose */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Purpose</div>
            <div className="flex flex-wrap gap-2">
              {['order','invoice','receipt','inquiry','delivery_note','general'].map(p => (
                <button key={p} onClick={() => setPurpose(p)}
                  className={`text-xs px-3 py-1.5 rounded-full capitalize transition-colors ${
                    purpose === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {p.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Line items */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Line items</div>
              <button onClick={autoPopulate}
                className="text-xs text-blue-600 border border-blue-200 px-2.5 py-1 rounded-lg">
                Auto fill (test)
              </button>
            </div>

            {lineItems.map((item, idx) => (
              <div key={item.id} className="bg-gray-50 rounded-xl p-3 mb-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-400 font-medium">Item {idx + 1}</span>
                  {lineItems.length > 1 && (
                    <button onClick={() => setLineItems(p => p.filter(i => i.id !== item.id))}
                      className="text-xs text-red-400">Remove</button>
                  )}
                </div>
                <input type="text" value={item.name} placeholder="Product name *"
                  onChange={e => updateItem(item.id, 'name', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-blue-400"/>
                <div className="grid grid-cols-2 gap-2 mb-1">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Quantity</div>
                    <input type="number" min="1" step="1" value={item.quantity}
                      onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"/>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Price (INR)</div>
                    <input type="number" min="0" step="0.01" value={item.price}
                      onChange={e => updateItem(item.id, 'price', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"/>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-xs text-gray-400">Total</span>
                  <span className="text-sm font-semibold text-blue-700">INR {calcTotal(item).toFixed(2)}</span>
                </div>
              </div>
            ))}

            <button onClick={() => setLineItems(p => [...p, emptyItem()])}
              className="w-full border-2 border-dashed border-blue-200 text-blue-500 text-sm py-3 rounded-xl hover:border-blue-400 transition-colors">
              + Add item
            </button>

            {lineItems.length > 0 && (
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
                <span className="text-sm text-gray-600 font-medium">Grand total</span>
                <span className="text-base font-bold text-blue-700">INR {grandTotal.toFixed(2)}</span>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
