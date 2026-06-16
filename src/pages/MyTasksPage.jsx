// src/pages/MyTasksPage.jsx — Actor personal task queue
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getInbox, assignChit, actorBreak, updateChitStatus } from '../api/client';

const OPEN_STATUSES  = ['pending', 'delivered', 'read'];
const ACT_STATUSES   = ['accepted', 'in_progress', 'partial'];
const CLOSE_STATUSES = ['completed', 'cancelled', 'rejected'];

const VALID_TRANSITIONS = {
  pending:     ['accepted', 'rejected', 'cancelled'],
  delivered:   ['accepted', 'rejected', 'cancelled'],
  read:        ['accepted', 'rejected', 'cancelled'],
  accepted:    ['in_progress', 'rejected', 'cancelled'],
  in_progress: ['partial', 'completed', 'accepted', 'cancelled'],
  partial:     ['in_progress', 'completed', 'cancelled'],
  completed:   ['in_progress'],
  rejected:    ['accepted'],
  cancelled:   ['accepted'],
};

const ACTION_LABELS = {
  accepted:    '✓ Accept',
  rejected:    '✗ Reject',
  in_progress: '▶ Start',
  partial:     '◑ Partial',
  completed:   '✓✓ Complete',
  cancelled:   '✕ Cancel',
};

const ACTION_STYLE = {
  accepted:    'bg-green-50 text-green-800 border-green-200 hover:bg-green-100',
  rejected:    'bg-red-50 text-red-800 border-red-200 hover:bg-red-100',
  in_progress: 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100',
  partial:     'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
  completed:   'bg-green-100 text-green-900 border-green-300 hover:bg-green-200',
  cancelled:   'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200',
};

const STATUS_PILL = {
  pending:     'bg-amber-100 text-amber-800',
  delivered:   'bg-blue-100 text-blue-800',
  read:        'bg-blue-50 text-blue-700',
  accepted:    'bg-green-100 text-green-800',
  in_progress: 'bg-purple-100 text-purple-800',
  partial:     'bg-purple-50 text-purple-700',
  completed:   'bg-green-200 text-green-900',
  rejected:    'bg-red-100 text-red-800',
  cancelled:   'bg-gray-100 text-gray-600',
};

const getAgeLabel = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(mins / 60);
  if (hrs >= 2)   return { label: `${hrs}h`, colour: 'text-red-500' };
  if (mins >= 30) return { label: `${mins}m`, colour: 'text-amber-500' };
  return { label: `${mins}m`, colour: 'text-green-600' };
};

