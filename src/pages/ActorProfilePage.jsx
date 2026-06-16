// src/pages/ActorProfilePage.jsx — B3.4
// Actor views own profile and changes PIN
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { changeActorPin, actorBreak } from '../api/client';

export default function ActorProfilePage() {
  const { entity, actorKey, actorRole, parentEntity, logout, updateEntity } = useAuth();
  const navigate = useNavigate();

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin]         = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinMsg, setPinMsg]         = useState('');
  const [pinErr, setPinErr]         = useState('');

  const [breakType, setBreakType]   = useState(null);
  const [breakLoading, setBreakLoading] = useState(false);
  const [breakMsg, setBreakMsg]     = useState('');

  const handleChangePin = async (e) => {
    e.preventDefault();
    if (newPin !== confirmPin) { setPinErr('New PINs do not match'); return; }
    setPinLoading(true); setPinErr(''); setPinMsg('');
    try {
      await changeActorPin({ current_pin: currentPin, new_pin: newPin, confirm_pin: confirmPin });
      setPinMsg('PIN changed successfully');
      setCurrentPin(''); setNewPin(''); setConfirmPin('');
    } catch (err) {
      setPinErr(err.response?.data?.message || 'Change PIN failed');
    } finally { setPinLoading(false); }
  };

  const handleBreak = async (type) => {
    setBreakLoading(true); setBreakMsg('');
    try {
      if (type === 'end') {
        await actorBreak({ break_type: 'end_break' });
        updateEntity({ break_status: 'active' });
        setBreakMsg('Break ended — you are now active');
      } else {
        await actorBreak({ break_type: type, task_action: type === 'leave' ? 'pool' : undefined });
        updateEntity({ break_status: type });
        setBreakMsg(type === 'short_break' ? 'Short break started' : 'Leave started — tasks returned to pool');
      }
    } catch (err) {
      setBreakMsg(err.response?.data?.message || 'Break action failed');
    } finally { setBreakLoading(false); }
  };

  const isOnBreak = entity?.break_status && entity.break_status !== 'active';

  return (
    <Layout title="My Profile">
      <div className="max-w-lg mx-auto p-4 space-y-4">

        {/* Profile card */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-base font-bold">
              {(entity?.display_name || actorKey || 'CA').slice(0,2).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">{entity?.display_name}</div>
              <div className="text-xs text-gray-500 font-mono mt-0.5">
                {actorKey}@{parentEntity}
              </div>
              {actorRole && <div className="text-xs text-green-700 mt-0.5">{actorRole}</div>}
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 bg-gray-50 rounded-lg text-center py-2">
              <div className="text-lg font-bold text-gray-800">{entity?.current_task_count || 0}</div>
              <div className="text-xs text-gray-400">Active tasks</div>
            </div>
            <div className="flex-1 bg-gray-50 rounded-lg text-center py-2">
              <div className={`text-sm font-medium ${isOnBreak ? 'text-amber-600' : 'text-green-600'}`}>
                {isOnBreak
                  ? entity?.break_status === 'short_break' ? '☕ On break' : '🏖 On leave'
                  : '✓ Active'}
              </div>
              <div className="text-xs text-gray-400">Status</div>
            </div>
          </div>
        </div>

        {/* Break management */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-sm font-medium text-gray-800 mb-3">Break management</div>
          {breakMsg && (
            <div className="text-xs bg-blue-50 text-blue-700 px-3 py-2 rounded-lg mb-3 border border-blue-200">
              {breakMsg}
            </div>
          )}
          {isOnBreak ? (
            <button onClick={() => handleBreak('end')} disabled={breakLoading}
              className="w-full bg-green-600 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50">
              {breakLoading ? 'Ending...' : '✓ End break — go active'}
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => handleBreak('short_break')} disabled={breakLoading}
                className="flex-1 border border-blue-200 bg-blue-50 text-blue-700 rounded-xl py-2.5 text-xs font-medium disabled:opacity-50">
                ☕ Short break
              </button>
              <button onClick={() => handleBreak('leave')} disabled={breakLoading}
                className="flex-1 border border-amber-200 bg-amber-50 text-amber-700 rounded-xl py-2.5 text-xs font-medium disabled:opacity-50">
                🏖 Leave
              </button>
            </div>
          )}
          <div className="text-xs text-gray-400 mt-2">
            Short break: tasks held for you. Leave: tasks returned to entity pool.
          </div>
        </div>

        {/* Change PIN */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-sm font-medium text-gray-800 mb-3">Change PIN</div>
          {pinMsg && (
            <div className="text-xs bg-green-50 text-green-700 px-3 py-2 rounded-lg mb-3 border border-green-200">{pinMsg}</div>
          )}
          {pinErr && (
            <div className="text-xs bg-red-50 text-red-700 px-3 py-2 rounded-lg mb-3 border border-red-200">{pinErr}</div>
          )}
          <form onSubmit={handleChangePin} className="space-y-3">
            {[
              { val: currentPin, set: setCurrentPin, label: 'Current PIN' },
              { val: newPin, set: setNewPin, label: 'New PIN' },
              { val: confirmPin, set: setConfirmPin, label: 'Confirm new PIN',
                ok: confirmPin.length === 4 && newPin === confirmPin,
                err: confirmPin.length === 4 && newPin !== confirmPin },
            ].map((f,i) => (
              <div key={i}>
                <label className="text-xs text-gray-500 mb-1 block">{f.label}</label>
                <input type="password" inputMode="numeric" maxLength={4}
                  value={f.val} onChange={e => f.set(e.target.value.replace(/\D/g,'').slice(0,4))}
                  placeholder="• • • •" required
                  className={`w-full border rounded-lg px-3 py-3 text-center text-xl tracking-widest font-mono focus:outline-none ${
                    f.ok ? 'border-green-400 bg-green-50'
                    : f.err ? 'border-red-400 bg-red-50'
                    : 'border-gray-200 focus:border-green-500'
                  }`}/>
              </div>
            ))}
            <button type="submit" disabled={pinLoading || currentPin.length !== 4 || newPin.length !== 4 || newPin !== confirmPin}
              className="w-full bg-green-600 text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40">
              {pinLoading ? 'Changing...' : 'Change PIN'}
            </button>
          </form>
        </div>

        <button onClick={() => { logout(); navigate('/login'); }}
          className="w-full border border-red-200 text-red-600 rounded-xl py-3 text-sm font-medium">
          🚪 Logout
        </button>
      </div>
    </Layout>
  );
}
