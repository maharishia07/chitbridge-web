// src/pages/SendChitPage.jsx — Compose screen reads from schema
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendChit, searchEntities, getSchemaFields } from '../api/client';

const DEFAULT_FIELDS = [
  { field_key: 'product',  field_name: 'Product',  field_type: 'text',   required: true, min_value: null },
  { field_key: 'quantity', field_name: 'Quantity', field_type: 'number', required: true, min_value: 1 },
  { field_key: 'price',    field_name: 'Price',    field_type: 'number', required: true, min_value: 0 },
];

const emptyItem = (fields) => {
  const item = { id: Date.now() + Math.random() };
  fields.forEach(f => { item[f.field_key] = f.field_type === 'number' ? 0 : ''; });
  return item;
};

const TEST_DATA = [
  { product: 'Paracetamol 500mg', quantity: 100, price: 4.50 },
  { product: 'Amoxicillin 250mg', quantity: 50,  price: 12.00 },
];

const calcTotal = (item) => {
  const qty   = parseFloat(item.quantity)  || 0;
  const price = parseFloat(item.price)     || 0;
  return Math.round(qty * price * 100) / 100;
};

export default function SendChitPage() {
  const navigate              = useNavigate();
  const [schemaFields, setSchemaFields] = useState(DEFAULT_FIELDS);
  const [receivers, setReceivers] = useState([]);
  const [searchQ, setSearchQ]     = useState('');
  const [results, setResults]     = useState([]);
  const [lineItems, setLineItems] = useState([]);
  const [purpose, setPurpose]     = useState('order');
  const [sending, setSending]     = useState(false);
  const [error, setError]         = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    // Load schema fields — fallback to defaults if no schema
    getSchemaFields()
      .then(res => {
        const fields = res.data.fields || [];
        if (fields.length > 0) {
          setSchemaFields(fields);
          setLineItems([emptyItem(fields)]);
        } else {
          setLineItems([emptyItem(DEFAULT_FIELDS)]);
        }
      })
      .catch(() => {
        setLineItems([emptyItem(DEFAULT_FIELDS)]);
      });
  }, []);

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

  const updateItem = (id, field_key, val) => {
    setLineItems(p => p.map(i => i.id === id ? { ...i, [field_key]: val } : i));
  };

  const autoPopulate = () => {
    setLineItems(TEST_DATA.map((d, i) => ({ id: i + 1, ...d })));
  };

  const grandTotal = lineItems.reduce((s, i) => s + calcTotal(i), 0);

  const handleSend = async () => {
    setError('');
    if (receivers.length === 0) { setError('Add at least one receiver'); return; }
    const validItems = lineItems.filter(i =>
      schemaFields.some(f => f.field_type === 'text' && i[f.field_key]?.toString().trim())
    );
    setSending(true);
    try {
      await sendChit({
        receivers: receivers.map(r => ({ entity_id: r.identity_id })),
        purpose,
        line_items: validItems.map(item => {
          const mapped = {};
          schemaFields.forEach(f => { mapped[f.field_key] = item[f.field_key]; });
          const nameField = schemaFields.find(f => f.field_type === 'text');
          if (nameField) mapped.name = item[nameField.field_key];
          mapped.total = calcTotal(item);
          mapped.currency_code = 'INR';
          return mapped;
        }),
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
                placeholder="Search by name — add multiple"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"/>
              {results.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-10 mt-1 overflow-hidden">
                  {results.map(r => (
                    <button key={r.identity_id} onClick={() => addReceiver(r)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-none">
                      <div className="text-sm font-medium text-gray-800">{r.display_name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
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
                  {p.replace('_',' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Line items — dynamic from schema */}
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
                {/* Render fields from schema */}
                {schemaFields.map(field => (
                  <div key={field.field_key} className="mb-2">
                    <div className="text-xs text-gray-400 mb-1">
                      {field.field_name}{field.required && <span className="text-red-400 ml-0.5">*</span>}
                    </div>
                    <input
                      type={field.field_type === 'number' ? 'number' : 'text'}
                      min={field.min_value ?? undefined}
                      value={item[field.field_key] || ''}
                      onChange={e => updateItem(item.id, field.field_key, e.target.value)}
                      placeholder={field.field_name}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    />
                  </div>
                ))}
                {/* Show total if qty and price exist */}
                {item.quantity !== undefined && item.price !== undefined && (
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200 mt-1">
                    <span className="text-xs text-gray-400">Total</span>
                    <span className="text-sm font-semibold text-blue-700">INR {calcTotal(item).toFixed(2)}</span>
                  </div>
                )}
              </div>
            ))}

            <button onClick={() => setLineItems(p => [...p, emptyItem(schemaFields)])}
              className="w-full border-2 border-dashed border-blue-200 text-blue-500 text-sm py-3 rounded-xl hover:border-blue-400 transition-colors">
              + Add item
            </button>

            {grandTotal > 0 && (
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
