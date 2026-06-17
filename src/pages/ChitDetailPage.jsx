// src/pages/ChitDetailPage.jsx — Full detail with messaging + disputes (B3.5)
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getChitDetail, updateChitStatus, assignChit,
  sendMessage, getMessages, raiseDispute, getDisputes, resolveDispute,
} from '../api/client';

// ── Constants ────────────────────────────────────────────────

const STATUS_PILL = {
  pending:     'bg-amber-100 text-amber-800',
  delivered:   'bg-blue-100 text-blue-800',
  read:        'bg-blue-50 text-blue-700',
  accepted:    'bg-green-100 text-green-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed:   'bg-green-200 text-green-900',
  rejected:    'bg-red-100 text-red-800',
  cancelled:   'bg-gray-100 text-gray-600',
};

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
  in_progress: '▶ In Progress',
  partial:     '◑ Partial',
  completed:   '✓✓ Complete',
  cancelled:   '✕ Cancel',
};

const ACTION_STYLE = {
  accepted:    'bg-green-100 text-green-800 border-green-200',
  rejected:    'bg-red-100 text-red-800 border-red-200',
  in_progress: 'bg-purple-100 text-purple-800 border-purple-200',
  partial:     'bg-purple-50 text-purple-700 border-purple-200',
  completed:   'bg-green-200 text-green-900 border-green-300',
  cancelled:   'bg-gray-100 text-gray-600 border-gray-300',
};

const DISPUTE_CATEGORIES = [
  { value: 'quality',    label: 'Quality issue' },
  { value: 'quantity',   label: 'Quantity mismatch' },
  { value: 'delivery',   label: 'Delivery problem' },
  { value: 'payment',    label: 'Payment concern' },
  { value: 'docs',       label: 'Documentation error' },
  { value: 'other',      label: 'Other' },
];

const fmt      = (d) => d ? new Date(d).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
const fmtShort = (d) => d ? new Date(d).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '';
const fmtTime  = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) : '';

const parseJSON = (v) => {
  if (!v) return {};
  try { return typeof v === 'string' ? JSON.parse(v) : v; }
  catch { return {}; }
};

// ── Sub-components ───────────────────────────────────────────

function RaiseDisputeModal({ onClose, onSubmit, submitting }) {
  const [category, setCategory] = useState('quality');
  const [reason, setReason] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason.trim()) return;
    onSubmit({ category, reason: reason.trim() });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-5 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Raise a Dispute</h3>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white">
              {DISPUTE_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Description</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Describe the issue clearly..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 resize-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !reason.trim()}
            className="w-full bg-red-500 text-white text-sm font-medium py-2.5 rounded-xl disabled:opacity-50">
            {submitting ? 'Raising…' : 'Raise Dispute'}
          </button>
        </form>
      </div>
    </div>
  );
}

function DisputeBanner({ disputes, myEntityId, onResolve, resolving }) {
  const open = disputes.filter(d => d.status === 'open');
  if (open.length === 0) return null;

  return (
    <div className="mx-4 mt-3 mb-1 bg-red-50 border border-red-200 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-red-500 text-base">⚠️</span>
        <span className="text-xs font-semibold text-red-700">
          {open.length} Open Dispute{open.length > 1 ? 's' : ''}
        </span>
      </div>
      {open.map(d => (
        <ResolveInline
          key={d.dispute_id}
          dispute={d}
          myEntityId={myEntityId}
          onResolve={onResolve}
          resolving={resolving}
        />
      ))}
    </div>
  );
}

