// src/pages/SetPinPage.jsx
// Shown after first OTP login — actor sets their own PIN
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setActorPin } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function SetPinPage() {
  const [pin, setPin]           = useState('');
  const [confirmPin, setConfirm]= useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const { entity, actorKey, parentEntity } = useAuth();
  const navigate = useNavigate();

  const handleSet = async (e) => {
    e.preventDefault();
    setError('');
    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
      setError('PIN must be exactly 4 digits'); return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match'); return;
    }
    setLoading(true);
    try {
      await setActorPin({ pin, confirm_pin: confirmPin });
      navigate('/inbox');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to set PIN');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🔐</span>
          </div>
          <h1 className="text-base font-medium text-gray-900">
            Welcome {entity?.display_name}
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            {actorKey}@{parentEntity}
          </p>
          <p className="text-xs text-gray-500 mt-3">
            Set your private 4 digit PIN for future logins.
            Your admin will never see this PIN.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg mb-4 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSet} className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">New PIN (4 digits)</label>
            <input
              type="password" inputMode="numeric" maxLength={4}
              placeholder="• • • •"
              value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,'').slice(0,4))}
              className="border border-gray-300 rounded-lg px-3 py-3 text-center text-2xl tracking-widest w-full focus:outline-none focus:border-green-500 font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Confirm PIN</label>
            <input
              type="password" inputMode="numeric" maxLength={4}
              placeholder="• • • •"
              value={confirmPin} onChange={e => setConfirm(e.target.value.replace(/\D/g,'').slice(0,4))}
              className={`border rounded-lg px-3 py-3 text-center text-2xl tracking-widest w-full focus:outline-none font-mono ${
                confirmPin.length === 4
                  ? pin === confirmPin
                    ? 'border-green-400 bg-green-50'
                    : 'border-red-400 bg-red-50'
                  : 'border-gray-300 focus:border-green-500'
              }`}
            />
            {confirmPin.length === 4 && pin === confirmPin && (
              <div className="text-xs text-green-600 mt-1">✓ PINs match</div>
            )}
          </div>

          <button type="submit"
            disabled={loading || pin.length !== 4 || pin !== confirmPin}
            className="bg-green-600 text-white rounded-lg py-3 text-sm font-medium disabled:opacity-40 mt-2">
            {loading ? 'Setting PIN...' : 'Set PIN and continue'}
          </button>
        </form>

        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="text-xs text-amber-800 font-medium mb-1">Remember your PIN</div>
          <div className="text-xs text-amber-700">
            If you forget your PIN contact your admin.
            They will reset your access and you can set a new PIN.
          </div>
        </div>

      </div>
    </div>
  );
}
