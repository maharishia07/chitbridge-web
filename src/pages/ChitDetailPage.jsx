// src/pages/ChitDetailPage.jsx — Full detail with three tabs
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getChitDetail, updateChitStatus, assignChit } from '../api/client';

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

const fmt = (d) => d ? new Date(d).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
const fmtShort = (d) => d ? new Date(d).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '';

const parseJSON = (v) => {
  if (!v) return {};
  try { return typeof v === 'string' ? JSON.parse(v) : v; }
  catch { return {}; }
};

export default function ChitDetailPage() {
  const { chitId } = useParams();
  const navigate = useNavigate();
  const { entity, isActor, parentEntityId } = useAuth();
  const [data, setData]       = useState(null);
  const [tab, setTab]         = useState('details');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [updating, setUpdating] = useState(false);
  const [msg, setMsg]         = useState('');

  useEffect(() => { load(); }, [chitId]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getChitDetail(chitId);
      setData(res.data);
    } catch { setError('Could not load — check your connection'); }
    finally { setLoading(false); }
  };

  const doAction = async (status) => {
    setUpdating(true); setMsg('');
    try {
      await updateChitStatus(chitId, status);
      setMsg(`Status updated to ${status}`);
      await load();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Update failed');
    } finally { setUpdating(false); }
  };

  const doPull = async () => {
    setUpdating(true); setMsg('');
    try {
      await assignChit(chitId, { action: 'pull' });
      setMsg('Pulled to My Task');
      await load();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Pull failed');
    } finally { setUpdating(false); }
  };

  const doReturn = async () => {
    setUpdating(true); setMsg('');
    try {
      await assignChit(chitId, { action: 'return' });
      setMsg('Returned to entity pool');
      await load();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Return failed');
    } finally { setUpdating(false); }
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
  const summary = parseJSON(header?.summary_json);
  const lineItems = (() => {
    const li = detail?.line_items;
    if (!li) return [];
    try { return typeof li === 'string' ? JSON.parse(li) : li; }
    catch { return []; }
  })();

  // Actors are keyed by their parent entity in chit_status — use parentEntityId for lookup
  const effectiveEntityId = isActor ? parentEntityId : entity?.identity_id;
  const myParticipant = participants?.find(p => p.entity_id === effectiveEntityId);
  const myStatus = myParticipant?.current_status || header?.current_status || 'pending';

  // Actors never send chits in the current model; entities check by bridge_id
  const isSender = isActor ? false : (
    header?.sender_entity_bridge_id === entity?.bridge_id ||
    header?.sender_entity_display_name === entity?.display_name
  );
  const validActions = isSender ? [] : (VALID_TRANSITIONS[myStatus] || []);

  // Actor pull/return state — is this chit assigned, and is it assigned to me?
  const assignedActorId = myParticipant?.assigned_to_actor_id;
  const isAssignedToMe  = assignedActorId === entity?.identity_id;
  const isUnassigned    = !assignedActorId;

  const sortedLog = [...(state_log || [])].reverse();

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 flex-shrink-0">
        <div className="flex items-center px-4 py-3 gap-3">
          <button onClick={() => navigate(-1)} className="text-white text-lg">←</button>
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs opacity-70 font-mono">
              {header?.purpose?.toUpperCase()}/{header?.chit_id?.slice(-6)?.toUpperCase()}
            </div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_PILL[myStatus] || 'bg-gray-100 text-gray-600'}`}>
            {myStatus}
          </span>
        </div>
        <div className="px-4 pb-2">
          <div className="text-white text-sm font-medium leading-tight">{header?.auto_subject}</div>
          {header?.manual_subject && (
            <div className="text-blue-200 text-xs italic mt-0.5">"{header.manual_subject}"</div>
          )}
        </div>
        {/* Summary chips */}
        <div className="flex gap-2 px-4 pb-2 overflow-x-auto">
          {summary.line_item_count > 0 && (
            <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0">
              📦 {summary.line_item_count} items
            </span>
          )}
          {summary.total_value && (
            <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0">
              INR {parseFloat(summary.total_value).toLocaleString('en-IN')}
            </span>
          )}
          <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0">
            {fmtShort(header?.created_at)}
          </span>
        </div>
        {/* Action buttons */}
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
                p.current_status === 'rejected' || p.current_status === 'cancelled' ? 'bg-red-500' :
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
        {['details','status','summary'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors capitalize ${
              tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">

        {/* DETAILS */}
        {tab === 'details' && (
          <div className="p-4">
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

        {/* STATUS — timeline newest first */}
        {tab === 'status' && (
          <div className="p-4">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">Activity — newest first</div>
            {sortedLog.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-8">No activity yet</div>
            ) : sortedLog.map((log, i) => (
              <div key={i} className="flex gap-3 mb-4">
                <div className="flex flex-col items-center">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${
                    log.action === 'created' ? 'bg-green-500' :
                    log.action?.includes('completed') ? 'bg-green-600' :
                    log.action?.includes('rejected') ? 'bg-red-500' :
                    log.action?.includes('cancelled') ? 'bg-gray-500' :
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
        )}

        {/* SUMMARY */}
        {tab === 'summary' && (
          <div className="p-4">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">Transaction summary</div>
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
              {[
                ['Purpose', header?.purpose],
                ['From', header?.sender_entity_display_name],
                ['Sent', fmt(header?.created_at)],
                ['Items', detail?.line_item_count || summary.line_item_count || '—'],
                ['Total', detail?.total_value ? `INR ${parseFloat(detail.total_value).toFixed(2)}` : '—'],
                ['Currency', detail?.currency_code || 'INR'],
                ['Reference', header?.chit_id?.slice(0,8) + '...'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between px-4 py-2.5 text-xs">
                  <span className="text-gray-500">{label}</span>
                  <span className="text-gray-800 font-medium text-right max-w-48 truncate">{value}</span>
                </div>
              ))}
            </div>

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
    </div>
  );
}