function ResolveInline({ dispute, myEntityId, onResolve, resolving }) {
  const [resolutionNote, setResolutionNote] = useState('');
  const [expanded, setExpanded] = useState(false);
  const canResolve = dispute.raised_by_entity_id === myEntityId;

  const categoryLabel = DISPUTE_CATEGORIES.find(c => c.value === dispute.category)?.label || dispute.category;

  return (
    <div className="bg-white rounded-lg border border-red-100 p-3 mb-2 last:mb-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-red-700">{categoryLabel}</div>
          <div className="text-xs text-gray-600 mt-0.5 leading-snug">{dispute.reason}</div>
          <div className="text-xs text-gray-400 mt-1">
            Raised by {dispute.raised_by_display_name} · {fmtShort(dispute.created_at)}
          </div>
        </div>
        {canResolve && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex-shrink-0 text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg">
            {expanded ? 'Cancel' : 'Resolve'}
          </button>
        )}
      </div>
      {expanded && canResolve && (
        <div className="mt-2 pt-2 border-t border-red-100">
          <textarea
            value={resolutionNote}
            onChange={e => setResolutionNote(e.target.value)}
            rows={2}
            placeholder="Resolution note (optional)…"
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs resize-none"
          />
          <button
            onClick={() => onResolve(dispute.dispute_id, resolutionNote)}
            disabled={resolving}
            className="mt-1.5 w-full bg-green-500 text-white text-xs font-medium py-1.5 rounded-lg disabled:opacity-50">
            {resolving ? 'Resolving…' : 'Mark Resolved'}
          </button>
        </div>
      )}
    </div>
  );
}

function InternalSeparator() {
  return (
    <div className="flex items-center gap-2 my-3">
      <div className="flex-1 border-t-2 border-dashed border-green-300"/>
      <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-2.5 py-1 flex-shrink-0">
        <span className="text-xs font-medium text-green-700">Internal — your team only</span>
        <span className="text-xs bg-green-200 text-green-800 px-1.5 py-0.5 rounded-full font-medium">never seen by customer</span>
      </div>
      <div className="flex-1 border-t-2 border-dashed border-green-300"/>
    </div>
  );
}

