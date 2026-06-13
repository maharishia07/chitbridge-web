// src/components/Layout.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppMode } from '../context/AppModeContext';
import { getConnections, getPendingConnections, getInbox } from '../api/client';

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
  const { entity, logout } = useAuth();
  const { mode } = useAppMode();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [counts, setCounts] = useState({ open: 0, pending: 0, connections: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    // Load live counts for badges
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
        setCounts({
          open,
          pending: (pending.data.requests || []).length,
          connections: (conns.data.connections || []).length,
        });
      } catch {}
    };
    if (entity) loadCounts();
  }, [entity]);

  const MODE_BADGE = {
    production: 'bg-gray-900 text-white',
    demo:       'bg-blue-600 text-white',
    dev:        'bg-amber-500 text-white',
  };

  const close = () => setDrawerOpen(false);

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-white">

      {/* Entity header */}
      <div className="bg-blue-600 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-white font-medium text-sm truncate">
              {entity?.display_name || 'Loading...'}
            </div>
            <div className="text-blue-200 text-xs mt-0.5 font-mono">
              {entity?.bridge_id}
            </div>
          </div>
          <span className="bg-green-400 text-green-900 text-xs px-2 py-0.5 rounded-full font-medium ml-2 flex-shrink-0">
            Open
          </span>
        </div>
        {mode !== 'production' && (
          <div className={`mt-1.5 inline-block text-xs px-2 py-0.5 rounded font-mono ${MODE_BADGE[mode]}`}>
            {mode} mode
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-2">

        {/* Compose — top of nav like Gmail/Outlook */}
        <button
          onClick={() => { navigate('/send'); close(); }}
          className="w-full flex items-center gap-2 px-3 py-2 mb-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
        >
          <span>✏️</span> Compose
        </button>

        {/* INBOX — no section label per design decision */}
        <NavItem icon="📥" label="All Task" to="/inbox" badge={counts.open} onClick={close}/>
        <NavItem icon="✅" label="My Task" to="/my-tasks" onClick={close}/>
        <NavItem icon="📋" label="Order" to="/order" onClick={close}/>

        <div className="border-t border-gray-100 my-2"/>

        <div className="text-xs text-gray-400 uppercase tracking-wide px-2 py-1">Network</div>
        <NavItem icon="🤝" label="My connections" to="/connections" badge={counts.connections} onClick={close}/>
        <NavItem icon="🕐" label="Pending requests" to="/connections?tab=pending" badge={counts.pending} badgeColour="orange" onClick={close}/>

        <div className="border-t border-gray-100 my-2"/>

        <div className="text-xs text-gray-400 uppercase tracking-wide px-2 py-1">Catalogue</div>
        <NavItem icon="📚" label="My catalogue" to="/my-catalogue" onClick={close}/>
        <NavItem icon="⬆️" label="Bulk upload" to="/my-catalogue/upload" onClick={close}/>

        <div className="border-t border-gray-100 my-2"/>

        <div className="text-xs text-gray-400 uppercase tracking-wide px-2 py-1">Admin</div>
        <NavItem icon="📊" label="MIS dashboard" to="/mis" onClick={close}/>
        <NavItem icon="👥" label="Employees" to="/employees" onClick={close}/>
        <NavItem icon="⚙️" label="Settings" to="/settings" onClick={close}/>

        <div className="border-t border-gray-100 my-2"/>

        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-red-600 hover:bg-red-50"
        >
          <span>🚪</span> Logout
        </button>
      </div>

      {/* Footer — entity name from auth context — not hardcoded */}
      <div className="border-t border-gray-100 p-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-medium flex-shrink-0">
            {entity?.display_name?.slice(0,2)?.toUpperCase() || 'CB'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-800 truncate">
              {entity?.display_name}
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"/>
              Entity · active
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

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-blue-600 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button className="md:hidden text-white text-xl" onClick={() => setDrawerOpen(true)}>☰</button>
          <span className="text-white font-medium text-sm flex-1 truncate">{title || 'Chit and Bridge'}</span>
          <button
            onClick={() => navigate('/send')}
            className="bg-white text-blue-700 text-xs font-medium px-3 py-1.5 rounded-lg flex-shrink-0"
          >
            ✏️ Compose
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
