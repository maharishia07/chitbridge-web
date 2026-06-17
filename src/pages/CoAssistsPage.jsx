// src/pages/CoAssistsPage.jsx — B3.4
// B3.4 additions: Load bars per actor, summary counts, age of tasks
import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { listActors, updateActorStatus, resetActorOTP, createActor, suggestActorKey,
         getActorTasks, routeActorTask, clearActorPin } from '../api/client';
import ListControls from '../components/ListControls';
import { filterList } from '../utils/filterList';

const LoadBar = ({ current, max }) => {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0;
  const colour = pct <= 60 ? 'bg-green-500' : pct <= 80 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="mt-1.5">
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colour}`} style={{ width: `${Math.min(pct,100)}%` }}/>
      </div>
      <div className="flex justify-between mt-0.5">
        <span className={`text-xs ${pct > 80 ? 'text-red-600' : pct > 60 ? 'text-amber-600' : 'text-green-600'}`}>
          {current}/{max} tasks
        </span>
        <span className={`text-xs font-medium ${pct > 80 ? 'text-red-600' : pct > 60 ? 'text-amber-600' : 'text-green-600'}`}>
          {pct}%{pct >= 100 ? ' — at max' : ''}
        </span>
      </div>
    </div>
  );
};

const STATUS_BADGE = {
  active:      'bg-green-100 text-green-700',
  short_break: 'bg-amber-100 text-amber-700',
  leave:       'bg-orange-100 text-orange-700',
  deactivated: 'bg-gray-100 text-gray-500',
  removed:     'bg-red-100 text-red-600',
};
const STATUS_LABEL = {
  active: 'Active', short_break: '☕ Break', leave: '🏖 Leave',
  deactivated: 'Inactive', removed: 'Removed',
};

export default function CoAssistsPage() {
  const [actors, setActors]     = useState([]);
  const [summary, setSummary]   = useState({});
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');
  const [q, setQ]               = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]   = useState('');
  const [newKey, setNewKey]     = useState('');
  const [newRole, setNewRole]   = useState('');
  const [creating, setCreating] = useState(false);
  const [latestOTP, setLatestOTP] = useState(null);
  const [msg, setMsg]           = useState('');
  const [expandedActorId, setExpandedActorId] = useState(null);
  const [actorTasksMap, setActorTasksMap]     = useState({});

  useEffect(() => { load(); }, [filter]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await listActors({ status: filter });
      setActors(res.data.actors || []);
      setSummary(res.data.summary || {});
    } catch {} finally { setLoading(false); }
  };

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await createActor({ display_name: newName, actor_key: newKey, actor_role: newRole });
      setLatestOTP({ name: newName, key: newKey, otp: res.data.otp, format: res.data.actor?.login_format });
      setNewName(''); setNewKey(''); setNewRole('');
      setShowCreate(false);
      load();
    } catch (err) {
      flash(err.response?.data?.message || 'Create failed');
    } finally { setCreating(false); }
  };

  const handleSuggestKey = async () => {
    if (!newName) return;
    try {
      const res = await suggestActorKey(newName);
      setNewKey(res.data.suggested_key || '');
    } catch {}
  };

  const handleResetOTP = async (actorId, actorName) => {
    try {
      const res = await resetActorOTP(actorId);
      setLatestOTP({ name: actorName, otp: res.data.otp, format: res.data.login_format });
      flash(`OTP reset for ${actorName}`);
    } catch { flash('OTP reset failed'); }
  };

  const handleViewTasks = async (actorId) => {
    if (expandedActorId === actorId) {
      setExpandedActorId(null);
      return;
    }
    setExpandedActorId(actorId);
    if (actorTasksMap[actorId] === undefined) {
      try {
        const res = await getActorTasks(actorId);
        setActorTasksMap(m => ({ ...m, [actorId]: res.data.tasks || [] }));
      } catch {
        setActorTasksMap(m => ({ ...m, [actorId]: [] }));
      }
    }
  };

  const handleRouteTask = async (actorId, chitId) => {
    try {
      await routeActorTask(actorId, { chit_id: chitId, action: 'pool' });
      const res = await getActorTasks(actorId);
      setActorTasksMap(m => ({ ...m, [actorId]: res.data.tasks || [] }));
      load();
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to return task');
    }
  };

  const handleDeactivate = async (actor) => {
    const taskNote = actor.current_task_count > 0
      ? ` Their ${actor.current_task_count} active task(s) will be returned to the pool.`
      : '';
    if (!window.confirm(`Deactivate ${actor.display_name}?${taskNote}`)) return;
    try {
      await updateActorStatus(actor.identity_id, {
        action: 'deactivate',
        ...(actor.current_task_count > 0 ? { task_action: 'pool' } : {}),
      });
      flash(`${actor.display_name} deactivated`);
      load();
    } catch (err) {
      flash(err.response?.data?.message || 'Deactivate failed');
    }
  };

  const handleReactivate = async (actor) => {
    try {
      const res = await updateActorStatus(actor.identity_id, { action: 'reactivate' });
      setLatestOTP({ name: actor.display_name, key: actor.actor_key, otp: res.data.otp, format: res.data.login_format });
      flash(`${actor.display_name} reactivated — new OTP generated`);
      load();
    } catch (err) {
      flash(err.response?.data?.message || 'Reactivate failed');
    }
  };

  const handleClearPin = async (actor) => {
    if (!window.confirm(`Clear PIN for ${actor.display_name}? A new OTP will be generated so they can log in and set a new PIN.`)) return;
    try {
      await clearActorPin(actor.identity_id);
      const otpRes = await resetActorOTP(actor.identity_id);
      setLatestOTP({ name: actor.display_name, key: actor.actor_key, otp: otpRes.data.otp, format: otpRes.data.login_format });
      flash(`PIN cleared for ${actor.display_name} — new OTP generated`);
    } catch (err) {
      flash(err.response?.data?.message || 'Clear PIN failed');
    }
  };

  const shown = filterList(actors, q, ['display_name', 'actor_key']);

  return (
    <Layout title="Co-Assists">
      <div className="max-w-lg mx-auto p-4">

        {/* Summary grid — B3.4 */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Active',  val: summary.active || 0,      colour: 'text-green-700' },
            { label: 'Break',   val: summary.on_break || 0,    colour: 'text-amber-700' },
            { label: 'Inactive',val: summary.deactivated || 0, colour: 'text-gray-500' },
            { label: 'Removed', val: summary.removed || 0,     colour: 'text-red-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 text-center py-3">
              <div className={`text-xl font-bold ${s.colour}`}>{s.val}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter + Add */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex gap-1 flex-1 overflow-x-auto">
            {['all','active','leave','inactive'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize ${
                  filter === f ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600'
                }`}>{f === 'all' ? 'All' : f === 'leave' ? 'On break' : f.charAt(0).toUpperCase()+f.slice(1)}</button>
            ))}
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex-shrink-0 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium">
            + Add
          </button>
        </div>

        {/* Search */}
        <ListControls query={q} onQuery={setQ} placeholder="Search co-assists by name or login…"/>

        {msg && (
          <div className="mb-3 text-xs bg-blue-50 text-blue-700 px-3 py-2 rounded-lg border border-blue-200">{msg}</div>
        )}

        {/* Latest OTP card */}
        {latestOTP && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="text-xs text-amber-600 font-medium mb-1">Share with {latestOTP.name}</div>
            <div className="text-2xl font-bold font-mono tracking-widest text-amber-800 text-center my-2">
              {latestOTP.otp}
            </div>
            <div className="text-xs text-amber-700 text-center">
              Login: <span className="font-mono font-medium">{latestOTP.format || latestOTP.key}</span>
            </div>
            <button onClick={() => setLatestOTP(null)} className="mt-2 w-full text-xs text-amber-600">Dismiss</button>
          </div>
        )}

        {/* Actor list */}
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
        ) : actors.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-3xl mb-2">🤖</div>
            <div className="text-sm">No co-assists yet</div>
            <button onClick={() => setShowCreate(true)} className="mt-3 text-xs text-blue-600">Add first co-assist</button>
          </div>
        ) : shown.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No co-assists match your search</div>
        ) : shown.map(actor => (
          <div key={actor.identity_id} className="bg-white rounded-xl border border-gray-100 mb-3 overflow-hidden">
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-xs font-bold flex-shrink-0">
                  {actor.display_name.slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-sm font-medium text-gray-800 truncate">{actor.display_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_BADGE[actor.break_status] || 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABEL[actor.break_status] || actor.break_status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {actor.actor_key}
                    {actor.actor_role && <span> · {actor.actor_role}</span>}
                  </div>
                  {/* Load bar — B3.4 */}
                  <LoadBar current={actor.current_task_count || 0} max={actor.max_tasks || 10}/>
                </div>
              </div>

              {/* Primary actions */}
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleViewTasks(actor.identity_id)}
                  className={`text-xs border rounded-lg py-1.5 font-medium transition-colors ${
                    expandedActorId === actor.identity_id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-blue-200 text-blue-700 hover:bg-blue-50'
                  }`}>
                  Tasks ({actor.current_task_count || 0})
                </button>
                {actor.break_status === 'deactivated' ? (
                  <button onClick={() => handleReactivate(actor)}
                    className="text-xs border border-green-200 rounded-lg py-1.5 text-green-700 hover:bg-green-50">
                    Reactivate
                  </button>
                ) : actor.break_status !== 'removed' ? (
                  <button onClick={() => handleDeactivate(actor)}
                    className="text-xs border border-gray-200 rounded-lg py-1.5 text-gray-600 hover:bg-gray-50">
                    Deactivate
                  </button>
                ) : (
                  <div/>
                )}
                <button onClick={() => handleClearPin(actor)}
                  className="text-xs border border-gray-200 rounded-lg py-1.5 text-gray-600 hover:bg-gray-50">
                  Clear PIN
                </button>
              </div>

              {/* Secondary actions */}
              <div className="flex gap-2 mt-2">
                <button onClick={() => handleResetOTP(actor.identity_id, actor.display_name)}
                  className="flex-1 text-xs border border-gray-200 rounded-lg py-1.5 text-gray-600 hover:bg-gray-50">
                  Reset OTP
                </button>
                {actor.break_status !== 'removed' && (
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Remove ${actor.display_name}? This cannot be undone.`)) return;
                      try {
                        await updateActorStatus(actor.identity_id, {
                          action: 'remove',
                          confirm: 'REMOVE',
                          ...(actor.current_task_count > 0 ? { task_action: 'pool' } : {}),
                        });
                        load();
                      } catch (err) { flash(err.response?.data?.message || 'Remove failed'); }
                    }}
                    className="flex-1 text-xs border border-red-200 rounded-lg py-1.5 text-red-600 hover:bg-red-50">
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Inline task list — expanded when Tasks button clicked */}
            {expandedActorId === actor.identity_id && (
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                <div className="text-xs font-medium text-gray-500 mb-2">
                  Active tasks for {actor.display_name}
                </div>
                {actorTasksMap[actor.identity_id] === undefined ? (
                  <div className="text-xs text-gray-400 py-2 text-center">Loading...</div>
                ) : actorTasksMap[actor.identity_id].length === 0 ? (
                  <div className="text-xs text-gray-400 py-2 text-center">No active tasks</div>
                ) : (
                  actorTasksMap[actor.identity_id].map(task => (
                    <div key={task.chit_id}
                      className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="text-xs text-gray-800 truncate">{task.auto_subject}</div>
                        <div className="text-xs text-gray-400">{task.sender_entity_display_name}</div>
                      </div>
                      <button
                        onClick={() => handleRouteTask(actor.identity_id, task.chit_id)}
                        className="text-xs text-amber-700 border border-amber-200 bg-white px-2 py-1 rounded-lg flex-shrink-0 hover:bg-amber-50">
                        Return
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
            <div className="bg-white rounded-t-2xl w-full max-w-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium">Add co-assist</span>
                <button onClick={() => setShowCreate(false)} className="text-gray-400">✕</button>
              </div>
              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Full name</label>
                  <input type="text" value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onBlur={handleSuggestKey}
                    placeholder="Ravi Kumar" required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"/>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Login short name</label>
                  <div className="flex gap-2 items-center">
                    <input type="text" value={newKey}
                      onChange={e => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g,''))}
                      placeholder="ravik" required pattern="[a-z0-9]+" minLength={4}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-blue-500"/>
                    <span className="text-xs text-gray-400">@{''}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Minimum 4 characters, lowercase only</div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Role (optional)</label>
                  <input type="text" value={newRole} onChange={e => setNewRole(e.target.value)}
                    placeholder="Purchase, Sales, Dispatch..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"/>
                </div>
                <button type="submit" disabled={creating}
                  className="w-full bg-blue-600 text-white rounded-xl py-3 text-sm font-medium disabled:opacity-50">
                  {creating ? 'Creating...' : 'Create and get OTP'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
