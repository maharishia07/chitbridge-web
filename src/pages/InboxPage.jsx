// src/pages/InboxPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getInbox, updateChitStatus, assignChit, listActors } from '../api/client';

const STATUS_BORDER = {
  pending:     'border-l-amber-400',
  delivered:   'border-l-blue-500',
  read:        'border-l-blue-400',
  accepted:    'border-l-green-500',
  in_progress: 'border-l-purple-500',
  partial:     'border-l-purple-400',
  completed:   'border-l-green-600',
  rejected:    'border-l-red-500',
  cancelled:   'border-l-gray-400',
};

const STATUS_PILL = {
  pending:     'bg-amber-100 text-amber-800',
  delivered:   'bg-blue-100 text-blue-800',
  read:        'bg-blue-100 text-blue-700',
  accepted:    'bg-green-100 text-green-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed:   'bg-green-100 text-green-900',
  rejected:    'bg-red-100 text-red-800',
  cancelled:   'bg-gray-100 text-gray-600',
};

const ChitCard = ({
  chit, onSwipeLeft, onSwipeRight,
  isActor, actorId, onPull, onAssignOpen,
  assigningChitId, actorList, onPushToActor,
}) => {
  const navigate = useNavigate();

  const handlers = useSwipeable({
    onSwipedLeft:  () => onSwipeLeft(chit),
    onSwipedRight: () => onSwipeRight(chit),
    onTap:         () => navigate(`/chit/${chit.chit_id}`),
    delta: 60,
    preventScrollOnSwipe: true,
    trackMouse: true,
  });

  const isAssignedToMe    = chit.assigned_to_actor_id === actorId;
  const isAssignedOther   = chit.assigned_to_actor_id && !isAssignedToMe;
  const isUnassigned      = !chit.assigned_to_actor_id;
  const showPicker        = assigningChitId === chit.chit_id;

  const formatDate = (d) => {
    const date = new Date(d);
    const now  = new Date();
    const diff = now - date;
    if (diff < 86400000)  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return date.toLocaleDateString('en-IN', { weekday: 'short' });
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const summary = (() => {
    try { return typeof chit.summary_json === 'string' ? JSON.parse(chit.summary_json || '{}') : (chit.summary_json || {}); }
    catch { return {}; }
  })();

  const isUnread = !chit.read_at;

  // Stop mousedown bubbling to swipeable so button clicks work reliably on desktop
  const btn = (handler, className, label) => (
    <button
      onClick={e => { e.stopPropagation(); handler(); }}
      onMouseDown={e => e.stopPropagation()}
      className={`flex-1 text-xs font-medium py-1.5 rounded-lg border transition-colors ${className}`}
    >
      {label}
    </button>
  );

  return (
    <div
      {...handlers}
      className={`border-l-4 ${STATUS_BORDER[chit.current_status] || 'border-l-gray-200'}
                  bg-white border-b border-gray-100 px-3 py-2.5 select-none cursor-pointer`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-1">
        <span className={`text-xs ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'}`}>
          {chit.sender_entity_display_name}
        </span>
        <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
          {formatDate(chit.created_at)}
        </span>
      </div>

      {/* Subject */}
      <div className={`text-xs mb-1 truncate ${isUnread ? 'text-gray-800' : 'text-gray-600'}`}>
        {chit.auto_subject}
      </div>
      {chit.manual_subject && (
        <div className="text-xs text-gray-400 italic truncate mb-1">
          "{chit.manual_subject}"
        </div>
      )}

      {/* Status / summary row */}
      <div className="flex items-center gap-2">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_PILL[chit.current_status] || 'bg-gray-100 text-gray-600'}`}>
          {chit.current_status}
        </span>
        {summary.line_item_count > 0 && (
          <span className="text-xs text-gray-400">
            {summary.line_item_count} item{summary.line_item_count !== 1 ? 's' : ''}
            {summary.total_value && ` · INR ${parseFloat(summary.total_value).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`}
          </span>
        )}
        {isAssignedToMe && (
          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded ml-auto">mine</span>
        )}
        {isAssignedOther && (
          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded ml-auto truncate max-w-28">
            → {chit.assigned_to_actor_display_name}
          </span>
        )}
      </div>

      {/* Actor ribbon — header-level assignment actions */}
      {isActor && !isAssignedOther && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="flex gap-2">
            {isUnassigned && btn(
              () => onPull(chit.chit_id),
              'bg-green-50 text-green-800 border-green-200 hover:bg-green-100',
              '↙ Pull to My Task'
            )}
            {isUnassigned && btn(
              () => onAssignOpen(chit.chit_id),
              showPicker
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100',
              showPicker ? '✕ Cancel' : '→ Assign to...'
            )}
            {isAssignedToMe && btn(
              () => onPull(chit.chit_id, 'return'),
              'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100',
              '↩ Return to pool'
            )}
          </div>

          {/* Actor picker — shown when Assign is open for this chit */}
          {showPicker && (
            <div className="mt-2 flex flex-col gap-1 max-h-36 overflow-y-auto">
              {actorList.length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-2">No other active co-assists</div>
              ) : actorList.filter(a => a.identity_id !== actorId).map(actor => (
                <button
                  key={actor.identity_id}
                  onClick={e => { e.stopPropagation(); onPushToActor(chit.chit_id, actor.identity_id, actor.display_name); }}
                  onMouseDown={e => e.stopPropagation()}
                  className="text-left text-xs px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                >
                  <span className="font-medium text-gray-800">{actor.display_name}</span>
                  {actor.actor_role && <span className="text-gray-400 ml-1.5">· {actor.actor_role}</span>}
                  <span className="text-gray-400 ml-1.5">({actor.current_task_count || 0}/{actor.max_tasks || 10})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function InboxPage() {
  const [tab, setTab]             = useState(() => sessionStorage.getItem('inboxTab') || 'open');
  const [chits, setChits]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [actionMsg, setActionMsg] = useState('');
  const [actorList, setActorList] = useState([]);
  const [assigningChitId, setAssigningChitId] = useState(null);
  const { entity, isActor, parentEntity } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { loadChits(); }, [tab, entity]);

  // Fetch actor list once so the assign picker is ready
  useEffect(() => {
    if (!isActor) return;
    listActors({ status: 'active' })
      .then(res => setActorList(res.data.actors || []))
      .catch(() => {});
  }, [isActor]);

  const loadChits = async () => {
    try {
      setLoading(true);
      const res = await getInbox({ limit: 100 });
      const all = res.data.chits || [];
      const senderName = isActor ? parentEntity : entity?.display_name;
      setChits(all.filter(c => c.sender_entity_display_name !== senderName));
    } catch (err) {
      console.error('Inbox error:', err);
    } finally {
      setLoading(false);
    }
  };

  const flash = (msg) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 2500); };

  const handleSwipeLeft = async (chit) => {
    const allowed = ['pending','delivered','read','accepted','in_progress'];
    if (allowed.includes(chit.current_status)) {
      try { await updateChitStatus(chit.chit_id, 'completed'); loadChits(); } catch {}
    }
  };

  const handleSwipeRight = () => {};

  const handlePull = async (chitId, action = 'pull') => {
    try {
      await assignChit(chitId, { action });
      flash(action === 'pull' ? 'Pulled to My Task ✓' : 'Returned to pool ✓');
      loadChits();
    } catch (err) {
      flash(err.response?.data?.message || 'Action failed');
    }
  };

  const handleAssignOpen = (chitId) => {
    setAssigningChitId(prev => prev === chitId ? null : chitId);
  };

  const handlePushToActor = async (chitId, targetActorId, actorName) => {
    try {
      await assignChit(chitId, { action: 'push', target_actor_id: targetActorId });
      flash(`Assigned to ${actorName} ✓`);
      setAssigningChitId(null);
      loadChits();
    } catch (err) {
      flash(err.response?.data?.message || 'Assign failed');
    }
  };

  const isClosed = c => ['completed','cancelled','rejected'].includes(c.current_status);
  // Mutually exclusive — a task lives in exactly one tab
  const openChits   = chits.filter(c => !isClosed(c) && !c.assigned_to_actor_id);
  const actChits    = chits.filter(c => !isClosed(c) &&  c.assigned_to_actor_id);
  const closedChits = chits.filter(c =>  isClosed(c));
  const tabChits    = tab === 'open' ? openChits : tab === 'act' ? actChits : closedChits;

  return (
    <Layout title="All Task">
      <div className="flex flex-col h-full">

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-white flex-shrink-0">
          {[
            { id: 'open',  label: `Open [${openChits.length}]` },
            { id: 'act',   label: `Act [${actChits.length}]` },
            { id: 'close', label: `Close [${closedChits.length}]` },
          ].map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); sessionStorage.setItem('inboxTab', t.id); }}
              className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Action feedback */}
        {actionMsg && (
          <div className="mx-3 mt-2 text-xs bg-blue-50 text-blue-700 px-3 py-2 rounded-lg border border-blue-200 flex-shrink-0">
            {actionMsg}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading...</div>
          ) : tabChits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <div className="text-4xl mb-3">📭</div>
              <div className="text-sm">Nothing here</div>
              {tab === 'act' && <div className="text-xs mt-1">Pull tasks from the Open tab</div>}
            </div>
          ) : (
            tabChits.map(chit => (
              <ChitCard key={chit.chit_id} chit={chit}
                onSwipeLeft={handleSwipeLeft}
                onSwipeRight={handleSwipeRight}
                isActor={isActor}
                actorId={entity?.identity_id}
                onPull={handlePull}
                onAssignOpen={handleAssignOpen}
                assigningChitId={assigningChitId}
                actorList={actorList}
                onPushToActor={handlePushToActor}
              />
            ))
          )}
        </div>

        {/* FAB */}
        <button
          onClick={() => navigate('/send')}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg text-2xl flex items-center justify-center active:scale-95 transition-transform md:hidden"
          aria-label="Compose">
          +
        </button>
      </div>
    </Layout>
  );
}
