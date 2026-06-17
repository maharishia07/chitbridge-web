// src/pages/InboxPage.jsx — B3.4
// B3.4 additions:
//   Bell notification badge in header
//   Search bar
//   Filter chips: All Today Unread High-value
//   Advanced filter sheet
//   Date grouping: Today / Yesterday / Earlier
//   Sender avatar with initials
//   Unread blue dot
//   Swipe undo toast (3 second countdown)
//   Send confirmation modal (moved here from SendChitPage)
//   Empty state with Compose button
//   Read receipt ticks ✓ ✓✓
//   Tab counts Open(n) Act(n) Close(n)
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getInbox, updateChitStatus, assignChit, listActors, deleteChit } from '../api/client';

// ── Constants ────────────────────────────────────────────────
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
  partial:     'bg-purple-50 text-purple-700',
  completed:   'bg-green-100 text-green-900',
  rejected:    'bg-red-100 text-red-800',
  cancelled:   'bg-gray-100 text-gray-600',
};

// ── Helpers ──────────────────────────────────────────────────
const getInitials = (name = '') =>
  name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'CB';

const AVATAR_COLOURS = [
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
];

const avatarColour = (name = '') => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLOURS[Math.abs(h) % AVATAR_COLOURS.length];
};

const formatDate = (d) => {
  const date = new Date(d);
  const now  = new Date();
  const diff = now - date;
  if (diff < 86400000)  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  if (diff < 604800000) return date.toLocaleDateString('en-IN', { weekday: 'short' });
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const groupByDate = (chits) => {
  const today     = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const groups    = { Today: [], Yesterday: [], Earlier: [] };
  chits.forEach(c => {
    const d = new Date(c.created_at); d.setHours(0,0,0,0);
    if (d >= today)                groups.Today.push(c);
    else if (d >= yesterday)       groups.Yesterday.push(c);
    else                           groups.Earlier.push(c);
  });
  return groups;
};

const HIGH_VALUE_THRESHOLD = 50000;

// ── Undo Toast ───────────────────────────────────────────────
const UndoToast = ({ message, onUndo, onDismiss }) => {
  const [seconds, setSeconds] = useState(3);
  useEffect(() => {
    const t = setInterval(() => setSeconds(s => {
      if (s <= 1) { clearInterval(t); onDismiss(); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="mx-3 mt-2 flex items-center gap-2 bg-gray-800 text-white text-xs px-3 py-2.5 rounded-lg shadow-lg flex-shrink-0">
      <span className="flex-1">{message}</span>
      <button onClick={onUndo} className="text-blue-300 font-semibold uppercase tracking-wide">
        UNDO {seconds}s
      </button>
    </div>
  );
};

// ── Delete Confirm Modal ─────────────────────────────────────
const DeleteConfirmModal = ({ chit, onCancel, onConfirm, deleting }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
    onClick={onCancel}>
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5"
      onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">🗑</span>
        <span className="text-sm font-semibold text-gray-900">Delete this chit?</span>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed mb-1">
        <span className="font-medium text-gray-800">{chit?.auto_subject || 'This transaction'}</span> will
        be removed from your inbox. The other party keeps their copy.
      </p>
      <p className="text-xs text-gray-400 mb-4">This only affects your view.</p>
      <div className="flex gap-2">
        <button onClick={onCancel} disabled={deleting}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 disabled:opacity-50">
          Cancel
        </button>
        <button onClick={onConfirm} disabled={deleting}
          className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium disabled:opacity-50">
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  </div>
);

// ── Dispute-block Notice Popup ───────────────────────────────
const DisputeBlockModal = ({ onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
    onClick={onClose}>
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 text-center"
      onClick={e => e.stopPropagation()}>
      <div className="text-3xl mb-2">⚠️</div>
      <div className="text-sm font-semibold text-gray-900 mb-1">Cannot delete this chit</div>
      <p className="text-xs text-gray-600 leading-relaxed mb-4">
        Disputed chits cannot be deleted until the dispute is resolved.
      </p>
      <button onClick={onClose}
        className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium">
        Got it
      </button>
    </div>
  </div>
);

// ── Advanced Filter Sheet ────────────────────────────────────
const FilterSheet = ({ filters, onChange, onClose, onClear }) => (
  <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
    <div className="bg-white rounded-t-2xl shadow-xl max-h-[80vh] overflow-y-auto"
      onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-900">Filter transactions</span>
        <button onClick={onClear} className="text-xs text-blue-600 font-medium">Clear all</button>
      </div>

      {/* Status */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Status</div>
        <div className="flex flex-wrap gap-2">
          {['open','act','all'].map(s => (
            <button key={s} onClick={() => onChange('status', s)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors capitalize ${
                filters.status === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 text-gray-600'
              }`}>{s === 'all' ? 'All statuses' : s === 'open' ? 'Open' : 'Progress'}</button>
          ))}
        </div>
      </div>

      {/* Purpose */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Transaction type</div>
        <div className="flex flex-wrap gap-2">
          {['all','order','invoice','receipt','inquiry','delivery_note','general'].map(p => (
            <button key={p} onClick={() => onChange('purpose', p)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors capitalize ${
                filters.purpose === p
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 text-gray-600'
              }`}>{p === 'all' ? 'All types' : p.replace('_',' ')}</button>
          ))}
        </div>
      </div>

      {/* Amount range */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Amount range (INR)</div>
        <div className="flex items-center gap-2">
          <input type="number" placeholder="Min" value={filters.minAmount || ''}
            onChange={e => onChange('minAmount', e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs text-center"/>
          <span className="text-xs text-gray-400">to</span>
          <input type="number" placeholder="Max" value={filters.maxAmount || ''}
            onChange={e => onChange('maxAmount', e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs text-center"/>
        </div>
      </div>

      {/* Date range */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Date range</div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="text-xs text-gray-400 mb-1">From</div>
            <input type="date" value={filters.dateFrom || ''}
              onChange={e => onChange('dateFrom', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500"/>
          </div>
          <div className="text-xs text-gray-300 mt-4">—</div>
          <div className="flex-1">
            <div className="text-xs text-gray-400 mb-1">To</div>
            <input type="date" value={filters.dateTo || ''}
              onChange={e => onChange('dateTo', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500"/>
          </div>
        </div>
        {(filters.dateFrom || filters.dateTo) && (
          <button onClick={() => { onChange('dateFrom', ''); onChange('dateTo', ''); }}
            className="mt-2 text-xs text-blue-600">
            Clear dates
          </button>
        )}
      </div>

      {/* Special */}
      <div className="px-4 py-3">
        <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Show only</div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'unreadOnly', label: 'Unread' },
            { key: 'highValue',  label: '💰 High value' },
          ].map(f => (
            <button key={f.key} onClick={() => onChange(f.key, !filters[f.key])}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                filters[f.key]
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 text-gray-600'
              }`}>{f.label}</button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-6 pt-2">
        <button onClick={onClose}
          className="w-full bg-blue-600 text-white rounded-xl py-3 text-sm font-medium">
          Apply filters
        </button>
      </div>
    </div>
  </div>
);

// ── Chit Card ────────────────────────────────────────────────
const ChitCard = ({
  chit, onSwipeLeft, onSwipeRight,
  isActor, actorId, onPull, onAssignOpen,
  assigningChitId, actorList, onPushToActor,
  onAdvance, onRegress, onDelete, onDisputeBlock,
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

  const isAssignedToMe  = chit.assigned_to_actor_id === actorId;
  const isAssignedOther = !!chit.assigned_to_actor_id && !isAssignedToMe;
  const isUnassigned    = !chit.assigned_to_actor_id;
  const showPicker      = assigningChitId === chit.chit_id;
  const isUnread        = !chit.read_at;

  const summary = (() => {
    try { return typeof chit.summary_json === 'string'
      ? JSON.parse(chit.summary_json || '{}')
      : (chit.summary_json || {}); }
    catch { return {}; }
  })();

  const totalVal  = parseFloat(summary.total_value || 0);
  const isHigh    = totalVal >= HIGH_VALUE_THRESHOLD;
  const senderName = chit.sender_entity_display_name || '';
  const initials   = getInitials(senderName);
  const avColour   = avatarColour(senderName);

  const pickableActors = actorList.filter(a => !isActor || a.identity_id !== actorId);

  const hasDispute = parseInt(chit.open_dispute_count || 0) > 0;
  const disputeCount = parseInt(chit.open_dispute_count || 0);
  const msgCount = parseInt(chit.message_count || 0);

  return (
    <div
      {...handlers}
      className={`border-l-4 ${hasDispute ? 'border-l-red-500' : STATUS_BORDER[chit.current_status] || 'border-l-gray-200'}
                  bg-white border-b border-gray-100 px-3 py-2.5 select-none cursor-pointer
                  ${isUnread ? 'bg-blue-50/30' : ''}`}>

      {/* Header row */}
      <div className="flex items-start gap-2">
        {/* Unread dot */}
        <div className="flex-shrink-0 mt-1">
          {isUnread
            ? <div className="w-2 h-2 rounded-full bg-blue-500"/>
            : <div className="w-2 h-2"/>}
        </div>

        {/* Avatar */}
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avColour}`}>
          {initials}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-1">
            <span className={`text-xs truncate ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'}`}>
              {senderName}
            </span>
            <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(chit.created_at)}</span>
          </div>
          <div className={`text-xs truncate mt-0.5 ${isUnread ? 'text-gray-800' : 'text-gray-500'}`}>
            {chit.auto_subject}
          </div>

          {/* Status + value row */}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_PILL[chit.current_status] || 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABEL[chit.current_status] || chit.current_status}
            </span>
            {hasDispute && (
              <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-red-100 text-red-700">
                ⚠️ disputed · {disputeCount}
              </span>
            )}
            {msgCount > 0 && (
              <button
                onClick={e => { e.stopPropagation(); navigate(`/chit/${chit.chit_id}?tab=status`); }}
                onMouseDown={e => e.stopPropagation()}
                className="text-xs px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-600 border border-blue-100">
                💬 {msgCount}
              </button>
            )}
            {summary.line_item_count > 0 && (
              <span className="text-xs text-gray-400">
                {summary.line_item_count} item{summary.line_item_count !== 1 ? 's' : ''}
                {totalVal > 0 && ` · ₹${totalVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
              </span>
            )}
            {isHigh && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">💰 High</span>
            )}
            {/* Read receipt ticks */}
            {chit.read_at
              ? <span className="text-xs text-green-600 ml-auto">✓✓</span>
              : chit.delivered_at
                ? <span className="text-xs text-blue-400 ml-auto">✓</span>
                : null}
          </div>
        </div>
      </div>

      {/* Assigned badge */}
      {chit.assigned_to_actor_id ? (
        <div className="mt-1.5 ml-9 flex items-center gap-1.5">
          <span className="text-xs text-gray-400">→</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
            isAssignedToMe ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {chit.assigned_to_actor_display_name}{isAssignedToMe ? ' (me)' : ''}
          </span>
        </div>
      ) : (
        <div className="mt-1 ml-9">
          <span className="text-xs text-gray-300 italic">Unassigned</span>
        </div>
      )}

      {/* Arrow action row */}
      <div className="mt-2 ml-9 pt-2 border-t border-gray-100 flex items-center gap-1.5">
        <button
          onClick={e => { e.stopPropagation(); if (REGRESS_TO[chit.current_status]) onRegress(chit.chit_id, REGRESS_TO[chit.current_status]); }}
          onMouseDown={e => e.stopPropagation()}
          disabled={!REGRESS_TO[chit.current_status]}
          title={REGRESS_TO[chit.current_status] ? `Back to ${STATUS_LABEL[REGRESS_TO[chit.current_status]]}` : 'Cannot go back'}
          className={`w-9 h-9 flex items-center justify-center rounded-lg border text-base font-bold transition-colors ${
            REGRESS_TO[chit.current_status]
              ? 'text-gray-600 border-gray-200 bg-gray-50 hover:bg-gray-100'
              : 'text-gray-200 border-gray-100 cursor-not-allowed'
          }`}>←</button>

        <button
          onClick={e => { e.stopPropagation(); if (ADVANCE_TO[chit.current_status]) onAdvance(chit.chit_id, ADVANCE_TO[chit.current_status], chit.current_status); }}
          onMouseDown={e => e.stopPropagation()}
          disabled={!ADVANCE_TO[chit.current_status]}
          title={ADVANCE_TO[chit.current_status] ? `Move to ${STATUS_LABEL[ADVANCE_TO[chit.current_status]]}` : 'Already closed'}
          className={`w-9 h-9 flex items-center justify-center rounded-lg border text-base font-bold transition-colors ${
            ADVANCE_TO[chit.current_status]
              ? 'text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100'
              : 'text-gray-200 border-gray-100 cursor-not-allowed'
          }`}>→</button>

        <div className="flex-1"/>

        {isActor && (
          <button
            onClick={e => { e.stopPropagation(); onPull(chit.chit_id); }}
            onMouseDown={e => e.stopPropagation()}
            title="Pull to My Task"
            className="w-9 h-9 flex items-center justify-center rounded-lg border text-base font-bold text-green-700 border-green-200 bg-green-50 hover:bg-green-100 transition-colors">
            ↑
          </button>
        )}

        {!isActor && (
          <button
            onClick={e => { e.stopPropagation(); onAssignOpen(chit.chit_id); }}
            onMouseDown={e => e.stopPropagation()}
            title={isUnassigned ? 'Assign to co-assist' : 'Reassign'}
            className={`w-9 h-9 flex items-center justify-center rounded-lg border text-base font-bold transition-colors ${
              showPicker ? 'bg-blue-600 text-white border-blue-600' : 'text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100'
            }`}>
            ↓
          </button>
        )}

        {/* Delete — looks disabled while an open dispute is registered;
            clicking it still pops a notice instead of deleting */}
        <button
          onClick={e => { e.stopPropagation(); hasDispute ? onDisputeBlock() : onDelete(chit); }}
          onMouseDown={e => e.stopPropagation()}
          title={hasDispute ? 'Disputed chits cannot be deleted until the dispute is resolved' : 'Delete chit'}
          className={`w-9 h-9 flex items-center justify-center rounded-lg border text-base transition-colors ${
            hasDispute
              ? 'text-gray-300 border-gray-100 bg-gray-50 cursor-not-allowed'
              : 'text-red-600 border-red-200 bg-red-50 hover:bg-red-100'
          }`}>
          🗑
        </button>
      </div>

      {showPicker && !isActor && (
        <div className="mt-2 ml-9 flex flex-col gap-1 max-h-36 overflow-y-auto">
          {pickableActors.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-2">No active co-assists</div>
          ) : pickableActors.map(actor => (
            <button key={actor.identity_id}
              onClick={e => { e.stopPropagation(); onPushToActor(chit.chit_id, actor.identity_id, actor.display_name); }}
              onMouseDown={e => e.stopPropagation()}
              className="text-left text-xs px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 hover:bg-blue-50 hover:border-blue-200">
              <span className="font-medium text-gray-800">{actor.display_name}</span>
              {actor.actor_role && <span className="text-gray-400 ml-1.5">· {actor.actor_role}</span>}
              <span className="text-gray-400 ml-1.5">({actor.current_task_count || 0}/{actor.max_tasks || 10})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main Page ────────────────────────────────────────────────
const DEFAULT_FILTERS = {
  status: 'all', purpose: 'all',
  minAmount: '', maxAmount: '',
  dateFrom: '', dateTo: '',
  unreadOnly: false, highValue: false,
};

export default function InboxPage() {
  const [tab, setTab]           = useState(() => sessionStorage.getItem('inboxTab') || 'open');
  const [chits, setChits]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [actorList, setActorList] = useState([]);
  const [assigningChitId, setAssigningChitId] = useState(null);

  // B3.4 state
  const [search, setSearch]         = useState('');
  const [filters, setFilters]       = useState(DEFAULT_FILTERS);
  const [showFilter, setShowFilter] = useState(false);
  const [undoQueue, setUndoQueue]   = useState([]); // [{id, msg, previousStatus}]
  const [activeUndo, setActiveUndo] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // chit pending delete confirm
  const [deleting, setDeleting]     = useState(false);
  const [disputeBlock, setDisputeBlock] = useState(false); // show "cannot delete" notice

  const { entity, isActor, parentEntity } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { loadChits(); }, [entity]);
  useEffect(() => {
    if (!entity) return;
    listActors({ status: 'active' })
      .then(res => setActorList(res.data.actors || []))
      .catch(() => {});
  }, [entity]);

  const loadChits = async () => {
    try {
      setLoading(true);
      const res = await getInbox({ limit: 200 });
      const all = res.data.chits || [];
      const senderName = isActor ? parentEntity : entity?.display_name;
      setChits(all.filter(c => c.sender_entity_display_name !== senderName));
    } catch (err) {
      console.error('Inbox error:', err);
    } finally { setLoading(false); }
  };

  // ── Undo logic ──────────────────────────────────────────────
  const handleSwipeLeft = async (chit) => {
    const allowed = ['pending', 'delivered', 'read', 'accepted', 'in_progress'];
    if (!allowed.includes(chit.current_status)) return;
    const previousStatus = chit.current_status;
    try {
      await updateChitStatus(chit.chit_id, 'completed');
      loadChits();
      setActiveUndo({
        chitId: chit.chit_id,
        previousStatus,
        msg: `Marked as completed`,
      });
    } catch {}
  };

  const handleUndo = async () => {
    if (!activeUndo) return;
    try {
      await updateChitStatus(activeUndo.chitId, activeUndo.previousStatus);
      loadChits();
    } catch {}
    setActiveUndo(null);
  };

  const handleAdvance = async (chitId, newStatus, previousStatus) => {
    try {
      await updateChitStatus(chitId, newStatus);
      loadChits();
      if (newStatus === 'completed') {
        setActiveUndo({ chitId, previousStatus, msg: 'Marked as done' });
      }
    } catch {}
  };

  const handleRegress = async (chitId, newStatus) => {
    try {
      await updateChitStatus(chitId, newStatus);
      loadChits();
    } catch {}
  };

  const handlePull = async (chitId) => {
    try {
      await assignChit(chitId, { action: 'pull' });
      loadChits();
    } catch (err) { console.error(err); }
  };

  const handlePushToActor = async (chitId, targetActorId, actorName) => {
    try {
      await assignChit(chitId, { action: 'push', target_actor_id: targetActorId });
      setAssigningChitId(null);
      loadChits();
    } catch (err) { console.error(err); }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteChit(deleteTarget.chit_id);
      setDeleteTarget(null);
      loadChits();
    } catch (err) {
      // Backend blocks delete while a dispute is open (409)
      alert(err?.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  // ── Filter logic ────────────────────────────────────────────
  const filterChange = (key, val) => setFilters(f => ({ ...f, [key]: val }));
  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  const hasActiveFilter = Object.entries(filters).some(([k,v]) => {
    if (k === 'status' || k === 'purpose') return v !== 'all';
    if (typeof v === 'boolean') return v;
    return v !== '';
  });

  const applyFilters = (list) => {
    let out = list;
    if (search) {
      const q = search.toLowerCase();
      out = out.filter(c =>
        c.sender_entity_display_name?.toLowerCase().includes(q) ||
        c.auto_subject?.toLowerCase().includes(q) ||
        c.reference_no?.toLowerCase().includes(q)
      );
    }
    if (filters.purpose !== 'all') out = out.filter(c => c.purpose === filters.purpose);
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      out = out.filter(c => new Date(c.created_at) >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      out = out.filter(c => new Date(c.created_at) <= to);
    }
    if (filters.unreadOnly) out = out.filter(c => !c.read_at);
    if (filters.highValue) {
      out = out.filter(c => {
        try { const s = typeof c.summary_json === 'string' ? JSON.parse(c.summary_json||'{}') : (c.summary_json||{});
          return parseFloat(s.total_value||0) >= HIGH_VALUE_THRESHOLD; }
        catch { return false; }
      });
    }
    if (filters.minAmount) {
      out = out.filter(c => {
        try { const s = typeof c.summary_json === 'string' ? JSON.parse(c.summary_json||'{}') : (c.summary_json||{});
          return parseFloat(s.total_value||0) >= parseFloat(filters.minAmount); }
        catch { return false; }
      });
    }
    if (filters.maxAmount) {
      out = out.filter(c => {
        try { const s = typeof c.summary_json === 'string' ? JSON.parse(c.summary_json||'{}') : (c.summary_json||{});
          return parseFloat(s.total_value||0) <= parseFloat(filters.maxAmount); }
        catch { return false; }
      });
    }
    return out;
  };

  const viewable    = isActor ? chits.filter(c => !c.assigned_to_actor_id) : chits;
  const filtered    = applyFilters(viewable);
  const openChits   = filtered.filter(c => OPEN_STATUSES.includes(c.current_status));
  const actChits    = filtered.filter(c => ACT_STATUSES.includes(c.current_status));
  const closedChits = filtered.filter(c => CLOSE_STATUSES.includes(c.current_status));
  const tabChits    = tab === 'open' ? openChits : tab === 'act' ? actChits : closedChits;

  const groups = groupByDate(tabChits);
  const unreadCount = chits.filter(c => !c.read_at).length;

  return (
    <Layout title="All Task" unreadCount={unreadCount}>
      <div className="flex flex-col h-full">

        {/* Search bar + filter icon */}
        <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
            <span className="text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Search transactions..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-xs text-gray-700 placeholder-gray-400 outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-gray-400 text-sm">✕</button>
            )}
          </div>
          <button
            onClick={() => setShowFilter(true)}
            className={`relative w-9 h-9 rounded-lg border flex items-center justify-center text-sm transition-colors ${
              hasActiveFilter ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500'
            }`}>
            ⚙
            {hasActiveFilter && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full border border-white"/>
            )}
          </button>
        </div>

        {/* Quick filter chips */}
        <div className="flex gap-2 px-3 py-2 overflow-x-auto flex-shrink-0 bg-white border-b border-gray-100">
          {[
            { id: 'all',      label: 'All' },
            { id: 'today',    label: 'Today' },
            { id: 'unread',   label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
            { id: 'highval',  label: '💰 High value' },
          ].map(chip => (
            <button key={chip.id}
              onClick={() => {
                if (chip.id === 'unread')  filterChange('unreadOnly', !filters.unreadOnly);
                if (chip.id === 'highval') filterChange('highValue', !filters.highValue);
                if (chip.id === 'all') clearFilters();
              }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                (chip.id === 'unread' && filters.unreadOnly) ||
                (chip.id === 'highval' && filters.highValue)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 text-gray-600 bg-white'
              }`}>
              {chip.label}
            </button>
          ))}
        </div>

        {/* Tabs with counts */}
        <div className="flex border-b border-gray-200 bg-white flex-shrink-0">
          {[
            { id: 'open',  label: 'Open',  count: openChits.length },
            { id: 'act',   label: 'Progress', count: actChits.length },
            { id: 'close', label: 'Close', count: closedChits.length },
          ].map(t => (
            <button key={t.id}
              onClick={() => { setTab(t.id); sessionStorage.setItem('inboxTab', t.id); }}
              className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
                tab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
              }`}>
              {t.label}
              {t.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  tab === t.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Undo toast */}
        {activeUndo && (
          <UndoToast
            message={activeUndo.msg}
            onUndo={handleUndo}
            onDismiss={() => setActiveUndo(null)}
          />
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading...</div>
          ) : tabChits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <div className="text-4xl mb-3">📭</div>
              <div className="text-sm font-medium text-gray-600">
                {search || hasActiveFilter ? 'No results found' : 'Nothing here'}
              </div>
              <div className="text-xs mt-1 mb-6">
                {search || hasActiveFilter
                  ? 'Try clearing your search or filters'
                  : tab === 'open' ? 'No pending tasks — great work!'
                  : tab === 'act'  ? 'Nothing in progress'
                  : 'No closed transactions yet'}
              </div>
              {!search && !hasActiveFilter && tab === 'open' && (
                <button
                  onClick={() => navigate('/send')}
                  className="bg-blue-600 text-white text-xs px-4 py-2.5 rounded-lg font-medium">
                  ✏️ Compose new transaction
                </button>
              )}
            </div>
          ) : (
            ['Today','Yesterday','Earlier'].map(group => {
              const items = groups[group];
              if (!items || items.length === 0) return null;
              return (
                <div key={group}>
                  <div className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                    {group}
                  </div>
                  {items.map(chit => (
                    <ChitCard key={chit.chit_id} chit={chit}
                      onSwipeLeft={handleSwipeLeft}
                      onSwipeRight={() => {}}
                      isActor={isActor}
                      actorId={entity?.identity_id}
                      onPull={handlePull}
                      onAssignOpen={(id) => setAssigningChitId(p => p === id ? null : id)}
                      assigningChitId={assigningChitId}
                      actorList={actorList}
                      onPushToActor={handlePushToActor}
                      onAdvance={handleAdvance}
                      onRegress={handleRegress}
                      onDelete={setDeleteTarget}
                      onDisputeBlock={() => setDisputeBlock(true)}
                    />
                  ))}
                </div>
              );
            })
          )}
        </div>

        {/* Compose FAB */}
        <button
          onClick={() => navigate('/send')}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg text-2xl flex items-center justify-center active:scale-95 transition-transform md:hidden"
          aria-label="Compose">
          +
        </button>
      </div>

      {/* Advanced filter sheet */}
      {showFilter && (
        <FilterSheet
          filters={filters}
          onChange={filterChange}
          onClose={() => setShowFilter(false)}
          onClear={() => { clearFilters(); setShowFilter(false); }}
        />
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          chit={deleteTarget}
          deleting={deleting}
          onCancel={() => !deleting && setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {/* Dispute-block notice */}
      {disputeBlock && (
        <DisputeBlockModal onClose={() => setDisputeBlock(false)} />
      )}
    </Layout>
  );
}
