// src/pages/MyTasksPage.jsx — Actor personal task queue
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getInbox, assignChit, updateChitStatus } from '../api/client';

const OPEN_STATUSES  = ['pending', 'delivered', 'read'];
const ACT_STATUSES   = ['accepted', 'in_progress', 'partial'];
const CLOSE_STATUSES = ['completed', 'cancelled', 'rejected'];

const ADVANCE_TO = {
  pending:     'in_progress',
  delivered:   'in_progress',
  read:        'in_progress',
  accepted:    'in_progress',
  in_progress: 'completed',
  partial:     'completed',
};

const REGRESS_TO = {
  accepted:    'pending',
  in_progress: 'pending',
  partial:     'in_progress',
  completed:   'in_progress',
};

const STATUS_LABEL = {
  pending:     'Open',
  delivered:   'Delivered',
  read:        'Seen',
  accepted:    'Accepted',
  in_progress: 'In Progress',
  partial:     'Partial',
  completed:   'Done',
  rejected:    'Rejected',
  cancelled:   'Cancelled',
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
  const days = Math.floor(hrs / 24);
  if (days >= 1)  return { label: `${days}d`, colour: 'text-red-500' };
  if (hrs >= 2)   return { label: `${hrs}h`, colour: 'text-red-500' };
  if (mins >= 30) return { label: `${mins}m`, colour: 'text-amber-500' };
  return { label: `${mins}m`, colour: 'text-green-600' };
};

export default function MyTasksPage() {
  const { entity, isActor } = useAuth();
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('open');
  const [msg, setMsg]         = useState('');
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

  const formatDate = (d) => {
    const date = new Date(d);
    const now  = new Date();
    const diff = now - date;
    if (diff < 86400000)  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return date.toLocaleDateString('en-IN', { weekday: 'short' });
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
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

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-white mt-3 flex-shrink-0">
          {[
            { id: 'open',  label: `Open [${openTasks.length}]` },
            { id: 'act',   label: `Progress [${actTasks.length}]` },
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
                {tab === 'open' ? 'No open tasks' : tab === 'act' ? 'Nothing in progress' : 'No closed tasks'}
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
                        {STATUS_LABEL[task.current_status] || task.current_status}
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

                  {/* Arrow action row */}
                  <div className="border-t border-gray-100 px-3 py-2 flex items-center gap-1.5">
                    <button
                      onClick={() => REGRESS_TO[task.current_status] && handleStatusChange(task.chit_id, REGRESS_TO[task.current_status])}
                      disabled={!REGRESS_TO[task.current_status]}
                      title={REGRESS_TO[task.current_status] ? `Back to ${STATUS_LABEL[REGRESS_TO[task.current_status]]}` : 'Cannot go back'}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg border text-base font-bold transition-colors ${
                        REGRESS_TO[task.current_status]
                          ? 'text-gray-600 border-gray-200 bg-gray-50 hover:bg-gray-100'
                          : 'text-gray-200 border-gray-100 cursor-not-allowed'
                      }`}>←</button>

                    <button
                      onClick={() => ADVANCE_TO[task.current_status] && handleStatusChange(task.chit_id, ADVANCE_TO[task.current_status])}
                      disabled={!ADVANCE_TO[task.current_status]}
                      title={ADVANCE_TO[task.current_status] ? `Move to ${STATUS_LABEL[ADVANCE_TO[task.current_status]]}` : 'Already closed'}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg border text-base font-bold transition-colors ${
                        ADVANCE_TO[task.current_status]
                          ? 'text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100'
                          : 'text-gray-200 border-gray-100 cursor-not-allowed'
                      }`}>→</button>

                    <div className="flex-1"/>

                    <button
                      onClick={() => handleReturn(task.chit_id)}
                      title="Return to entity pool"
                      className="w-9 h-9 flex items-center justify-center rounded-lg border text-base font-bold text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors">
                      ↑
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </Layout>
  );
}
