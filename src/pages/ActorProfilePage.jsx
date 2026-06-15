// src/pages/ActorProfilePage.jsx
// Actor's own profile — change PIN
import { useState } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { changeActorPin } from '../api/client';

export default function ActorProfilePage() {
  const { entity, actorKey, parentEntity, actorRole } = useAuth();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin]         = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  const handleChange = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (newPin.length !== 4) { setError('New PIN must be 4 digits'); return; }
    if (newPin !== confirmPin) { setError('New PINs do not match'); return; }
    if (newPin === currentPin) { setError('New PIN must be different from current PIN'); return; }
    setLoading(true);
    try {
      await changeActorPin({
        current_pin: currentPin,
        new_pin: newPin,
        confirm_pin: confirmPin
      });
      setSuccess('PIN changed successfully');
      setCurrentPin(''); setNewPin(''); setConfirmPin('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change PIN');
    } finally { setLoading(false); }
  };

  return (
    <Layout title="My Profile">
      <div className="p-4 max-w-lg mx-auto flex flex-col gap-4">

        {/* Profile card */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-xl font-bold text-green-700 mx-auto mb-3">
            {(entity?.display_name || actorKey || 'CA').slice(0,2).toUpperCase()}
          </div>
          <div className="text-sm font-medium text-gray-900">{entity?.display_name}</div>
          <div className="text-xs text-gray-400 mt-0.5 font-mono">{actorKey}@{parentEntity}</div>
          {actorRole && (
            <div className="text-xs text-gray-500 mt-1">{actorRole}</div>
          )}
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <div className="w-2 h-2 rounded-full bg-green-500"/>
            <span className="text-xs text-green-700">Active co-assist</span>
          </div>
        </div>

        {/* Change PIN */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-4">Change PIN</div>

          {error && (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg mb-4 border border-red-200">{error}</div>
          )}
          {success && (
            <div className="bg-green-50 text-green-700 text-xs p-3 rounded-lg mb-4 border border-green-200">✓ {success}</div>
          )}

          <form onSubmit={handleChange} className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Current PIN</label>
              <input type="password" inputMode="numeric" maxLength={4}
                placeholder="• • • •"
                value={currentPin}
                onChange={e => setCurrentPin(e.target.value.replace(/\D/g,'').slice(0,4))}
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-center text-xl tracking-widest w-full focus:outline-none focus:border-blue-500 font-mono"/>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">New PIN</label>
              <input type="password" inputMode="numeric" maxLength={4}
                placeholder="• • • •"
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g,'').slice(0,4))}
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-center text-xl tracking-widest w-full focus:outline-none focus:border-blue-500 font-mono"/>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Confirm new PIN</label>
              <input type="password" inputMode="numeric" maxLength={4}
                placeholder="• • • •"
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g,'').slice(0,4))}
                className={`border rounded-lg px-3 py-2.5 text-center text-xl tracking-widest w-full focus:outline-none font-mono ${
                  confirmPin.length === 4
                    ? newPin === confirmPin ? 'border-green-400' : 'border-red-400'
                    : 'border-gray-300 focus:border-blue-500'
                }`}/>
            </div>
            <button type="submit"
              disabled={loading || currentPin.length !== 4 || newPin.length !== 4 || newPin !== confirmPin}
              className="bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-40 mt-1">
              {loading ? 'Updating...' : 'Update PIN'}
            </button>
          </form>

          <div className="mt-4 bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
            Forgot your current PIN? Ask your admin to reset your access.
            You will get a new OTP and can set a new PIN.
          </div>
        </div>

      </div>
    </Layout>
  );
}
