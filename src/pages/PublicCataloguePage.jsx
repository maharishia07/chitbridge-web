// src/pages/PublicCataloguePage.jsx — B3.7 public storefront + order-first flow
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicCatalogue, startOrder, confirmOrder, loginVerify, myOrders } from '../api/client';

export default function PublicCataloguePage() {
  const { bridgeId } = useParams();
  const embed = new URLSearchParams(window.location.search).get('embed') === '1';
  const [shop, setShop]     = useState(null);
  const [fields, setFields] = useState([]);
  const [items, setItems]   = useState([]);          // B3.7a products
  const [qty, setQty]       = useState({});          // { item_id: quantity }
  const [step, setStep]     = useState('browse');   // browse | phone | otp | done
  const [phone, setPhone]   = useState('');
  const [name, setName]     = useState('');
  const [otp, setOtp]       = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [done, setDone]     = useState(null);
  const [err, setErr]       = useState('');
  const [loading, setLoading] = useState(true);
  // B3.9 — customer sign-in to view orders
  const [account, setAccount]   = useState('menu');  // menu | signin-phone | signin-otp | orders
  const [orders, setOrders]     = useState([]);
  const [siPhone, setSiPhone]   = useState('');
  const [siOtp, setSiOtp]       = useState('');
  const [siDevOtp, setSiDevOtp] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await getPublicCatalogue(bridgeId);
        setShop(r.data.shop); setFields(r.data.fields || []); setItems(r.data.items || []);
      } catch (e) { setErr(e.response?.data?.message || 'Catalogue not available'); }
      setLoading(false);
    })();
  }, [bridgeId]);

  // product fields = schema fields minus quantity (qty is chosen by the customer)
  const productFields = fields.filter(f => f.field_key !== 'quantity');
  const labelOf = (it) => productFields.map(f => it.item_data[f.field_key]).filter(Boolean).join(' · ');

  // build line items from products the customer gave a quantity to
  const lineItems = () => items
    .filter(it => parseFloat(qty[it.item_id] || 0) > 0)
    .map(it => {
      const q = parseFloat(qty[it.item_id]);
      const price = parseFloat(it.item_data.price || 0);
      const firstText = productFields.find(f => f.field_type !== 'number');
      // map to `particulars` so the shop's chit detail shows the product name
      const particulars = it.item_data.product ?? (firstText ? it.item_data[firstText.field_key] : '') ?? '';
      return { ...it.item_data, particulars, quantity: q, price, total: Math.round(price * q * 100) / 100 };
    });

  const beginPhone = () => {
    if (lineItems().length === 0) return setErr('Add a quantity to at least one product');
    setErr(''); setStep('phone');
  };
  const sendOtp = async () => {
    try { const r = await startOrder(bridgeId, { phone, name }); setDevOtp(r.data.dev_otp || ''); setErr(''); setStep('otp'); }
    catch (e) { setErr(e.response?.data?.message || 'Could not send code'); }
  };
  const placeOrder = async () => {
    try {
      const r = await confirmOrder(bridgeId, { phone, otp, line_items: lineItems() });
      setDone(r.data); setStep('done');
    } catch (e) { setErr(e.response?.data?.message || 'Order failed'); }
  };

  // B3.9 — sign in (phone OTP, no order) and load my orders
  const doSignInStart = async () => {
    try { const r = await startOrder(bridgeId, { phone: siPhone }); setSiDevOtp(r.data.dev_otp || ''); setErr(''); setAccount('signin-otp'); }
    catch (e) { setErr(e.response?.data?.message || 'Could not send code'); }
  };
  const doSignInVerify = async () => {
    try {
      const r = await loginVerify(bridgeId, { phone: siPhone, otp: siOtp });
      const o = await myOrders(bridgeId, r.data.token);
      setOrders(o.data.orders || []); setErr(''); setAccount('orders');
    } catch (e) { setErr(e.response?.data?.message || 'Sign-in failed'); }
  };

  if (loading) return <Shell><p className="text-sm text-gray-400">Loading…</p></Shell>;
  if (!shop)   return <Shell><p className="text-sm text-red-600">{err || 'Shop not found'}</p></Shell>;

  return (
    <Shell>
      {/* Shop identity + trust (B3.9) */}
      <div className="flex items-center gap-3 mb-3">
        {shop.logo_url && <img src={shop.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-gray-800 truncate">{shop.display_name}</span>
            {shop.is_verified && (
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 flex-shrink-0">✓ Verified</span>
            )}
          </div>
          {shop.gstn && <div className="text-xs text-gray-400">GSTIN: {shop.gstn}</div>}
          {shop.address && <div className="text-xs text-gray-400">{shop.address}</div>}
        </div>
      </div>

      {/* B3.11 — shop status banner */}
      {shop.business_status === 'closed' && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-2.5 mb-3 text-center font-medium">
          🔴 This shop is currently <b>Closed</b> — not accepting orders right now.
        </div>
      )}
      {shop.business_status === 'away' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg p-2.5 mb-3 text-center">
          🟡 This shop is <b>Away</b> — you can still order, but replies may take longer.
        </div>
      )}

      {/* Sign in to see your order (hidden in embed mode) */}
      {!embed && account === 'menu' && (
        <div className="text-right mb-2">
          <button onClick={() => { setErr(''); setAccount('signin-phone'); }} className="text-xs text-blue-600 underline">
            Sign in to see your order
          </button>
        </div>
      )}

      {err && <div className="bg-red-50 text-red-700 text-xs p-2 rounded-lg mb-3">{err}</div>}

      {account === 'signin-phone' && (<>
        <h2 className="text-sm font-medium text-gray-700 mb-2">Sign in to see your orders</h2>
        <label className="text-xs text-gray-500">Phone number *</label>
        <input value={siPhone} onChange={e => setSiPhone(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1" />
        <button onClick={doSignInStart} className="w-full bg-blue-600 text-white text-sm font-medium py-3 rounded-lg mt-3">Send code</button>
        <button onClick={() => setAccount('menu')} className="w-full text-xs text-gray-400 mt-2">Back</button>
      </>)}

      {account === 'signin-otp' && (<>
        {siDevOtp && <div className="bg-amber-50 text-amber-700 text-xs p-2 rounded-lg mb-2">Dev OTP: <b>{siDevOtp}</b></div>}
        <label className="text-xs text-gray-500">Enter the 6-digit code</label>
        <input value={siOtp} onChange={e => setSiOtp(e.target.value)} maxLength={6}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 tracking-widest" />
        <button onClick={doSignInVerify} className="w-full bg-blue-600 text-white text-sm font-medium py-3 rounded-lg mt-3">Sign in</button>
        <button onClick={() => setAccount('menu')} className="w-full text-xs text-gray-400 mt-2">Back</button>
      </>)}

      {account === 'orders' && (
        <div className="bg-white border border-gray-100 rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-400">Your orders</div>
            <button onClick={() => setAccount('menu')} className="text-xs text-blue-600">Close</button>
          </div>
          {orders.length === 0 ? <div className="text-xs text-gray-400">No orders yet.</div> :
            orders.map(o => (
              <div key={o.chit_id} className="flex justify-between py-1.5 border-b border-gray-100 last:border-none">
                <span className="text-xs text-gray-700">{o.auto_subject}</span>
                <span className="text-xs font-medium text-blue-600">{o.current_status}</span>
              </div>
            ))}
        </div>
      )}

      {(account === 'menu' || account === 'orders') && shop.business_status === 'closed' && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-sm text-gray-500">
          🔒 This shop is closed right now — ordering is disabled. Please check back later.
        </div>
      )}

      {(account === 'menu' || account === 'orders') && shop.business_status !== 'closed' && (<>
      <h1 className="text-lg font-semibold text-gray-800 mb-3">Place an order</h1>

      {step === 'browse' && (<>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400">This shop hasn't added any products yet.</p>
        ) : items.map(it => (
          <div key={it.item_id} className="flex justify-between items-center py-2 border-b border-gray-100">
            <div className="text-sm text-gray-700">{labelOf(it)}</div>
            <input type="number" min="0" placeholder="Qty" value={qty[it.item_id] || ''}
              onChange={e => setQty({ ...qty, [it.item_id]: e.target.value })}
              className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right" />
          </div>
        ))}
        {items.length > 0 && (
          <button onClick={beginPhone} className="w-full bg-blue-600 text-white text-sm font-medium py-3 rounded-lg mt-3">Continue</button>
        )}
      </>)}

      {step === 'phone' && (<>
        <label className="text-xs text-gray-500">Your name (optional)</label>
        <input value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 mb-3" />
        <label className="text-xs text-gray-500">Phone number *</label>
        <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1" />
        <button onClick={sendOtp} className="w-full bg-blue-600 text-white text-sm font-medium py-3 rounded-lg mt-3">Send code</button>
      </>)}

      {step === 'otp' && (<>
        {devOtp && <div className="bg-amber-50 text-amber-700 text-xs p-2 rounded-lg mb-2">Dev OTP: <b>{devOtp}</b></div>}
        <label className="text-xs text-gray-500">Enter the 6-digit code</label>
        <input value={otp} onChange={e => setOtp(e.target.value)} maxLength={6}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 tracking-widest" />
        <button onClick={placeOrder} className="w-full bg-blue-600 text-white text-sm font-medium py-3 rounded-lg mt-3">Place order</button>
      </>)}

      {step === 'done' && done && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-green-700 text-sm font-medium mb-1">Order placed ✓</div>
          <div className="text-xs text-green-600">Guaranteed order sent to {done.shop}.</div>
          <div className="text-xs text-gray-400 mt-2">Ref: {done.chit_id?.slice(0, 8)}</div>
        </div>
      )}
      </>)}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-md bg-white min-h-screen p-5">{children}</div>
    </div>
  );
}
