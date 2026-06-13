// src/pages/InboxPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable';
import { Layout } from '../components/Layout';
import { DevBadge } from '../components/DevBadge';
import { useAppMode } from '../context/AppModeContext';
import { FEATURES } from '../config/features';
import { getInbox, updateChitStatus } from '../api/client';

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

const ChitCard = ({ chit, onSwipeLeft, onSwipeRight, onLongPress }) => {
  const navigate = useNavigate();

  const handlers = useSwipeable({
    onSwipedLeft:  () => onSwipeLeft(chit),
    onSwipedRight: () => onSwipeRight(chit),
    onTap:         () => navigate(`/chit/${chit.chit_id}`),
    delta: 60,
    preventScrollOnSwipe: true,
    trackMouse: false,
  });

  const formatDate = (d) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now - date;
    if (diff < 86400000) return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return date.toLocaleDateString('en-IN', { weekday: 'short' });
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const summary = typeof chit.summary_json === 'string'
    ? JSON.parse(chit.summary_json || '{}')
    : chit.summary_json || {};

  const isUnread = !chit.read_at;

  return (
    <div
      {...handlers}
      onContextMenu={(e) => { e.preventDefault(); onLongPress(chit); }}
      className={`border-l-4 ${STATUS_BORDER[chit.current_status] || 'border-l-gray-200'} 
                  bg-white border-b border-gray-100 px-3 py-2.5 active:bg-gray-50
                  select-none cursor-pointer`}
    >
      <div className="flex items-start justify-between mb-1">
        <span className={`text-xs ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'}`}>
          {chit.sender_entity_display_name}
        </span>
        <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
          {formatDate(chit.created_at)}
        </span>
      </div>
      <div className={`text-xs mb-1 truncate ${isUnread ? 'text-gray-800' : 'text-gray-600'}`}>
        {chit.auto_subject}
      </div>
      {chit.manual_subject && (
        <div className="text-xs text-gray-400 italic truncate mb-1">
          "{chit.manual_subject}"
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_PILL[chit.current_status] || 'bg-gray-100 text-gray-600'}`}>
          {chit.current_status}
        </span>
        {summary.line_item_count && (
          <span className="text-xs text-gray-400">
            {summary.line_item_count} items
            {summary.total_value && ` · INR ${parseFloat(summary.total_value).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`}
          </span>
        )}
      </div>
    </div>
  );
};

export default function InboxPage() {
  const [tab, setTab]     = useState('open');
  const [chits, setChits] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isVisible, showDevBadges } = useAppMode();
  const navigate = useNavigate();

  useEffect(() => { loadChits(); }, [tab]);

  const loadChits = async () => {
    try {
      setLoading(true);
      const params = {};
      if (tab === 'closed') params.status = 'completed';
      const res = await getInbox(params);
      setChits(res.data.chits || []);
    } catch (err) {
      console.error('Inbox error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwipeLeft = async (chit) => {
    if (['pending', 'delivered', 'read', 'accepted'].includes(chit.current_status)) {
      try {
        await updateChitStatus(chit.chit_id, 'completed');
        loadChits();
      } catch {}
    }
  };

  const handleSwipeRight = (chit) => {
    console.log('Swipe right — reopen:', chit.chit_id);
  };

  const handleLongPress = (chit) => {
    console.log('Long press — assignment panel for:', chit.chit_id);
    // Assignment bottom sheet — IT-2
  };

  const openChits = chits.filter(c => !['completed','cancelled','rejected'].includes(c.current_status));
  const actChits  = chits.filter(c => c.assigned_to_actor_id);
  const closedChits = chits.filter(c => ['completed','cancelled','rejected'].includes(c.current_status));
  const tabChits  = tab === 'open' ? openChits : tab === 'act' ? actChits : closedChits;

  return (
    <Layout title="All Task">
      <div className="flex flex-col h-full">

        {/* Dev badges */}
        {showDevBadges && (
          <div className="px-3 pt-2">
            <DevBadge feature={FEATURES.inbox_all_task} />
            <DevBadge feature={FEATURES.inbox_tabs} />
            <DevBadge feature={FEATURES.inbox_swipe_gestures} />
            {isVisible(FEATURES.inbox_long_press_assign) && (
              <DevBadge feature={FEATURES.inbox_long_press_assign} />
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-white flex-shrink-0">
          {[
            { id: 'open', label: `Open [${openChits.length}]` },
            { id: 'act',  label: 'Act' },
            { id: 'close', label: 'Close' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Chit list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
              Loading...
            </div>
          ) : tabChits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <div className="text-4xl mb-3">📭</div>
              <div className="text-sm">Nothing here</div>
            </div>
          ) : (
            tabChits.map(chit => (
              <ChitCard
                key={chit.chit_id}
                chit={chit}
                onSwipeLeft={handleSwipeLeft}
                onSwipeRight={handleSwipeRight}
                onLongPress={handleLongPress}
              />
            ))
          )}
        </div>

        {/* FAB */}
        <button
          onClick={() => navigate('/send')}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg text-2xl flex items-center justify-center active:scale-95 transition-transform"
          aria-label="New chit"
        >
          +
        </button>

      </div>
    </Layout>
  );
}
