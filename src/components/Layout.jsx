// src/components/Layout.jsx
// Shared layout — sidebar nav + top bar + main content
// Mobile: hamburger drawer. Desktop: persistent sidebar.

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppMode } from '../context/AppModeContext';

const STATUS_COLOURS = {
  'done':        'bg-green-100 text-green-700',
  'in-progress': 'bg-amber-100 text-amber-700',
  'pending':     'bg-red-100 text-red-700',
};

const NavItem = ({ icon, label, to, badge, badgeColour = 'blue', onClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname === to;

  return (
    <button
      onClick={() => { if (to) navigate(to); if (onClick) onClick(); }}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
        active
          ? 'bg-blue-50 text-blue-700 font-medium'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <span className="text-base">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge != null && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
          badgeColour === 'orange'
            ? 'bg-amber-100 text-amber-700'
            : 'bg-blue-100 text-blue-700'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
};

export const Layout = ({ children, title }) => {
  const { entity, logout } = useAuth();
  const { mode } = useAppMode();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();

  const MODE_BADGE = {
    production: 'bg-gray-900 text-white',
    demo:       'bg-blue-600 text-white',
    dev:        'bg-amber-500 text-white',
  };

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-white">

      {/* Entity header */}
      <div className="bg-blue-600 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white font-medium text-sm">
              {entity?.display_name || 'Loading...'}
            </div>
            <div className="text-blue-200 text-xs mt-0.5">
              {entity?.bridge_id}
            </div>
          </div>
          <span className="bg-green-400 text-green-900 text-xs px-2 py-0.5 rounded-full font-medium">
            Open
          </span>
        </div>
        {mode !== 'production' && (
          <div className={`mt-2 inline-block text-xs px-2 py-0.5 rounded font-mono ${MODE_BADGE[mode]}`}>
            {mode} mode
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-2">

        <div className="text-xs text-gray-400 uppercase tracking-wide px-2 py-1 mt-1">
          Inbox
        </div>
        <NavItem icon="📥" label="All chits" to="/inbox" badge={56} onClick={() => setDrawerOpen(false)} />
        <NavItem icon="✅" label="My tasks" to="/my-tasks" badge={12} badgeColour="orange" onClick={() => setDrawerOpen(false)} />
        <NavItem icon="📤" label="Sent items" to="/sent" onClick={() => setDrawerOpen(false)} />

        <div className="border-t border-gray-100 my-2" />

        <div className="text-xs text-gray-400 uppercase tracking-wide px-2 py-1">
          Network
        </div>
        <NavItem icon="🤝" label="My suppliers" to="/connections" badge={3} onClick={() => setDrawerOpen(false)} />
        <NavItem icon="🕐" label="Pending requests" to="/connections?tab=pending" badge={2} badgeColour="orange" onClick={() => setDrawerOpen(false)} />

        <div className="border-t border-gray-100 my-2" />

        <div className="text-xs text-gray-400 uppercase tracking-wide px-2 py-1">
          Catalogue
        </div>
        <NavItem icon="📚" label="My catalogue" to="/my-catalogue" onClick={() => setDrawerOpen(false)} />
        <NavItem icon="⬆️" label="Bulk upload" to="/my-catalogue/upload" onClick={() => setDrawerOpen(false)} />

        <div className="border-t border-gray-100 my-2" />

        <div className="text-xs text-gray-400 uppercase tracking-wide px-2 py-1">
          Admin
        </div>
        <NavItem icon="📊" label="MIS dashboard" to="/mis" onClick={() => setDrawerOpen(false)} />
        <NavItem icon="👥" label="Employees" to="/employees" onClick={() => setDrawerOpen(false)} />
        <NavItem icon="⚙️" label="Settings" to="/settings" onClick={() => setDrawerOpen(false)} />

        <div className="border-t border-gray-100 my-2" />

        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
        >
          <span>🚪</span> Logout
        </button>
      </div>

      {/* Actor footer */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-medium">
            RK
          </div>
          <div>
            <div className="text-xs font-medium text-gray-800">Ravi Kumar</div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              Purchase · active
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* Desktop sidebar */}
      <div className="hidden md:block w-56 flex-shrink-0 border-r border-gray-200 overflow-y-auto">
        <Sidebar />
      </div>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black bg-opacity-40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative w-64 h-full shadow-xl z-50">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="bg-blue-600 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button
            className="md:hidden text-white text-xl"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
          >
            ☰
          </button>
          <span className="text-white font-medium text-sm flex-1">{title || 'Chit and Bridge'}</span>
          <button
            onClick={() => navigate('/send')}
            className="bg-white text-blue-700 text-xs font-medium px-3 py-1.5 rounded-lg"
          >
            + New Chit
          </button>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

      </div>
    </div>
  );
};
