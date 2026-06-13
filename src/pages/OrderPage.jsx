// src/pages/OrderPage.jsx — Sender outbox — Order tab
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { getInbox, updateChitStatus } from '../api/client';
import { useAuth } from '../context/AuthContext';

const STATUS_PILL = {
  pending:     'bg-amber-100 text-amber-800',
  delivered:   'bg-blue-100 text-blue-800',
  accepted:    'bg-green-100 text-green-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed:   'bg-green-200 text-green-900',
  rejected:    'bg-red-100 text-red-800',
  cancelled:   'bg-gray-100 text-gray-600',
};

const STATUS_DOT = {
  pending:     'bg-amber-400',
  delivered:   'bg-blue-500',
  accepted:    'bg-green-500',
  in_progress: 'bg-purple-500',
  completed:   'bg-green-600',
  rejected:    'bg-red-500',
  cancelled:   'bg-gray-400',
};

const formatDate = (d) => {
  const date = new Date(d);
  const now = new Date();
  const diff = now - date;
  if (diff < 86400000) return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

export default function OrderPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);
  const [msg, setMsg] = useState('');
  const { entity } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { loadOrders(); }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      // Get all chits — filter to ones where I am the sender
      const res = await getInbox({ limit: 100 });
      const all = res.data.chits || [];
      // Sender = chits where sender_entity_display_name matches my name
      // We filter by checking if current entity sent it
      // API returns chits for my entity_id — we check sender
      const sent = all.filter(c => c.sender_entity_bridge_id === entity?.bridge_id ||
                                    c.sender_entity_display_name === entity?.display_name);
      setOrders(sent);
    } catch (err) {
      console.error('Order load error:', err);
    } finally { setLoading(false); }
  };

  const handleCancel = async (chitId, currentStatus) => {
    const allowed = ['pending','delivered','read','accepted','in_progress'];
    if (!allowed.includes(currentStatus)) {
      setMsg('Cannot cancel — transaction already completed or cancelled');
      setTimeout(() => setMsg(''), 3000);
      return;
    }
    setCancelling(chitId);
    try {
      await updateChitStatus(chitId, 'cancelled');
      setMsg('Order cancelled');
      setTimeout(() => setMsg(''), 3000);
      loadOrders();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Cancel failed');
      setTimeout(() => setMsg(''), 3000);
    } finally { setCancelling(null); }
  };

  const parseSummary = (s) => {
    try { return typeof s === 'string' ? JSON.parse(s) : s || {}; }
    catch { return {}; }
  };

  const openOrders   = orders.filter(o => !['completed','cancelled','rejected'].includes(o.current_status));
  const closedOrders = orders.filter(o => ['completed','cancelled','rejected'].includes(o.current_status));

  return (
    <Layout title="Order">
      <div className="flex flex-col max-w-lg mx-auto">

        {msg && (
          <div className="mx-4 mt-3 text-xs bg-blue-50 text-blue-700 p-3 rounded-xl border border-blue-200">{msg}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📤</div>
            <div className="text-sm">No orders sent yet</div>
            <button onClick={() => navigate('/send')}
              className="mt-4 text-blue-600 text-sm border border-blue-200 px-4 py-2 rounded-lg">
              Compose first order
            </button>
          </div>
        ) : (
          <>
            {/* Open orders */}
            {openOrders.length > 0 && (
              <>
                <div className="text-xs text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">
                  Active ({openOrders.length})
                </div>
                {openOrders.map(order => {
                  const summary = parseSummary(order.summary_json);
                  const canCancel = ['pending','delivered','read','accepted','in_progress'].includes(order.current_status);
                  return (
                    <div key={order.chit_id}
                      className="mx-4 mb-3 bg-white rounded-xl border border-gray-100 overflow-hidden">
                      {/* Card header — tap to open detail */}
                      <div className="p-3 cursor-pointer active:bg-gray-50"
                        onClick={() => navigate(`/chit/${order.chit_id}`)}>
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-gray-800 truncate">
                              {order.auto_subject}
                            </div>
                            {order.manual_subject && (
                              <div className="text-xs text-gray-400 italic truncate">"{order.manual_subject}"</div>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                            {formatDate(order.created_at)}
                          </span>
                        </div>
                        {summary.line_item_count && (
                          <div className="text-xs text-gray-500 mb-2">
                            {summary.line_item_count} item{summary.line_item_count !== 1 ? 's' : ''}
                            {summary.total_value && ` · INR ${parseFloat(summary.total_value).toLocaleString('en-IN')}`}
                          </div>
                        )}
                        {/* Status per receiver */}
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[order.current_status] || 'bg-gray-400'}`}/>
                            <span className="text-xs text-gray-500">
                              To: {order.sender_entity_display_name !== entity?.display_name
                                ? order.sender_entity_display_name : 'receiver'}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ml-auto ${STATUS_PILL[order.current_status] || 'bg-gray-100 text-gray-600'}`}>
                              {order.current_status}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Cancel button */}
                      {canCancel && (
                        <div className="border-t border-gray-100 px-3 py-2 flex justify-end">
                          <button
                            onClick={() => handleCancel(order.chit_id, order.current_status)}
                            disabled={cancelling === order.chit_id}
                            className="text-xs text-red-600 border border-red-200 px-3 py-1 rounded-lg disabled:opacity-40 hover:bg-red-50">
                            {cancelling === order.chit_id ? 'Cancelling...' : '✕ Cancel order'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* Closed orders */}
            {closedOrders.length > 0 && (
              <>
                <div className="text-xs text-gray-400 uppercase tracking-wide px-4 pt-2 pb-2">
                  Closed ({closedOrders.length})
                </div>
                {closedOrders.map(order => {
                  const summary = parseSummary(order.summary_json);
                  return (
                    <div key={order.chit_id}
                      className="mx-4 mb-3 bg-white rounded-xl border border-gray-100 p-3 opacity-70 cursor-pointer active:opacity-100"
                      onClick={() => navigate(`/chit/${order.chit_id}`)}>
                      <div className="flex items-start justify-between mb-1">
                        <div className="text-xs font-medium text-gray-600 truncate flex-1">{order.auto_subject}</div>
                        <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{formatDate(order.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_PILL[order.current_status] || 'bg-gray-100 text-gray-600'}`}>
                          {order.current_status}
                        </span>
                        {summary.total_value && (
                          <span className="text-xs text-gray-400">INR {parseFloat(summary.total_value).toLocaleString('en-IN')}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