export default function MyTasksPage() {
  const { entity, isActor } = useAuth();
  const [tasks, setTasks]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState('open');
  const [breakModal, setBreakModal] = useState(false);
  const [msg, setMsg]               = useState('');
  const navigate = useNavigate();

  useEffect(() => { loadTasks(); }, [entity]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await getInbox({ limit: 100 });
      const all = res.data.chits || [];
      // My Task = tasks assigned to this actor (all statuses, tabs handle grouping)
      setTasks(all.filter(c => c.assigned_to_actor_id === entity?.identity_id));
    } catch {}
    setLoading(false);
  };

  const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  const handleReturn = async (chitId) => {
    try {
      await assignChit(chitId, { action: 'return' });
      showMsg('Returned to entity pool');
      loadTasks();
    } catch (err) {
      showMsg(err.response?.data?.message || 'Failed');
    }
  };

  const handleStatusChange = async (chitId, status) => {
    try {
      await updateChitStatus(chitId, status);
      showMsg(`Updated to ${status}`);
      loadTasks();
    } catch (err) {
      showMsg(err.response?.data?.message || 'Update failed');
    }
  };

  const handleBreak = async (breakType) => {
    try {
      await actorBreak({ break_type: breakType, task_action: breakType === 'leave' ? 'pool' : undefined });
      showMsg(breakType === 'short_break' ? 'Short break started — tasks held' : 'Leave started — tasks returned to pool');
      setBreakModal(false); loadTasks();
    } catch (err) {
      showMsg(err.response?.data?.message || 'Break failed');
    }
  };

  const formatDate = (d) => {
    const date = new Date(d);
    const now  = new Date();
    if (now - date < 86400000) return date.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
    return date.toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
  };

  const openTasks  = tasks.filter(t => OPEN_STATUSES.includes(t.current_status));
  const actTasks   = tasks.filter(t => ACT_STATUSES.includes(t.current_status));
  const closeTasks = tasks.filter(t => CLOSE_STATUSES.includes(t.current_status));
  const tabTasks   = tab === 'open' ? openTasks : tab === 'act' ? actTasks : closeTasks;

  // Non-actor landing
  if (!isActor && !loading && tasks.length === 0) return (
    <Layout title="My Task">
      <div className="flex flex-col items-center justify-center min-h-96 px-8 text-center">
        <div className="text-4xl mb-4">✅</div>
        <div className="text-sm font-medium text-gray-800 mb-2">My Task</div>
        <div className="text-xs text-gray-500 mb-4 max-w-xs">
          My Task shows tasks personally assigned to a co-assist.
          Add co-assists from the Co-Assists menu to enable this feature.
        </div>
        <button onClick={() => navigate('/co-assists')}
          className="text-blue-600 text-sm border border-blue-200 px-4 py-2 rounded-lg">
          Go to Co-Assists
        </button>
      </div>
    </Layout>
  );

  return (
    <Layout title="My Task">
      <div className="flex flex-col h-full">

        {msg && (
          <div className="mx-3 mt-2 text-xs bg-blue-50 text-blue-700 px-3 py-2 rounded-lg border border-blue-200 flex-shrink-0">
            {msg}
          </div>
        )}

        {/* Break toggle */}
        {isActor && (
          <div className="mx-4 mt-3 flex-shrink-0">
            <button onClick={() => setBreakModal(true)}
              className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">☕</span>
                <div>
                  <div className="text-sm font-medium text-gray-800">Go on break</div>
                  <div className="text-xs text-gray-400">Short break or leave</div>
                </div>
              </div>
              <span className="text-gray-400 text-xs">→</span>
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-white mt-3 flex-shrink-0">
          {[
            { id: 'open',  label: `Open [${openTasks.length}]` },
            { id: 'act',   label: `Act [${actTasks.length}]` },
            { id: 'close', label: `Close [${closeTasks.length}]` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
          ) : tabTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <div className="text-4xl mb-3">✅</div>
              <div className="text-sm font-medium text-gray-700">
                {tab === 'open' ? 'No open tasks' : tab === 'act' ? 'No active tasks' : 'No closed tasks'}
              </div>
              {tab === 'open' && (
                <button onClick={() => navigate('/inbox')}
                  className="text-blue-600 text-xs border border-blue-200 px-4 py-2 rounded-lg mt-4">
                  Go to All Task to pull work
                </button>
              )}
            </div>
          ) : (
            tabTasks.map(task => {
              const age = getAgeLabel(task.created_at);
              const actions = VALID_TRANSITIONS[task.current_status] || [];
              return (
                <div key={task.chit_id}
                  className="bg-white rounded-xl border border-gray-100 mb-3 overflow-hidden">

                  {/* Card header — tap to open detail */}
                  <div className="p-3 cursor-pointer active:bg-gray-50"
                    onClick={() => navigate(`/chit/${task.chit_id}`)}>
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-xs font-medium text-gray-800 truncate flex-1">
                        {task.sender_entity_display_name}
                      </span>
                      <span className={`text-xs font-medium ml-2 flex-shrink-0 ${age.colour}`}>
                        {age.label}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mb-2 truncate">{task.auto_subject}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_PILL[task.current_status] || 'bg-gray-100 text-gray-600'}`}>
                        {task.current_status}
                      </span>
                      <span className="text-xs text-gray-400 ml-auto">
                        {formatDate(task.created_at)}
                      </span>
                    </div>
                    {/* Assigned-to — explicit so it's clear whose queue this is in */}
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="text-xs text-gray-400">Assigned to:</span>
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-green-100 text-green-700">
                        {task.assigned_to_actor_display_name || entity?.display_name} (me)
                      </span>
                    </div>
                  </div>

                  {/* Action bar — status transitions + return */}
                  {tab !== 'close' && (
                    <div className="border-t border-gray-100 px-3 py-2 flex flex-wrap gap-1.5">
                      {actions.map(action => (
                        <button
                          key={action}
                          onClick={() => handleStatusChange(task.chit_id, action)}
                          className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${ACTION_STYLE[action]}`}
                        >
                          {ACTION_LABELS[action]}
                        </button>
                      ))}
                      <button
                        onClick={() => handleReturn(task.chit_id)}
                        className="text-xs px-2.5 py-1.5 rounded-lg border font-medium bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100 transition-colors ml-auto"
                      >
                        ↩ Return
                      </button>
                    </div>
                  )}
                  {tab === 'close' && (
                    <div className="border-t border-gray-100 px-3 py-2">
                      <button onClick={() => navigate(`/chit/${task.chit_id}`)}
                        className="text-xs text-blue-600">
                        View details →
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Break modal */}
        {breakModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-end">
            <div className="bg-white w-full rounded-t-2xl p-6">
              <div className="w-8 h-1 bg-gray-200 rounded-full mx-auto mb-5"/>
              <div className="text-sm font-medium text-gray-800 text-center mb-5">Going on break?</div>
              <button onClick={() => handleBreak('short_break')}
                className="w-full flex items-center gap-3 border border-blue-200 bg-blue-50 rounded-xl p-4 mb-3">
                <span className="text-2xl">☕</span>
                <div className="text-left">
                  <div className="text-sm font-medium text-blue-700">Short break</div>
                  <div className="text-xs text-blue-500">Tasks stay with you — back soon</div>
                </div>
              </button>
              <button onClick={() => handleBreak('leave')}
                className="w-full flex items-center gap-3 border border-amber-200 bg-amber-50 rounded-xl p-4 mb-4">
                <span className="text-2xl">🏖️</span>
                <div className="text-left">
                  <div className="text-sm font-medium text-amber-700">Leave or absent</div>
                  <div className="text-xs text-amber-500">Tasks returned to entity pool</div>
                </div>
              </button>
              <button onClick={() => setBreakModal(false)}
                className="w-full border border-gray-200 text-gray-600 text-sm py-3 rounded-xl">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
