// src/pages/SendChitPage.jsx — B3.4
// B3.4 additions:
//   Send confirmation modal before submit
//   Currency selector (INR USD GBP EUR AED SGD MYR)
//   Range toggle: Fixed / Qty range / Price range / Both
//   Min-max fields per line item when range mode active
//   Total shows range when applicable
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { sendChit, getConnections, searchEntities } from '../api/client';
import { useAuth } from '../context/AuthContext';

// B3.4 — Currency options
const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
];

const RANGE_MODES = [
  { id: 'fixed',      label: 'Fixed' },
  { id: 'qty_range',  label: 'Qty range' },
  { id: 'price_range',label: 'Price range' },
  { id: 'both',       label: 'Both' },
];

const PURPOSES = ['order','invoice','receipt','inquiry','delivery_note','general'];

const emptyItem = () => ({
  id: Date.now() + Math.random(),
  particulars: '',
  quantity: '',
  qty_min: '', qty_max: '',
  price: '',
  price_min: '', price_max: '',
  total: '',
});

const calcItemTotal = (item, rangeMode, currency) => {
  const sym = CURRENCIES.find(c => c.code === currency)?.symbol || '₹';
  if (rangeMode === 'fixed') {
    const v = parseFloat(item.quantity || 0) * parseFloat(item.price || 0);
    return v > 0 ? `${sym}${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '';
  }
  if (rangeMode === 'qty_range') {
    const lo = parseFloat(item.qty_min||0) * parseFloat(item.price||0);
    const hi = parseFloat(item.qty_max||0) * parseFloat(item.price||0);
    if (!lo && !hi) return '';
    return `${sym}${lo.toLocaleString('en-IN',{maximumFractionDigits:0})} — ${sym}${hi.toLocaleString('en-IN',{maximumFractionDigits:0})}`;
  }
  if (rangeMode === 'price_range') {
    const lo = parseFloat(item.quantity||0) * parseFloat(item.price_min||0);
    const hi = parseFloat(item.quantity||0) * parseFloat(item.price_max||0);
    if (!lo && !hi) return '';
    return `${sym}${lo.toLocaleString('en-IN',{maximumFractionDigits:0})} — ${sym}${hi.toLocaleString('en-IN',{maximumFractionDigits:0})}`;
  }
  if (rangeMode === 'both') {
    const lo = parseFloat(item.qty_min||0) * parseFloat(item.price_min||0);
    const hi = parseFloat(item.qty_max||0) * parseFloat(item.price_max||0);
    if (!lo && !hi) return '';
    return `${sym}${lo.toLocaleString('en-IN',{maximumFractionDigits:0})} — ${sym}${hi.toLocaleString('en-IN',{maximumFractionDigits:0})}`;
  }
  return '';
};

const calcGrandTotal = (items, rangeMode, currency) => {
  const sym = CURRENCIES.find(c => c.code === currency)?.symbol || '₹';
  if (rangeMode === 'fixed') {
    const tot = items.reduce((s,i) => s + parseFloat(i.quantity||0)*parseFloat(i.price||0), 0);
    return tot > 0 ? `${sym}${tot.toLocaleString('en-IN',{maximumFractionDigits:2})}` : '';
  }
  const lo = items.reduce((s,i) => {
    if (rangeMode === 'qty_range')   return s + parseFloat(i.qty_min||0)*parseFloat(i.price||0);
    if (rangeMode === 'price_range') return s + parseFloat(i.quantity||0)*parseFloat(i.price_min||0);
    if (rangeMode === 'both')        return s + parseFloat(i.qty_min||0)*parseFloat(i.price_min||0);
    return s;
  }, 0);
  const hi = items.reduce((s,i) => {
    if (rangeMode === 'qty_range')   return s + parseFloat(i.qty_max||0)*parseFloat(i.price||0);
    if (rangeMode === 'price_range') return s + parseFloat(i.quantity||0)*parseFloat(i.price_max||0);
    if (rangeMode === 'both')        return s + parseFloat(i.qty_max||0)*parseFloat(i.price_max||0);
    return s;
  }, 0);
  if (!lo && !hi) return '';
  return `${sym}${lo.toLocaleString('en-IN',{maximumFractionDigits:0})} — ${sym}${hi.toLocaleString('en-IN',{maximumFractionDigits:0})}`;
};

// ── Confirm Modal — B3.4 ────────────────────────────────────
const ConfirmModal = ({ data, onConfirm, onEdit, loading }) => {
  const sym = CURRENCIES.find(c => c.code === data.currency)?.symbol || '₹';
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="text-center py-5 px-4 border-b border-gray-100">
          <div className="text-3xl mb-2">📤</div>
          <div className="text-sm font-medium text-gray-900">Ready to send?</div>
        </div>
        <div className="divide-y divide-gray-100">
          {[
            ['To', data.to],
            ['Type', data.purpose],
            ['Items', `${data.itemCount} line item${data.itemCount !== 1 ? 's' : ''}`],
            ['Currency', `${sym} ${data.currency}`],
            ['Total', data.total],
          ].map(([k,v]) => v ? (
            <div key={k} className="flex justify-between items-center px-4 py-3">
              <span className="text-xs text-gray-500">{k}</span>
              <span className={`text-xs font-semibold text-right ${k === 'Total' ? 'text-blue-600 text-sm' : 'text-gray-800'}`}>{v}</span>
            </div>
          ) : null)}
        </div>
        <div className="flex gap-3 p-4">
          <button onClick={onEdit}
            className="flex-1 border border-gray-200 rounded-xl py-3 text-sm text-gray-600 font-medium">
            Edit
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-2 flex-1 bg-blue-600 text-white rounded-xl py-3 text-sm font-medium disabled:opacity-50">
            {loading ? 'Sending...' : 'Send now'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function SendChitPage() {
  const { entity, isActor, parentEntity } = useAuth();
  const navigate = useNavigate();

  const [purpose,     setPurpose]     = useState('order');
  const [toSearch,    setToSearch]    = useState('');
  const [toEntities,  setToEntities]  = useState([]);
  const [results,     setResults]     = useState([]);
  const [subject,     setSubject]     = useState('');
  const [items,       setItems]       = useState([emptyItem()]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  // B3.4
  const [currency,   setCurrency]   = useState('INR');
  const [rangeMode,  setRangeMode]  = useState('fixed');
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  const sym = CURRENCIES.find(c => c.code === currency)?.symbol || '₹';

  useEffect(() => {
    if (!toSearch || toSearch.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await searchEntities(toSearch);
        setResults(res.data.results || []);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [toSearch]);

  const updateItem = (id, field, val) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: val } : i));

  const grandTotal = calcGrandTotal(items, rangeMode, currency);

  const handleSubmitClick = (e) => {
    e.preventDefault();
    if (toEntities.length === 0) { setError('Select at least one receiver'); return; }
    const filled = items.filter(i => i.particulars);
    if (filled.length === 0) { setError('Add at least one item'); return; }
    setError('');
    setShowConfirm(true);
  };

  const handleConfirmedSend = async () => {
    setLoading(true);
    try {
      const filled = items.filter(i => i.particulars);
      const lineItems = filled.map(i => {
        const qty   = parseFloat(i.quantity  || 0);
        const price = parseFloat(i.price     || 0);
        return {
          particulars: i.particulars,
          quantity:  rangeMode === 'qty_range'   || rangeMode === 'both' ? null : qty,
          qty_min:   rangeMode === 'qty_range'   || rangeMode === 'both' ? parseFloat(i.qty_min||0)   : null,
          qty_max:   rangeMode === 'qty_range'   || rangeMode === 'both' ? parseFloat(i.qty_max||0)   : null,
          price:     rangeMode === 'price_range' || rangeMode === 'both' ? null : price,
          price_min: rangeMode === 'price_range' || rangeMode === 'both' ? parseFloat(i.price_min||0) : null,
          price_max: rangeMode === 'price_range' || rangeMode === 'both' ? parseFloat(i.price_max||0) : null,
          total:     rangeMode === 'fixed' ? qty * price : 0,
        };
      });

      await sendChit({
        receivers:      toEntities.map(e => ({ entity_id: e.identity_id })),
        purpose,
        manual_subject: subject,
        line_items:     lineItems,
        business_json:  { currency, range_mode: rangeMode },
      });
      navigate('/inbox');
    } catch (err) {
      setError(err.response?.data?.message || 'Send failed');
      setShowConfirm(false);
    } finally { setLoading(false); }
  };

  return (
    <Layout title="Compose">
      <form onSubmit={handleSubmitClick} className="max-w-lg mx-auto p-4 space-y-4">

        {/* Purpose */}
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">Transaction type</label>
          <div className="flex flex-wrap gap-2">
            {PURPOSES.map(p => (
              <button key={p} type="button" onClick={() => setPurpose(p)}
                className={`px-3 py-1.5 rounded-full text-xs border font-medium transition-colors capitalize ${
                  purpose === p ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600'
                }`}>{p.replace('_',' ')}</button>
            ))}
          </div>
        </div>

        {/* To */}
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">
            To {toEntities.length > 1 && <span className="text-blue-600">({toEntities.length} receivers)</span>}
          </label>

          {/* Selected entity chips */}
          {toEntities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {toEntities.map(e => (
                <div key={e.identity_id} className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
                  <span className="text-xs font-medium text-green-800">{e.display_name}</span>
                  <button type="button"
                    onClick={() => setToEntities(p => p.filter(x => x.identity_id !== e.identity_id))}
                    className="text-green-500 text-xs leading-none ml-0.5 hover:text-red-500">✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Search input — always visible */}
          <div className="relative">
            <input type="text"
              placeholder={toEntities.length === 0 ? 'Search by entity name...' : 'Add another receiver...'}
              value={toSearch} onChange={e => setToSearch(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"/>
            {results.filter(r => !toEntities.some(e => e.identity_id === r.identity_id)).length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1 max-h-48 overflow-y-auto">
                {results
                  .filter(r => !toEntities.some(e => e.identity_id === r.identity_id))
                  .map(r => (
                    <button key={r.identity_id} type="button"
                      onClick={() => { setToEntities(p => [...p, r]); setToSearch(''); setResults([]); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 border-b border-gray-50 last:border-0">
                      <div className="font-medium text-gray-800">{r.display_name}</div>
                      {r.bridge_id && <div className="text-xs text-gray-400">{r.bridge_id}</div>}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Currency — B3.4 */}
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">Currency</label>
          <button type="button" onClick={() => setShowCurrencyPicker(p => !p)}
            className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
            <span className="font-medium">{sym} {currency}</span>
            <span className="text-gray-400 text-xs">▾</span>
          </button>
          {showCurrencyPicker && (
            <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              {CURRENCIES.map(c => (
                <button key={c.code} type="button"
                  onClick={() => { setCurrency(c.code); setShowCurrencyPicker(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm border-b border-gray-50 last:border-0 flex items-center gap-3 ${
                    currency === c.code ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}>
                  <span className="w-6 text-base">{c.symbol}</span>
                  <span className="flex-1 text-gray-800">{c.name}</span>
                  <span className="text-gray-400 text-xs">{c.code}</span>
                  {currency === c.code && <span className="text-blue-600 font-bold">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Range mode — B3.4 */}
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">Quantity / Price mode</label>
          <div className="flex gap-2 flex-wrap">
            {RANGE_MODES.map(m => (
              <button key={m.id} type="button" onClick={() => setRangeMode(m.id)}
                className={`px-3 py-1.5 rounded-full text-xs border font-medium transition-colors ${
                  rangeMode === m.id ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600'
                }`}>{m.label}</button>
            ))}
          </div>
          {rangeMode !== 'fixed' && (
            <div className="text-xs text-blue-600 mt-1.5 bg-blue-50 px-3 py-1.5 rounded-lg">
              {rangeMode === 'qty_range'   && 'Enter min and max quantity per item. Price is fixed.'}
              {rangeMode === 'price_range' && 'Enter min and max price per item. Quantity is fixed.'}
              {rangeMode === 'both'        && 'Enter min and max for both quantity and price.'}
            </div>
          )}
        </div>

        {/* Line items */}
        <div>
          <label className="text-xs text-gray-500 mb-2 block">
            Items {rangeMode !== 'fixed' && <span className="text-blue-600">(range mode active)</span>}
          </label>
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={item.id} className="border border-gray-200 rounded-xl p-3 space-y-2 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-medium">Item {idx + 1}</span>
                  {items.length > 1 && (
                    <button type="button" onClick={() => setItems(p => p.filter(i => i.id !== item.id))}
                      className="text-red-400 text-xs">Remove</button>
                  )}
                </div>
                <input type="text" placeholder="Description / product name"
                  value={item.particulars} onChange={e => updateItem(item.id, 'particulars', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>

                <div className="grid grid-cols-3 gap-2">
                  {/* Quantity fields */}
                  {(rangeMode === 'fixed' || rangeMode === 'price_range') && (
                    <input type="number" placeholder="Qty"
                      value={item.quantity} onChange={e => updateItem(item.id,'quantity',e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:border-blue-500"/>
                  )}
                  {(rangeMode === 'qty_range' || rangeMode === 'both') && (
                    <>
                      <input type="number" placeholder="Qty min"
                        value={item.qty_min} onChange={e => updateItem(item.id,'qty_min',e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:border-blue-500"/>
                      <input type="number" placeholder="Qty max"
                        value={item.qty_max} onChange={e => updateItem(item.id,'qty_max',e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:border-blue-500"/>
                    </>
                  )}
                  {/* Price fields */}
                  {(rangeMode === 'fixed' || rangeMode === 'qty_range') && (
                    <input type="number" placeholder={`${sym} Price`}
                      value={item.price} onChange={e => updateItem(item.id,'price',e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:border-blue-500"/>
                  )}
                  {(rangeMode === 'price_range' || rangeMode === 'both') && (
                    <>
                      <input type="number" placeholder={`${sym} min`}
                        value={item.price_min} onChange={e => updateItem(item.id,'price_min',e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:border-blue-500"/>
                      <input type="number" placeholder={`${sym} max`}
                        value={item.price_max} onChange={e => updateItem(item.id,'price_max',e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:border-blue-500"/>
                    </>
                  )}
                </div>

                {/* Item total */}
                {calcItemTotal(item, rangeMode, currency) && (
                  <div className="text-right text-xs font-medium text-blue-600">
                    = {calcItemTotal(item, rangeMode, currency)}
                  </div>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setItems(p => [...p, emptyItem()])}
            className="mt-2 w-full border border-dashed border-gray-300 rounded-xl py-2.5 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors">
            + Add item
          </button>
        </div>

        {/* Grand total — B3.4 */}
        {grandTotal && (
          <div className="bg-gray-50 rounded-xl px-4 py-3 flex justify-between items-center">
            <span className="text-xs text-gray-500">
              {rangeMode === 'fixed' ? 'Total' : 'Estimated total range'}
            </span>
            <span className="text-sm font-bold text-blue-600">{grandTotal}</span>
          </div>
        )}

        {/* Optional subject */}
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">Note (optional)</label>
          <textarea rows={2} placeholder="Additional notes..."
            value={subject} onChange={e => setSubject(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500"/>
        </div>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button type="submit"
          className="w-full bg-blue-600 text-white rounded-xl py-3 text-sm font-medium active:scale-98 transition-transform">
          Review and send →
        </button>
      </form>

      {/* Send confirmation modal — B3.4 */}
      {showConfirm && (
        <ConfirmModal
          data={{
            to: toEntities.length === 1
              ? toEntities[0].display_name
              : `${toEntities.length} receivers`,
            purpose:   purpose.replace('_',' '),
            itemCount: items.filter(i => i.particulars).length,
            currency,
            total:     grandTotal,
          }}
          onConfirm={handleConfirmedSend}
          onEdit={() => setShowConfirm(false)}
          loading={loading}
        />
      )}
    </Layout>
  );
}
