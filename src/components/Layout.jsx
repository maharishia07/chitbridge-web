// src/components/Layout.jsx — B3.4
// B3.4 additions:
//   Bell notification badge in top bar
//   Notification centre page
//   Language switcher EN/TA/HI in header
//   Green header for actor (already existed — polished)
//   Break banner persistent
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppMode } from '../context/AppModeContext';
import { getConnections, getPendingConnections, getInbox, listActors } from '../api/client';

// Language options — B3.4
const LANGUAGES = [
  { code: 'en', label: 'EN', full: 'English', available: true },
  { code: 'ta', label: 'தமிழ்', full: 'Tamil', available: false },
  { code: 'hi', label: 'हिं', full: 'Hindi', available: false },
];

const NavItem = ({ icon, label, to, badge, badgeColour = 'blue', onClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const active = to && (location.pathname === to || (to !== '/inbox' && location.pathname.startsWith(to)));
  return (
    <button
      onClick={() => { if (to) navigate(to); if (onClick) onClick(); }}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all ${
        active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
      }`}>
      <span className="text-sm">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge > 0 && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
          badgeColour === 'orange' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
        }`}>{badge}</span>
      )}
    </button>
  );
};

// ── Notification Centre ──────────────────────────────────────
const NotificationCentre = ({ chits = [], onClose, onNavigate }) => {
  const notifications = chits
    .filter(c => !c.read_at)
    .slice(0, 20)
    .map(c => ({
      id: c.chit_id,
      icon: c.current_status === 'pending' ? '📦'
          : c.current_status === 'completed' ? '✅'
          : c.current_status === 'rejected' ? '✗'
          : '📋',
      title: `${c.current_status === 'pending' ? 'New' : ''} ${c.purpose || 'transaction'} from ${c.sender_entity_display_name}`,
      sub: c.auto_subject,
      time: c.created_at,
      chitId: c.chit_id,
    }));

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="ml-auto w-80 max-w-full h-full bg-white shadow-xl flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-blue-600">
          <span className="text-sm font-medium text-white">Notifications</span>
          <button onClick={onClose} className="text-blue-200 text-lg leading-none">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <div className="text-3xl mb-2">🔔</div>
              <div className="text-sm">All caught up!</div>
            </div>
          ) : notifications.map(n => (
            <button key={n.id}
              onClick={() => { onNavigate(`/chit/${n.chitId}`); onClose(); }}
              className="w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-blue-50 flex gap-3 items-start">
              <span className="text-lg flex-shrink-0">{n.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-900 line-clamp-1">{n.title}</div>
                <div className="text-xs text-gray-500 line-clamp-1 mt-0.5">{n.sub}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {new Date(n.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1"/>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-gray-100">
          <button onClick={() => { onNavigate('/inbox'); onClose(); }}
            className="w-full text-xs text-blue-600 font-medium py-2">
            View all in All Task →
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Language Switcher ────────────────────────────────────────
const LangSwitcher = ({ current, onChange }) => (
  <div className="flex gap-1">
    {LANGUAGES.map(l => (
      <button key={l.code}
        onClick={() => l.available && onChange(l.code)}
        title={l.available ? l.full : `${l.full} — coming soon`}
        className={`text-xs px-1.5 py-0.5 rounded font-medium transition-colors ${
          current === l.code
            ? 'bg-white text-blue-700'
            : l.available
              ? 'text-blue-200 hover:text-white'
              : 'text-blue-300/50 cursor-not-allowed'
        }`}>
        {l.label}
        {!l.available && <span className="text-blue-400/60 text-xs ml-0.5">*</span>}
      </button>
    ))}
  </div>
);

// ── Main Layout ──────────────────────────────────────────────
export const Layout = ({ children, title, unreadCount = 0 }) => {
  const { entity, logout, isActor, parentEntity, actorKey, actorRole } = useAuth();
  const { mode } = useAppMode();
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [showNotif, setShowNotif]         = useState(false);
  const [lang, setLang]                   = useState('en');
  const [allChits, setAllChits]           = useState([]);
  const [counts, setCounts]               = useState({ open: 0, pending: 0, connections: 0, coAssists: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [inbox, pending, conns] = await Promise.all([
          getInbox({ limit: 200 }).catch(() => ({ data: { chits: [] } })),
          getPendingConnections().catch(() => ({ data: { requests: [] } })),
          getConnections().catch(() => ({ data: { connections: [] } })),
        ]);
        const chits = inbox.data.chits || [];
        setAllChits(chits);
        const open = chits.filter(c => !['completed','cancelled','rejected'].includes(c.current_status)).length;
        let coAssists = 0;
        if (!isActor) {
          const actors = await listActors({ status: 'active' }).catch(() => ({ data: { summary: {} } }));
          coAssists = actors.data?.summary?.active || 0;
        }
        setCounts({ open, pending: (pending.data.requests||[]).length, connections: (conns.data.connections||[]).length, coAssists });
      } catch {}
    };
    if (entity) loadCounts();
  }, [entity, isActor]);

  const unread = unreadCount || allChits.filter(c => !c.read_at).length;
  const isOnBreak = isActor && entity?.break_status && entity.break_status !== 'active';
  const headerBg = isActor
    ? (entity?.break_status === 'short_break' || entity?.break_status === 'leave' ? 'bg-amber-600' : 'bg-green-700')
    : 'bg-blue-600';

  const close = () => setDrawerOpen(false);

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-white">
      {/* Sidebar header */}
      <div className={`px-4 py-3 flex-shrink-0 ${headerBg}`}>
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            {isActor ? (
              <>
                <div className="text-white font-medium text-sm truncate">
                  {entity?.display_name || actorKey}
                </div>
                <div className="text-green-200 text-xs mt-0.5">
                  Co-Assist · {parentEntity}
                </div>
                {actorRole && <div className="text-green-300 text-xs">{actorRole}</div>}
              </>
            ) : (
              <>
                <div className="text-white font-medium text-sm truncate">
                  {entity?.display_name || 'Loading...'}
                </div>
                <div className="text-blue-200 text-xs mt-0.5 font-mono truncate">
                  {entity?.bridge_id}
                </div>
              </>
            )}
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 flex-shrink-0 ${
            isOnBreak ? 'bg-amber-200 text-amber-900' : 'bg-green-300 text-green-900'
          }`}>
            {isOnBreak
              ? (entity?.break_status === 'short_break' ? '☕ Break' : '🏖 Leave')
              : 'Active'}
          </span>
        </div>
      </div>

      {/* Break banner — persistent */}
      {isOnBreak && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 flex items-center gap-2">
          <span className="text-sm">☕</span>
          <div className="flex-1">
            <div className="text-xs font-medium text-amber-800">On break — tasks held</div>
          </div>
          <button
            onClick={() => navigate('/break')}
            className="text-xs bg-amber-600 text-white px-2 py-1 rounded font-medium">
            End
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-2">
        <button
          onClick={() => { navigate('/send'); close(); }}
          className={`w-full flex items-center gap-2 px-3 py-2 mb-2 rounded-lg text-xs font-medium text-white transition-colors ${
            isActor ? 'bg-green-700 hover:bg-green-800' : 'bg-blue-600 hover:bg-blue-700'
          }`}>
          <span>✏️</span> Compose
        </button>

        <NavItem icon="📥" label="All Task"  to="/inbox"    badge={counts.open} onClick={close}/>
        <NavItem icon="✅" label="My Task"   to="/my-tasks" onClick={close}/>
        <NavItem icon="📋" label="Order"     to="/order"    onClick={close}/>

        <div className="border-t border-gray-100 my-2"/>

        {!isActor && (
          <>
            <div className="text-xs text-gray-400 uppercase tracking-wide px-2 py-1">Network</div>
            <NavItem icon="🤝" label="My connections"   to="/connections"          badge={counts.connections} onClick={close}/>
            <NavItem icon="🕐" label="Pending requests" to="/connections?tab=pending" badge={counts.pending} badgeColour="orange" onClick={close}/>
            <div className="border-t border-gray-100 my-2"/>
            <div className="text-xs text-gray-400 uppercase tracking-wide px-2 py-1">Catalogue</div>
            <NavItem icon="📚" label="My catalogue" to="/my-catalogue" onClick={close}/>
            <div className="border-t border-gray-100 my-2"/>
            <div className="text-xs text-gray-400 uppercase tracking-wide px-2 py-1">Admin</div>
            <NavItem icon="📊" label="MIS dashboard" to="/mis"          onClick={close}/>
            <NavItem icon="🤖" label="Co-Assists"    to="/co-assists"   badge={counts.coAssists} onClick={close}/>
            <NavItem icon="⚙️" label="Settings"      to="/settings"     onClick={close}/>
          </>
        )}

        {isActor && (
          <>
            <div className="border-t border-gray-100 my-2"/>
            <div className="text-xs text-gray-400 uppercase tracking-wide px-2 py-1">My status</div>
            <NavItem icon="👤" label="My profile" to="/profile" onClick={close}/>
            <NavItem icon="☕" label="Go on break" to="/break"   onClick={close}/>
          </>
        )}

        <div className="border-t border-gray-100 my-2"/>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-red-600 hover:bg-red-50">
          <span>🚪</span> Logout
        </button>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 p-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
            isActor ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {(entity?.display_name || actorKey || 'CB').slice(0,2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-800 truncate">
              {isActor ? `${actorKey}@${parentEntity}` : entity?.display_name}
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                isOnBreak ? 'bg-amber-400' : 'bg-green-500'
              }`}/>
              {isActor
                ? `Co-Assist · ${isOnBreak ? 'on break' : 'active'}`
                : 'Entity · active'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-col w-52 flex-shrink-0 border-r border-gray-200">
        <Sidebar/>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black bg-opacity-40" onClick={close}/>
          <div className="relative w-60 h-full shadow-xl z-50 overflow-y-auto">
            <Sidebar/>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar — B3.4: bell + language switcher */}
        <div className={`px-4 py-3 flex items-center gap-3 flex-shrink-0 ${headerBg}`}>
          <button className="md:hidden text-white text-xl" onClick={() => setDrawerOpen(true)}>☰</button>
          <span className="text-white font-medium text-sm flex-1 truncate">{title || 'Chit and Bridge'}</span>

          {/* Language switcher — B3.4 */}
          <LangSwitcher current={lang} onChange={setLang}/>

          {/* Bell notification — B3.4 */}
          <button
            onClick={() => setShowNotif(true)}
            className="relative w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center text-white text-base transition-colors">
            🔔
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold border-2 border-blue-600">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          <button
            onClick={() => navigate('/send')}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg flex-shrink-0 ${
              isActor ? 'bg-white text-green-700' : 'bg-white text-blue-700'
            }`}>
            ✏️ Compose
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>

      {/* Notification centre */}
      {showNotif && (
        <NotificationCentre
          chits={allChits}
          onClose={() => setShowNotif(false)}
          onNavigate={navigate}
        />
      )}
    </div>
  );
};
