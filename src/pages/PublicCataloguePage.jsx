// src/pages/PublicCataloguePage.jsx — B3.7 public storefront + order-first flow
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicCatalogue, startOrder, confirmOrder } from '../api/client';

export default function PublicCataloguePage() {
  const { bridgeId } = useParams();
  const [shop, setShop]     = useState(null);
  const [fields, setFields] = useState([]);
  const [values, setValues] = useState({});
  const [step, setStep]     = useState('browse');   // browse | phone | otp | done
  const [phone, setPhone]   = useState('');
  const [name, setName]     = useState('');
  const [otp, setOtp]       = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [done, setDone]     = useState(null);
  const [err, setErr]       = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await getPublicCatalogue(bridgeId);
        setShop(r.data.shop); setFields(r.data.fields || []);
      } catch (e) { setErr(e.response?.data?.message || 'Catalogue not available'); }
      setLoading(false);
    })();
  }, [bridgeId]);

  const lineItem = () => {
    const item = {}; fields.forEach(f => { item[f.field_key] = values[f.field_key] ?? ''; });
    const price = parseFloat(values.price || 0), qty = parseFloat(values.quantity || 1);
    if (!isNaN(price)) item.total = Math.round(price * qty * 100) / 100;
    // map the product/first text field to `particulars` so the shop's chit detail renders it
    const firstText = fields.find(f => f.field_type !== 'number');
    item.particulars = values.product ?? (firstText ? values[firstText.field_key] : '') ?? '';
    item.quantity = qty;
    if (!isNaN(price)) item.price = price;
    return item;
  };

  const beginPhone = () => {
    const missing = fields.filter(f => f.required && !values[f.field_key]);
    if (missing.length) return setErr(`Please fill: ${missing.map(f => f.field_name).join(', ')}`);
    setErr(''); setStep('phone');
  };
  const sendOtp = async () => {
    try { const r = await startOrder(bridgeId, { phone, name }); setDevOtp(r.data.dev_otp || ''); setErr(''); setStep('otp'); }
    catch (e) { setErr(e.response?.data?.message || 'Could not send code'); }
  };
  const placeOrder = async () => {
    try {
      const r = await confirmOrder(bridgeId, { phone, otp, line_items: [lineItem()] });
      setDone(r.data); setStep('done');
    } catch (e) { setErr(e.response?.data?.message || 'Order failed'); }
  };

  if (loading) return <Shell><p className="text-sm text-gray-400">Loading…</p></Shell>;
  if (!shop)   return <Shell><p className="text-sm text-red-600">{err || 'Shop not found'}</p></Shell>;

  return (
    <Shell>
      <div className="text-xs text-blue-600 uppercase tracking-wide font-semibold">{shop.display_name}</div>
      <h1 className="text-lg font-semibold text-gray-800 mb-3">Place an order</h1>
      {err && <div className="bg-red-50 text-red-700 text-xs p-2 rounded-lg mb-3">{err}</div>}

      {step === 'browse' && (<>
        {fields.map(f => (
          <div key={f.field_key} className="mb-3">
            <label className="text-xs text-gray-500">{f.field_name}{f.required && ' *'}</label>
            <input type={f.field_type === 'number' ? 'number' : 'text'}
              value={values[f.field_key] || ''}
              onChange={e => setValues({ ...values, [f.field_key]: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
        ))}
        <button onClick={beginPhone} className="w-full bg-blue-600 text-white text-sm font-medium py-3 rounded-lg mt-2">Continue</button>
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
