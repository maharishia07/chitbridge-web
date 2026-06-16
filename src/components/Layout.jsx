// src/components/Layout.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppMode } from '../context/AppModeContext';
import { getConnections, getPendingConnections, getInbox, listActors } from '../api/client';

const NavItem = ({ icon, label, to, badge, badgeColour = 'blue', onClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const active = to && (location.pathname === to || (to !== '/inbox' && location.pathname.startsWith(to)));
  return (
    <button
      onClick={() => { if (to) navigate(to); if (onClick) onClick(); }}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all ${
        active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
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

export const Layout = ({ children, title }) => {
  const { entity, logout, isActor, parentEntity, actorKey, actorRole } = useAuth();
  const { mode } = useAppMode();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [counts, setCounts] = useState({ open: 0, pending: 0, connections: 0, coAssists: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [inbox, pending, conns] = await Promise.all([
          getInbox({ limit: 100 }).catch(() => ({ data: { chits: [] } })),
          getPendingConnections().catch(() => ({ data: { requests: [] } })),
          getConnections().catch(() => ({ data: { connections: [] } })),
        ]);
        const open = (inbox.data.chits || []).filter(
          c => !['completed','cancelled','rejected'].includes(c.current_status)
        ).length;
        // Load co-assist count for entity admins
        let coAssists = 0;
        if (!isActor) {
          const actors = await listActors({ status: 'active' }).catch(() => ({ data: { summary: {} } }));
          coAssists = actors.data?.summary?.active || 0;
        }
        setCounts({
          open,
          pending: (pending.data.requests || []).length,
          connections: (conns.data.connections || []).length,
          coAssists,
        });
      } catch {}
    };
    if (entity) loadCounts();
  }, [entity, isActor]);

  const MODE_BADGE = {
    production: 'bg-gray-900 text-white',
    demo:       'bg-blue-600 text-white',
    dev:        'bg-amber-500 text-white',
  };

  const close = () => setDrawerOpen(false);

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-white">
      {/* Header — different for actor vs entity */}
      <div className={`px-4 py-3 flex-shrink-0 ${isActor ? 'bg-green-700' : 'bg-blue-600'}`}>
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
                {actorRole && (
                  <div className="text-green-300 text-xs">{actorRole}</div>
                )}
              </>
            ) : (
              <>
                <div className="text-white font-medium text-sm truncate">
                  {entity?.display_name || 'Loading...'}
                </div>
                <div className="text-blue-200 text-xs mt-0.5 font-mono">
                  {entity?.bridge_id}
                </div>
              </>
            )}
          </div>
          {!isActor && (
            <span className="bg-green-400 text-green-900 text-xs px-2 py-0.5 rounded-full font-medium ml-2 flex-shrink-0">
              Open
            </span>
          )}
          {isActor && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 flex-shrink-0 ${
              entity?.break_status === 'short_break' ? 'bg-amber-200 text-amber-900' :
              entity?.break_status === 'leave'       ? 'bg-orange-200 text-orange-900' :
                                                       'bg-green-300 text-green-900'
            }`}>
              {entity?.break_status === 'short_break' ? 'Break' :
               entity?.break_status === 'leave'       ? 'Leave' : 'Active'}
            </span>
          )}
        </div>
        {mode !== 'production' && (
          <div className={`mt-1.5 inline-block text-xs px-2 py-0.5 rounded font-mono ${MODE_BADGE[mode]}`}>
            {mode}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Compose */}
        <button
          onClick={() => { navigate('/send'); close(); }}
          className={`w-full flex items-center gap-2 px-3 py-2 mb-2 rounded-lg text-xs font-medium text-white transition-colors ${
            isActor ? 'bg-green-700 hover:bg-green-800' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          <span>✏️</span> Compose
        </button>

        {/* Core nav */}
        <NavItem icon="📥" label="All Task" to="/inbox" badge={counts.open} onClick={close}/>
        <NavItem icon="✅" label="My Task" to="/my-tasks" onClick={close}/>
        <NavItem icon="📋" label="Order" to="/order" onClick={close}/>

        <div className="border-t border-gray-100 my-2"/>

        {/* Entity only sections */}
        {!isActor && (
          <>
            <div className="text-xs text-gray-400 uppercase tracking-wide px-2 py-1">Network</div>
            <NavItem icon="🤝" label="My connections" to="/connections" badge={counts.connections} onClick={close}/>
            <NavItem icon="🕐" label="Pending requests" to="/connections?tab=pending" badge={counts.pending} badgeColour="orange" onClick={close}/>
            <div className="border-t border-gray-100 my-2"/>
            <div className="text-xs text-gray-400 uppercase tracking-wide px-2 py-1">Catalogue</div>
            <NavItem icon="📚" label="My catalogue" to="/my-catalogue" onClick={close}/>
            <div className="border-t border-gray-100 my-2"/>
            <div className="text-xs text-gray-400 uppercase tracking-wide px-2 py-1">Admin</div>
            <NavItem icon="📊" label="MIS dashboard" to="/mis" onClick={close}/>
            <NavItem icon="🤖" label="Co-Assists" to="/co-assists" badge={counts.coAssists} onClick={close}/>
            <NavItem icon="⚙️" label="Settings" to="/settings" onClick={close}/>
          </>
        )}

        {/* Actor only sections */}
        {isActor && (
          <>
            <div className="border-t border-gray-100 my-2"/>
            <div className="text-xs text-gray-400 uppercase tracking-wide px-2 py-1">My status</div>
            <NavItem icon="👤" label="My profile" to="/profile" onClick={close}/>
            <NavItem icon="☕" label="Go on break" to="/break" onClick={close}/>
          </>
        )}

        <div className="border-t border-gray-100 my-2"/>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-red-600 hover:bg-red-50"
        >
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
                isActor && entity?.break_status && entity.break_status !== 'active'
                  ? 'bg-amber-400' : 'bg-green-500'
              }`}/>
              {isActor
                ? `Co-Assist · ${entity?.break_status === 'short_break' ? 'on break' : entity?.break_status === 'leave' ? 'on leave' : 'active'}`
                : 'Entity · active'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <div className="hidden md:flex md:flex-col w-52 flex-shrink-0 border-r border-gray-200">
        <Sidebar/>
      </div>
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black bg-opacity-40" onClick={close}/>
          <div className="relative w-60 h-full shadow-xl z-50 overflow-y-auto">
            <Sidebar/>
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={`px-4 py-3 flex items-center gap-3 flex-shrink-0 ${isActor ? 'bg-green-700' : 'bg-blue-600'}`}>
          <button className="md:hidden text-white text-xl" onClick={() => setDrawerOpen(true)}>☰</button>
          <span className="text-white font-medium text-sm flex-1 truncate">{title || 'Chit and Bridge'}</span>
          <button
            onClick={() => navigate('/send')}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg flex-shrink-0 ${
              isActor ? 'bg-white text-green-700' : 'bg-white text-blue-700'
            }`}
          >
            ✏️ Compose
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
