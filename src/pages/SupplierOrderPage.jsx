// src/pages/SupplierOrderPage.jsx — order from a supplier's catalogue (mirrors PHP supplierCompose)
// Entity picks products from the SUPPLIER's published catalogue and drafts a chit to them.
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { getSupplierCatalogue, sendChit } from '../api/client';

export default function SupplierOrderPage() {
  const { supplierId } = useParams();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState(null);
  const [fields, setFields]   = useState([]);
  const [items, setItems]     = useState([]);
  const [qty, setQty]         = useState({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [err, setErr]         = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await getSupplierCatalogue(supplierId);
        setSupplier(r.data.supplier); setFields(r.data.fields || []); setItems(r.data.items || []);
      } catch (e) { setErr(e.response?.data?.message || 'Could not load supplier catalogue'); }
      setLoading(false);
    })();
  }, [supplierId]);

  const productFields = fields.filter(f => f.field_key !== 'quantity');
  const labelOf = (it) => productFields.map(f => it.item_data[f.field_key]).filter(Boolean).join(' · ');

  // build order line items from the products the entity gave a quantity to
  const lineItems = () => items
    .filter(it => parseFloat(qty[it.item_id] || 0) > 0)
    .map(it => {
      const q = parseFloat(qty[it.item_id]);
      const price = parseFloat(it.item_data.price || 0);
      const firstText = productFields.find(f => f.field_type !== 'number');
      const particulars = it.item_data.product ?? (firstText ? it.item_data[firstText.field_key] : '') ?? '';
      return { ...it.item_data, particulars, quantity: q, price, total: Math.round(price * q * 100) / 100 };
    });

  const placeOrder = async () => {
    const li = lineItems();
    if (li.length === 0) { setErr('Add a quantity to at least one product'); return; }
    setSending(true); setErr('');
    try {
      await sendChit({
        receivers:  [{ entity_id: supplierId }],
        purpose:    'order',
        line_items: li,
        business_json: { currency: supplier?.currency_code || 'INR' },
      });
      navigate('/order');
    } catch (e) { setErr(e.response?.data?.message || 'Order failed'); }
    finally { setSending(false); }
  };

  return (
    <Layout title="Order from supplier">
      <div className="p-4 max-w-lg mx-auto">
        {loading ? (
          <div className="text-sm text-gray-400 text-center py-8">Loading supplier catalogue…</div>
        ) : (<>
          <div className="mb-3">
            <div className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Order from supplier</div>
            <div className="text-lg font-semibold text-gray-800">{supplier?.display_name || '—'}</div>
            {supplier?.bridge_id && <div className="text-xs text-gray-400 font-mono">{supplier.bridge_id}</div>}
          </div>

          {supplier?.business_status === 'closed' && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-2 mb-3">
              Note: this supplier is currently <b>Closed</b> — they may not respond until they reopen.
            </div>
          )}
          {err && <div className="bg-red-50 text-red-700 text-xs p-2 rounded-lg mb-3">{err}</div>}

          {items.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-8 bg-gray-50 rounded-lg border border-gray-100">
              This supplier hasn't published any products yet.
              <button onClick={() => navigate('/send')} className="block mx-auto mt-3 text-blue-600 text-xs">
                Compose a free-form chit instead
              </button>
            </div>
          ) : (<>
            <div className="text-xs text-gray-400 mb-1">Pick products and quantities to order:</div>
            {items.map(it => (
              <div key={it.item_id} className="flex justify-between items-center py-2 border-b border-gray-100">
                <div className="text-sm text-gray-700">{labelOf(it)}</div>
                <input type="number" min="0" placeholder="Qty" value={qty[it.item_id] || ''}
                  onChange={e => setQty({ ...qty, [it.item_id]: e.target.value })}
                  className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right" />
              </div>
            ))}
            <button onClick={placeOrder} disabled={sending}
              className="w-full bg-blue-600 text-white text-sm font-medium py-3 rounded-lg mt-4 disabled:opacity-50">
              {sending ? 'Sending…' : 'Send order to supplier'}
            </button>
          </>)}
        </>)}
      </div>
    </Layout>
  );
}
