// src/pages/CoAssistsPage.jsx — Co-Assist management page
import { useState, useEffect, useRef } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useAppMode } from '../context/AppModeContext';
import {
  listActors, createActor, suggestActorKey, checkActorKey,
  resetActorOTP, updateActorStatus
} from '../api/client';

const ROLES = ['Purchase','Sales','Dispatch','Accounts','Operations','Management'];

const STATUS_COLOUR = {
  active:      'bg-green-100 text-green-800',
  short_break: 'bg-amber-100 text-amber-800',
  leave:       'bg-amber-100 text-amber-800',
  deactivated: 'bg-gray-100 text-gray-600',
  removed:     'bg-red-100 text-red-800',
};

const STATUS_DOT = {
  active:      'bg-green-500',
  short_break: 'bg-amber-400',
  leave:       'bg-amber-400',
  deactivated: 'bg-gray-400',
  removed:     'bg-red-500',
};

const Avatar = ({ name, status }) => (
  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${
    status === 'active' ? 'bg-blue-100 text-blue-700' :
    status === 'removed' ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-500'
  }`}>
    {(name || 'CA').slice(0,2).toUpperCase()}
  </div>
);

export default function CoAssistsPage() {
  const { entity } = useAuth();
  const { mode }   = useAppMode();
  const [actors, setActors]       = useState([]);
  const [summary, setSummary]     = useState({});
  const [filter, setFilter]       = useState('active');
  const [loading, setLoading]     = useState(true);
  const [view, setView]           = useState('list'); // list | add | detail | otp
  const [selected, setSelected]   = useState(null);
  const [otp, setOtp]             = useState(null);
  const [msg, setMsg]             = useState('');
  const [form, setForm]           = useState({
    display_name:'', actor_key:'', actor_role:'', phone:'', max_tasks:10
  });
  const [keyStatus, setKeyStatus] = useState(null); // null | checking | available | taken
  const [loginFormat, setLoginFormat] = useState('');
  const [creating, setCreating]   = useState(false);
  const [confirmRemove, setConfirmRemove] = useState('');
  const timerRef = useRef(null);

  useEffect(() => { loadActors(); }, [filter]);

  const loadActors = async () => {
    setLoading(true);
    try {
      const res = await listActors({ status: filter });
      setActors(res.data.actors || []);
      setSummary(res.data.summary || {});
    } catch {}
    setLoading(false);
  };

  const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  // Suggest key as name typed
  const handleNameChange = async (name) => {
    setForm(f => ({ ...f, display_name: name }));
    if (name.length < 2) { setKeyStatus(null); setLoginFormat(''); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await suggestActorKey(name);
        const suggested = res.data.suggested_key;
        setForm(f => ({ ...f, actor_key: suggested }));
        setKeyStatus(res.data.available ? 'available' : 'taken');
        setLoginFormat(res.data.login_format || '');
      } catch {}
    }, 400);
  };

  // Check key availability when manually changed
  const handleKeyChange = async (key) => {
    const cleaned = key.toLowerCase().replace(/[^a-z0-9]/g,'');
    setForm(f => ({ ...f, actor_key: cleaned }));
    if (cleaned.length < 4) { setKeyStatus(null); return; }
    setKeyStatus('checking');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await checkActorKey(cleaned);
        setKeyStatus(res.data.available ? 'available' : 'taken');
        setLoginFormat(res.data.login_format || '');
      } catch {}
    }, 300);
  };

  const handleCreate = async () => {
    if (!form.display_name || !form.actor_key || keyStatus !== 'available') return;
    setCreating(true);
    try {
      const res = await createActor(form);
      setOtp(res.data.otp);
      setLoginFormat(res.data.actor?.login_format || '');
      setView('otp');
      loadActors();
    } catch (err) {
      showMsg(err.response?.data?.message || 'Create failed');
    } finally { setCreating(false); }
  };

  const handleResetOTP = async (actor_id) => {
    try {
      const res = await resetActorOTP(actor_id);
      setOtp(res.data.otp);
      setLoginFormat(res.data.login_format || '');
      setView('otp');
    } catch (err) {
      showMsg(err.response?.data?.message || 'Reset failed');
    }
  };

  const handleDeactivate = async (actor_id) => {
    try {
      await updateActorStatus(actor_id, { action: 'deactivate', task_action: 'pool' });
      showMsg('Co-assist deactivated — tasks returned to pool');
      setView('list'); loadActors();
    } catch (err) {
      showMsg(err.response?.data?.message || 'Deactivate failed');
    }
  };

  const handleReactivate = async (actor_id) => {
    try {
      const res = await updateActorStatus(actor_id, { action: 'reactivate' });
      setOtp(res.data.otp);
      setLoginFormat(res.data.login_format || '');
      setView('otp'); loadActors();
    } catch (err) {
      showMsg(err.response?.data?.message || 'Reactivate failed');
    }
  };

  const handleRemove = async (actor_id) => {
    if (confirmRemove !== 'REMOVE') { showMsg('Type REMOVE to confirm'); return; }
    try {
      await updateActorStatus(actor_id, { action: 'remove', task_action: 'pool', confirm: 'REMOVE' });
      showMsg('Co-assist permanently removed');
      setView('list'); loadActors(); setConfirmRemove('');
    } catch (err) {
      showMsg(err.response?.data?.message || 'Remove failed');
    }
  };

  const FILTERS = [
    { id:'active',      label:`Active (${summary.active||0})` },
    { id:'leave',       label:`On leave (${summary.on_break||0})` },
    { id:'inactive',    label:`Inactive (${summary.deactivated||0})` },
    { id:'removed',     label:`Removed (${summary.removed||0})` },
  ];

  // ── OTP SCREEN ──────────────────────────────────────────────
  if (view === 'otp') return (
    <Layout title="Co-Assist created">
      <div className="p-4 max-w-lg mx-auto">
        <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
          <div className="text-4xl mb-3">✅</div>
          <div className="text-sm font-medium text-gray-800 mb-1">Co-Assist ready</div>
          <div className="text-xs text-gray-400 mb-6">{loginFormat}</div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <div className="text-xs text-amber-700 mb-2 font-medium">One time password — share with co-assist</div>
            <div className="text-3xl font-bold tracking-widest text-amber-900 font-mono">{otp}</div>
            {mode === 'dev' && (
              <div className="text-xs text-amber-600 mt-2">🔨 Dev mode — DEV_OTP fixed</div>
            )}
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-left text-xs text-green-800 mb-6">
            <div className="font-medium mb-1">Tell them to login as:</div>
            <div className="font-mono">{loginFormat}</div>
            <div className="mt-1">OTP: <span className="font-mono font-bold">{otp}</span></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setView('add'); setForm({ display_name:'', actor_key:'', actor_role:'', phone:'', max_tasks:10 }); setKeyStatus(null); }}
              className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-lg">
              Add another
            </button>
            <button onClick={() => setView('list')}
              className="flex-1 bg-blue-600 text-white text-sm py-2.5 rounded-lg font-medium">
              Done
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );

  // ── ADD FORM ────────────────────────────────────────────────
  if (view === 'add') return (
    <Layout title="Add Co-Assist">
      <div className="p-4 max-w-lg mx-auto flex flex-col gap-4">
        {msg && <div className="bg-red-50 text-red-700 text-xs p-3 rounded-xl border border-red-200">{msg}</div>}

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-4">Co-Assist details</div>

          {/* Full name */}
          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-1 block">Full name *</label>
            <input type="text" placeholder="Ravi Kumar"
              value={form.display_name} onChange={e => handleNameChange(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm w-full focus:outline-none focus:border-blue-500"/>
          </div>

          {/* Login key */}
          <div className="mb-2">
            <label className="text-xs text-gray-500 mb-1 block">Login short name * (min 4 chars)</label>
            <div className="flex items-center gap-2">
              <input type="text" placeholder="ravik"
                value={form.actor_key}
                onChange={e => handleKeyChange(e.target.value)}
                className={`border rounded-lg px-3 py-2.5 text-sm flex-1 font-mono focus:outline-none ${
                  keyStatus === 'available' ? 'border-green-400 bg-green-50' :
                  keyStatus === 'taken' ? 'border-red-400 bg-red-50' :
                  'border-gray-200'
                }`}/>
              <span className="text-sm text-gray-400">@{entity?.display_name}</span>
            </div>
            {keyStatus === 'available' && (
              <div className="text-xs text-green-600 mt-1">✓ {loginFormat} is available</div>
            )}
            {keyStatus === 'taken' && (
              <div className="text-xs text-red-600 mt-1">✗ Already taken — try a different name</div>
            )}
            {keyStatus === 'checking' && (
              <div className="text-xs text-gray-400 mt-1">Checking availability...</div>
            )}
          </div>

          {/* Login preview */}
          {keyStatus === 'available' && loginFormat && (
            <div className="bg-green-50 rounded-lg px-3 py-2 mb-4 text-xs text-green-700">
              🔑 Login format: <span className="font-mono font-medium">{loginFormat}</span>
            </div>
          )}

          {/* Role */}
          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-1 block">Role (optional)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {ROLES.map(r => (
                <button key={r} onClick={() => setForm(f => ({ ...f, actor_role: f.actor_role === r ? '' : r }))}
                  className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                    form.actor_role === r ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                  {r}
                </button>
              ))}
            </div>
            <input type="text" placeholder="Or type custom role"
              value={form.actor_role} onChange={e => setForm(f => ({ ...f, actor_role: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-blue-500"/>
          </div>

          {/* Phone */}
          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-1 block">Phone (optional — admin reference only)</label>
            <input type="tel" placeholder="9876543210"
              value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm w-full focus:outline-none focus:border-blue-500"/>
          </div>

          {/* Max tasks */}
          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-1 block">Max tasks (default 10)</label>
            <input type="number" min="1" max="100"
              value={form.max_tasks} onChange={e => setForm(f => ({ ...f, max_tasks: parseInt(e.target.value) || 10 }))}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm w-full focus:outline-none focus:border-blue-500"/>
            <div className="text-xs text-gray-400 mt-1">Warning shown when exceeded</div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setView('list')}
              className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-lg">
              Cancel
            </button>
            <button onClick={handleCreate}
              disabled={creating || keyStatus !== 'available' || !form.display_name}
              className="flex-1 bg-blue-600 text-white text-sm py-2.5 rounded-lg font-medium disabled:opacity-40">
              {creating ? 'Creating...' : 'Create and get OTP'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );

  // ── DETAIL SCREEN ───────────────────────────────────────────
  if (view === 'detail' && selected) return (
    <Layout title={selected.display_name}>
      <div className="p-4 max-w-lg mx-auto flex flex-col gap-4">
        {msg && <div className="bg-blue-50 text-blue-700 text-xs p-3 rounded-xl border border-blue-200">{msg}</div>}

        {/* Profile card */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
          <Avatar name={selected.display_name} status={selected.break_status}/>
          <div className="mt-3 text-sm font-medium text-gray-900">{selected.display_name}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {selected.actor_role || 'No role'} · {selected.actor_key}@{entity?.display_name}
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <div className={`w-2 h-2 rounded-full ${STATUS_DOT[selected.break_status] || 'bg-gray-400'}`}/>
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOUR[selected.break_status]}`}>
              {selected.break_status}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-blue-600">{selected.current_task_count || 0}</div>
              <div className="text-xs text-gray-400">Active tasks</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-700">{selected.max_tasks || 10}</div>
              <div className="text-xs text-gray-400">Max tasks</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-600">
                {selected.current_task_count > 0
                  ? Math.round((selected.current_task_count / (selected.max_tasks || 10)) * 100)
                  : 0}%
              </div>
              <div className="text-xs text-gray-400">Load</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">Actions</div>
          <div className="flex flex-col gap-2">
            <button onClick={() => handleResetOTP(selected.identity_id)}
              className="w-full text-left text-sm text-blue-600 border border-blue-200 px-4 py-2.5 rounded-lg bg-blue-50">
              🔑 Reset OTP — generate new access code
            </button>
            {selected.break_status === 'active' && (
              <button onClick={() => handleDeactivate(selected.identity_id)}
                className="w-full text-left text-sm text-amber-700 border border-amber-200 px-4 py-2.5 rounded-lg bg-amber-50">
                ⏸️ Deactivate — temporary — can reactivate
              </button>
            )}
            {selected.break_status === 'deactivated' && (
              <button onClick={() => handleReactivate(selected.identity_id)}
                className="w-full text-left text-sm text-green-700 border border-green-200 px-4 py-2.5 rounded-lg bg-green-50">
                ▶️ Reactivate — generate new OTP
              </button>
            )}
            {selected.break_status !== 'removed' && (
              <div className="border border-red-200 rounded-lg p-3 bg-red-50">
                <div className="text-xs text-red-700 font-medium mb-2">⚠️ Remove permanently — cannot undo</div>
                <input type="text" placeholder="Type REMOVE to confirm"
                  value={confirmRemove} onChange={e => setConfirmRemove(e.target.value)}
                  className="border border-red-200 rounded-lg px-3 py-2 text-sm w-full mb-2 focus:outline-none bg-white"/>
                <button onClick={() => handleRemove(selected.identity_id)}
                  disabled={confirmRemove !== 'REMOVE'}
                  className="w-full bg-red-600 text-white text-sm py-2 rounded-lg disabled:opacity-40 font-medium">
                  Remove permanently
                </button>
              </div>
            )}
          </div>
        </div>

        <button onClick={() => setView('list')}
          className="text-blue-600 text-sm text-center">
          ← Back to Co-Assists
        </button>
      </div>
    </Layout>
  );

  // ── LIST VIEW ───────────────────────────────────────────────
  return (
    <Layout title="Co-Assists">
      <div className="flex flex-col max-w-lg mx-auto">
        {msg && <div className="mx-4 mt-3 text-xs bg-blue-50 text-blue-700 p-3 rounded-xl border border-blue-200">{msg}</div>}

        {/* Summary bar */}
        <div className="grid grid-cols-4 gap-0 mx-4 mt-4 bg-white rounded-xl border border-gray-100 overflow-hidden">
          {[
            { label:'Active',   val: summary.active||0,      colour:'text-green-600' },
            { label:'On leave', val: summary.on_break||0,    colour:'text-amber-600' },
            { label:'Inactive', val: summary.deactivated||0, colour:'text-gray-500' },
            { label:'Removed',  val: summary.removed||0,     colour:'text-red-500' },
          ].map((item,i) => (
            <div key={i} className={`text-center p-3 ${i < 3 ? 'border-r border-gray-100' : ''}`}>
              <div className={`text-lg font-bold ${item.colour}`}>{item.val}</div>
              <div className="text-xs text-gray-400">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 px-4 py-3 overflow-x-auto">
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 transition-colors ${
                filter === f.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Add button */}
        <div className="mx-4 mb-3">
          <button onClick={() => { setView('add'); setForm({ display_name:'', actor_key:'', actor_role:'', phone:'', max_tasks:10 }); setKeyStatus(null); }}
            className="w-full border-2 border-dashed border-blue-200 text-blue-600 text-sm py-3 rounded-xl hover:border-blue-400 transition-colors">
            + Add co-assist
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
        ) : actors.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">👤</div>
            <div className="text-sm">No co-assists in this group</div>
          </div>
        ) : (
          <div className="px-4 flex flex-col gap-3">
            {actors.map(actor => (
              <div key={actor.identity_id}
                className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 cursor-pointer active:bg-gray-50"
                onClick={() => { setSelected(actor); setView('detail'); setConfirmRemove(''); }}>
                <Avatar name={actor.display_name} status={actor.break_status}/>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${actor.break_status === 'removed' ? 'line-through text-red-400' : 'text-gray-900'}`}>
                    {actor.display_name}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {actor.actor_role || 'No role'} · {actor.actor_key}
                  </div>
                  {actor.return_date && (
                    <div className="text-xs text-amber-600 mt-0.5">Returns {actor.return_date}</div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOUR[actor.break_status] || 'bg-gray-100 text-gray-600'}`}>
                    {actor.break_status}
                  </div>
                  {actor.break_status === 'active' && (
                    <div className="text-xs text-gray-400 mt-1">{actor.current_task_count || 0} tasks</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
