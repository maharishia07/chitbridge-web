// src/pages/MyTasksPage.jsx — Actor personal task queue
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getInbox, assignChit, actorBreak } from '../api/client';

const STATUS_PILL = {
  pending:     'bg-amber-100 text-amber-800',
  delivered:   'bg-blue-100 text-blue-800',
  accepted:    'bg-green-100 text-green-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed:   'bg-green-200 text-green-900',
};

const getAgeLabel = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(mins / 60);
  if (hrs >= 2)  return { label: `${hrs}h`, colour: 'text-red-500' };
  if (mins >= 30) return { label: `${mins}m`, colour: 'text-amber-500' };
  return { label: `${mins}m`, colour: 'text-green-600' };
};

export default function MyTasksPage() {
  const { entity, isActor, actorKey } = useAuth();
  const [tasks, setTasks]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [breakModal, setBreakModal] = useState(false);
  const [actionPanel, setActionPanel] = useState(null);
  const [msg, setMsg]             = useState('');
  const navigate = useNavigate();

  useEffect(() => { loadTasks(); }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await getInbox({ limit: 100 });
      const all = res.data.chits || [];
      // My Task = assigned to this actor + not closed
      const mine = all.filter(c =>
        c.assigned_to_actor_id === entity?.identity_id &&
        !['completed','cancelled','rejected'].includes(c.current_status)
      );
      setTasks(mine);
    } catch {}
    setLoading(false);
  };

  const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  const handleReturn = async (chitId) => {
    try {
      await assignChit(chitId, { action: 'return' });
      showMsg('Returned to entity pool');
      setActionPanel(null); loadTasks();
    } catch (err) {
      showMsg(err.response?.data?.message || 'Failed');
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

  // Not an actor — show info
  if (!isActor && tasks.length === 0 && !loading) return (
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
      <div className="flex flex-col max-w-lg mx-auto">

        {msg && (
          <div className="mx-4 mt-3 text-xs bg-blue-50 text-blue-700 p-3 rounded-xl border border-blue-200">{msg}</div>
        )}

        {/* Break toggle */}
        {isActor && (
          <div className="mx-4 mt-4">
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

        {/* Task list */}
        <div className="px-4 py-3">
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <div className="text-4xl mb-3">✅</div>
              <div className="text-sm font-medium text-gray-700">All clear</div>
              <div className="text-xs text-gray-400 mt-1 mb-4">Nothing assigned to you</div>
              <button onClick={() => navigate('/inbox')}
                className="text-blue-600 text-xs border border-blue-200 px-4 py-2 rounded-lg">
                Go to All Task to pull work
              </button>
            </div>
          ) : (
            <>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">
                My tasks · {tasks.length}
              </div>
              {tasks.map(task => {
                const age = getAgeLabel(task.created_at);
                return (
                  <div key={task.chit_id}
                    className="bg-white rounded-xl border border-gray-100 mb-3 overflow-hidden">
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
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_PILL[task.current_status] || 'bg-gray-100 text-gray-600'}`}>
                          {task.current_status}
                        </span>
                        <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-200">
                          mine
                        </span>
                        <span className="text-xs text-gray-400 ml-auto">
                          {formatDate(task.created_at)}
                        </span>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="border-t border-gray-100 flex">
                      <button onClick={() => navigate(`/chit/${task.chit_id}`)}
                        className="flex-1 text-xs text-blue-600 py-2.5 border-r border-gray-100">
                        Open
                      </button>
                      <button onClick={() => handleReturn(task.chit_id)}
                        className="flex-1 text-xs text-gray-500 py-2.5">
                        ↩ Return to pool
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
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