function MessageBubbles({ msgs, myEntityId, isInternalSection }) {
  let lastDate = null;
  return msgs.map((m) => {
    const msgDate = new Date(m.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
    const showDate = msgDate !== lastDate;
    lastDate = msgDate;
    const isMe = m.sender_entity_id === myEntityId;
    const isInternal = isInternalSection || m.visibility_entity_id != null;
    return (
      <div key={m.message_id}>
        {showDate && <div className="text-center text-xs text-gray-400 my-2">{msgDate}</div>}
        <div className={`flex mb-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-xs rounded-2xl px-3 py-2 ${
            isInternal
              ? 'bg-green-50 border border-green-200 text-green-900'
              : isMe
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-800'
          }`}>
            {!isMe && (
              <div className={`text-xs font-medium mb-0.5 ${isInternal ? 'text-green-700' : 'text-gray-500'}`}>
                {m.sender_display_name}
              </div>
            )}
            <div className="text-xs leading-relaxed break-words">{m.message_text}</div>
            <div className={`text-xs mt-1 text-right ${
              isInternal ? 'text-green-500' : isMe ? 'text-blue-200' : 'text-gray-400'
            }`}>
              {fmtTime(m.created_at)}
            </div>
          </div>
        </div>
      </div>
    );
  });
}

function MessageThread({ messages, myEntityId, thread }) {
  const externals = messages.filter(m => m.visibility_entity_id == null);
  const internals = messages.filter(m => m.visibility_entity_id != null);

  if (thread === 'external') {
    if (externals.length === 0)
      return <div className="text-xs text-gray-400 text-center py-6">No messages yet</div>;
    return <div className="px-4 py-2"><MessageBubbles msgs={externals} myEntityId={myEntityId} isInternalSection={false}/></div>;
  }

  if (thread === 'internal') {
    if (internals.length === 0)
      return <div className="text-xs text-gray-400 text-center py-6">No internal messages yet</div>;
    return <div className="px-4 py-2"><MessageBubbles msgs={internals} myEntityId={myEntityId} isInternalSection={true}/></div>;
  }

  // All — externals first, separator, then internals
  if (externals.length === 0 && internals.length === 0)
    return <div className="text-xs text-gray-400 text-center py-6">No messages yet</div>;

  return (
    <div className="px-4 py-2">
      <MessageBubbles msgs={externals} myEntityId={myEntityId} isInternalSection={false}/>
      {internals.length > 0 && <InternalSeparator/>}
      <MessageBubbles msgs={internals} myEntityId={myEntityId} isInternalSection={true}/>
    </div>
  );
}

function MessageBar({ onSend, sending }) {
  const [extText, setExtText] = useState('');
  const [intText, setIntText] = useState('');
  const extRef = useRef(null);
  const intRef = useRef(null);

  const handleExt = () => {
    if (!extText.trim() || sending) return;
    onSend(extText.trim(), false);
    setExtText('');
    extRef.current?.focus();
  };

  const handleInt = () => {
    if (!intText.trim() || sending) return;
    onSend(intText.trim(), true);
    setIntText('');
    intRef.current?.focus();
  };

  return (
    <div className="border-t border-gray-200 bg-white px-3 pt-2 pb-3 flex-shrink-0 space-y-2">
      {/* External bar — blue */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-2xl px-3 py-2">
          <span className="text-xs font-semibold text-blue-500 flex-shrink-0">Ext</span>
          <input
            ref={extRef}
            value={extText}
            onChange={e => setExtText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleExt(); } }}
            placeholder="Message all parties…"
            className="flex-1 bg-transparent text-xs text-blue-900 placeholder-blue-300 focus:outline-none"
          />
        </div>
        <button onClick={handleExt} disabled={sending || !extText.trim()}
          className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-40">
          ↑
        </button>
      </div>
      {/* Internal bar — green */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-green-50 border border-green-200 rounded-2xl px-3 py-2">
          <span className="text-xs font-semibold text-green-600 flex-shrink-0">Int</span>
          <input
            ref={intRef}
            value={intText}
            onChange={e => setIntText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleInt(); } }}
            placeholder="Your team only — never sent to customer…"
            className="flex-1 bg-transparent text-xs text-green-900 placeholder-green-400 focus:outline-none"
          />
        </div>
        <button onClick={handleInt} disabled={sending || !intText.trim()}
          className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-green-600 text-white disabled:opacity-40">
          ↑
        </button>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function ChitDetailPage() {
  const { chitId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { entity, isActor, parentEntityId } = useAuth();

  const [data, setData]           = useState(null);
  const [messages, setMessages]   = useState([]);
  const [disputes, setDisputes]   = useState([]);
  const [tab, setTab]             = useState(searchParams.get('tab') || 'details');
  const [thread, setThread]       = useState('all');
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [updating, setUpdating]   = useState(false);
  const [sending, setSending]     = useState(false);
  const [resolving, setResolving] = useState(false);
  const [showDispute, setShowDispute]     = useState(false);
  const [submitDispute, setSubmitDispute] = useState(false);
  const [msg, setMsg]             = useState('');
  const threadBottomRef = useRef(null);

  useEffect(() => { loadAll(); }, [chitId]);

  useEffect(() => {
    if (tab === 'status') {
      setTimeout(() => threadBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [tab, messages]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [chitRes, msgRes, dispRes] = await Promise.all([
        getChitDetail(chitId),
        getMessages(chitId, 'all').catch(() => ({ data: { messages: [] } })),
        getDisputes(chitId).catch(() => ({ data: { disputes: [] } })),
      ]);
      setData(chitRes.data);
      setMessages(msgRes.data.messages || []);
      setDisputes(dispRes.data.disputes || []);
    } catch { setError('Could not load — check your connection'); }
    finally { setLoading(false); }
  };

  const showFlash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  const doAction = async (status) => {
    setUpdating(true); setMsg('');
    try {
      await updateChitStatus(chitId, status);
      showFlash(`Status updated to ${status}`);
      await loadAll();
    } catch (err) {
      showFlash(err.response?.data?.message || 'Update failed');
    } finally { setUpdating(false); }
  };

  const doPull = async () => {
    setUpdating(true);
    try {
      await assignChit(chitId, { action: 'pull' });
      showFlash('Pulled to My Task');
      await loadAll();
    } catch (err) {
      showFlash(err.response?.data?.message || 'Pull failed');
    } finally { setUpdating(false); }
  };

  const doReturn = async () => {
    setUpdating(true);
    try {
      await assignChit(chitId, { action: 'return' });
      showFlash('Returned to entity pool');
      await loadAll();
    } catch (err) {
      showFlash(err.response?.data?.message || 'Return failed');
    } finally { setUpdating(false); }
  };

  const handleSendMessage = async (text, isInternal) => {
    setSending(true);
    try {
      await sendMessage(chitId, { message_text: text, is_internal: isInternal });
      const res = await getMessages(chitId, 'all');
      setMessages(res.data.messages || []);
    } catch (err) {
      showFlash(err.response?.data?.message || 'Send failed');
    } finally { setSending(false); }
  };

  const handleRaiseDispute = async ({ category, reason }) => {
    setSubmitDispute(true);
    try {
      await raiseDispute(chitId, { category, reason });
      setShowDispute(false);
      showFlash('Dispute raised');
      const res = await getDisputes(chitId);
      setDisputes(res.data.disputes || []);
    } catch (err) {
      showFlash(err.response?.data?.message || 'Failed to raise dispute');
    } finally { setSubmitDispute(false); }
  };

  const handleResolveDispute = async (disputeId, resolutionNote) => {
    setResolving(true);
    try {
      await resolveDispute(chitId, disputeId, { resolution_note: resolutionNote });
      showFlash('Dispute resolved');
      const res = await getDisputes(chitId);
      setDisputes(res.data.disputes || []);
    } catch (err) {
      showFlash(err.response?.data?.message || 'Failed to resolve');
    } finally { setResolving(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Loading...</div>
  );
  if (error || !data) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <div className="text-4xl">⚠️</div>
      <div className="text-sm text-gray-500">{error || 'Not found'}</div>
      <button onClick={() => navigate(-1)} className="text-blue-600 text-sm">Go back</button>
    </div>
  );

  const { header, detail, participants, state_log } = data;
  const summary   = parseJSON(header?.summary_json);
  const lineItems = (() => {
    const li = detail?.line_items;
    if (!li) return [];
    try { return typeof li === 'string' ? JSON.parse(li) : li; }
    catch { return []; }
  })();

  const effectiveEntityId = isActor ? parentEntityId : entity?.identity_id;
  const myParticipant = participants?.find(p => p.entity_id === effectiveEntityId);
  const myStatus = myParticipant?.current_status || header?.current_status || 'pending';

  const isSender = isActor ? false : (
    header?.sender_entity_bridge_id === entity?.bridge_id ||
    header?.sender_entity_display_name === entity?.display_name
  );
  const validActions = isSender ? [] : (VALID_TRANSITIONS[myStatus] || []);

  const assignedActorId = myParticipant?.assigned_to_actor_id;
  const isAssignedToMe  = assignedActorId === entity?.identity_id;
  const isUnassigned    = !assignedActorId;

  const openDisputeCount = disputes.filter(d => d.status === 'open').length;
  const hasOpenDisputes  = openDisputeCount > 0;
  const sortedLog = [...(state_log || [])].reverse();
  const headerBg = hasOpenDisputes ? 'bg-red-600' : 'bg-blue-600';

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className={`${headerBg} flex-shrink-0 transition-colors`}>
        <div className="flex items-center px-4 py-3 gap-3">
          <button onClick={() => navigate(-1)} className="text-white text-lg">←</button>
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs opacity-70 font-mono">
              {header?.purpose?.toUpperCase()}/{header?.chit_id?.slice(-6)?.toUpperCase()}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {hasOpenDisputes && (
              <span className="text-xs bg-white bg-opacity-20 text-white px-1.5 py-0.5 rounded-full font-medium">
                ⚠️ {openDisputeCount}
              </span>
            )}
            {messages.length > 0 && (
              <span className="text-xs bg-white bg-opacity-20 text-white px-1.5 py-0.5 rounded-full font-medium">
                💬 {messages.length}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_PILL[myStatus] || 'bg-gray-100 text-gray-600'}`}>
              {myStatus}
            </span>
          </div>
        </div>
        <div className="px-4 pb-2">
          <div className="text-white text-sm font-medium leading-tight">{header?.auto_subject}</div>
          {header?.manual_subject && (
            <div className="text-blue-200 text-xs italic mt-0.5">"{header.manual_subject}"</div>
          )}
        </div>
        <div className="flex gap-2 px-4 pb-2 overflow-x-auto">
          {summary.line_item_count > 0 && (
            <span className="bg-white bg-opacity-20 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0">
              📦 {summary.line_item_count} items
            </span>
          )}
          {summary.total_value && (
            <span className="bg-white bg-opacity-20 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0">
              {summary.currency_code || 'INR'} {parseFloat(summary.total_value).toLocaleString('en-IN')}
            </span>
          )}
          <span className="bg-white bg-opacity-20 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0">
            {fmtShort(header?.created_at)}
          </span>
        </div>
        {validActions.length > 0 && (
          <div className="flex gap-2 px-4 pb-3">
            {validActions.map(action => (
              <button key={action} onClick={() => doAction(action)} disabled={updating}
                className={`flex-1 text-xs font-medium py-2 px-2 rounded-lg border disabled:opacity-50 ${ACTION_STYLE[action]}`}>
                {ACTION_LABELS[action]}
              </button>
            ))}
          </div>
        )}
        {msg && (
          <div className="mx-4 mb-3 text-xs bg-white bg-opacity-20 text-white px-3 py-1.5 rounded-lg">{msg}</div>
        )}
      </div>

      {/* Participants bar */}
      {participants && participants.length > 0 && (
        <div className="flex gap-3 px-4 py-2 bg-white border-b border-gray-100 overflow-x-auto flex-shrink-0">
          <span className="text-xs text-gray-400 self-center flex-shrink-0">Participants:</span>
          {participants.map(p => (
            <div key={p.entity_id} className="flex items-center gap-1 flex-shrink-0">
              <div className={`w-1.5 h-1.5 rounded-full ${
                p.current_status === 'completed' || p.current_status === 'accepted' ? 'bg-green-500' :
                p.current_status === 'rejected'  || p.current_status === 'cancelled' ? 'bg-red-500' :
                p.current_status === 'in_progress' ? 'bg-purple-500' : 'bg-amber-400'
              }`}/>
              <span className="text-xs text-gray-600">{p.display_name}</span>
              <span className={`text-xs px-1 py-0.5 rounded ${STATUS_PILL[p.current_status] || 'bg-gray-100 text-gray-500'}`}>
                {p.current_status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white flex-shrink-0">
        {[
          { id: 'details', label: 'Details' },
          { id: 'status',  label: messages.length > 0 ? `Status · ${messages.length}` : 'Status' },
          { id: 'summary', label: 'Summary' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 flex flex-col">

        {/* DETAILS */}
        {tab === 'details' && (
          <div className="flex-1 overflow-y-auto p-4">
            {lineItems.length > 0 ? (
              <>
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">
                  Line items — {lineItems.length}
                </div>
                {lineItems.map((item, i) => {
                  const cur = detail?.currency_code || 'INR';
                  const qty = item.quantity != null ? item.quantity
                    : (item.qty_min != null ? `${item.qty_min}–${item.qty_max}` : '—');
                  const unitPrice = item.price != null ? item.price
                    : (item.price_min != null ? `${item.price_min}–${item.price_max}` : null);
                  const lineTotal = parseFloat(item.total || 0) ||
                    (item.price && item.quantity ? item.price * item.quantity : null);
                  return (
                    <div key={i} className="bg-white rounded-xl border border-gray-100 p-3 mb-3">
                      <div className="font-medium text-sm text-gray-900 mb-2">
                        {item.particulars || item.name || item.product || '—'}
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Quantity</span>
                          <span className="text-gray-800">{qty}</span>
                        </div>
                        {unitPrice != null && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Unit price</span>
                            <span className="text-gray-800">{cur} {typeof unitPrice === 'number' ? parseFloat(unitPrice).toFixed(2) : unitPrice}</span>
                          </div>
                        )}
                      </div>
                      {lineTotal != null && (
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                          <span className="text-xs text-gray-400">Total</span>
                          <span className="text-sm font-semibold text-blue-700">
                            {cur} {parseFloat(lineTotal).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : detail?.payload_deleted_at ? (
              <div className="text-center py-8">
                <div className="text-2xl mb-2">🔒</div>
                <div className="text-sm text-gray-500">Payload delivered and cleared</div>
                <div className="text-xs text-gray-400 mt-1">Fire and forget delivery completed</div>
              </div>
            ) : (
              <div className="text-sm text-gray-400 text-center py-8">No line items</div>
            )}
          </div>
        )}

        {/* STATUS — disputes + messages + timeline */}
        {tab === 'status' && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 overflow-y-auto">
              {/* Dispute banner */}
              <DisputeBanner
                disputes={disputes}
                myEntityId={effectiveEntityId}
                onResolve={handleResolveDispute}
                resolving={resolving}
              />

              {/* Thread toggle + raise dispute */}
              <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                <div className="flex-1 flex gap-1 bg-gray-100 rounded-lg p-0.5">
                  {['all','external','internal'].map(t => (
                    <button key={t} onClick={() => setThread(t)}
                      className={`flex-1 text-xs py-1 rounded-md font-medium capitalize transition-colors ${
                        thread === t ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowDispute(true)}
                  className="flex-shrink-0 text-xs bg-red-50 text-red-600 border border-red-200 px-2.5 py-1.5 rounded-lg font-medium">
                  ⚠️ Dispute
                </button>
              </div>

              {/* Messages */}
              <MessageThread
                messages={messages}
                myEntityId={effectiveEntityId}
                thread={thread}
              />

              {/* Timeline divider */}
              <div className="flex items-center gap-2 mx-4 my-3">
                <div className="flex-1 h-px bg-gray-200"/>
                <span className="text-xs text-gray-400">Activity</span>
                <div className="flex-1 h-px bg-gray-200"/>
              </div>

              {/* Timeline */}
              <div className="px-4 pb-4">
                {sortedLog.length === 0 ? (
                  <div className="text-sm text-gray-400 text-center py-4">No activity yet</div>
                ) : sortedLog.map((log, i) => (
                  <div key={i} className="flex gap-3 mb-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${
                        log.action === 'created'                ? 'bg-green-500' :
                        log.action?.includes('completed')       ? 'bg-green-600' :
                        log.action?.includes('rejected')        ? 'bg-red-500' :
                        log.action?.includes('cancelled')       ? 'bg-gray-500' :
                        log.action?.includes('dispute')         ? 'bg-red-400' :
                        'border-2 border-blue-500 bg-white'
                      }`}/>
                      {i < sortedLog.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1 mb-1"/>}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-800 capitalize">
                        {log.action?.replace(/_/g,' ')}
                      </div>
                      {log.action_by_display_name && (
                        <div className="text-xs text-gray-500">By: {log.action_by_display_name}</div>
                      )}
                      {log.detail && <div className="text-xs text-gray-400 mt-0.5">{log.detail}</div>}
                      <div className="text-xs text-gray-400 mt-0.5">{fmtShort(log.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div ref={threadBottomRef}/>
            </div>

            {/* Message bar pinned to bottom of status tab */}
            <MessageBar
              onSend={handleSendMessage}
              sending={sending}
            />
          </div>
        )}

        {/* SUMMARY */}
        {tab === 'summary' && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">Transaction summary</div>
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
              {[
                ['Purpose', header?.purpose],
                ['From',    header?.sender_entity_display_name],
                ['Sent',    fmt(header?.created_at)],
                ['Items',   detail?.line_item_count || summary.line_item_count || '—'],
                ['Total',   detail?.total_value ? `${detail.currency_code || summary.currency_code || 'INR'} ${parseFloat(detail.total_value).toFixed(2)}` : '—'],
                ['Currency', detail?.currency_code || 'INR'],
                ['Reference', header?.chit_id?.slice(0,8) + '…'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between px-4 py-2.5 text-xs">
                  <span className="text-gray-500">{label}</span>
                  <span className="text-gray-800 font-medium text-right max-w-48 truncate">{value}</span>
                </div>
              ))}
            </div>

            {disputes.length > 0 && (
              <>
                <div className="text-xs text-gray-400 uppercase tracking-wide mt-4 mb-2">Disputes</div>
                <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
                  {disputes.map(d => (
                    <div key={d.dispute_id} className="px-4 py-2.5 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium text-gray-800 capitalize">{d.category}</div>
                        <div className="text-xs text-gray-500 truncate max-w-48">{d.reason}</div>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        d.status === 'open' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {d.status}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {participants && participants.length > 0 && (
              <>
                <div className="text-xs text-gray-400 uppercase tracking-wide mt-4 mb-2">All participants</div>
                <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
                  {participants.map(p => (
                    <div key={p.entity_id} className="flex justify-between items-center px-4 py-2.5">
                      <div>
                        <div className="text-xs font-medium text-gray-800">{p.display_name}</div>
                        <div className="text-xs text-gray-400">{p.bridge_id}</div>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_PILL[p.current_status] || 'bg-gray-100 text-gray-500'}`}>
                        {p.current_status}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Raise dispute modal */}
      {showDispute && (
        <RaiseDisputeModal
          onClose={() => setShowDispute(false)}
          onSubmit={handleRaiseDispute}
          submitting={submitDispute}
        />
      )}
    </div>
  );
}
