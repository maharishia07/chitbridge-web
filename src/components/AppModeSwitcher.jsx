// src/components/AppModeSwitcher.jsx
// Manual mode switcher — available in settings
// Switches between production | demo | dev

import { useAppMode } from '../context/AppModeContext';
import { getFeatureSummary } from '../config/features';

const MODES = [
  {
    id: 'production',
    label: 'Production',
    icon: '🚀',
    description: 'Shows only fully working features',
    color: 'bg-gray-900 text-white border-gray-900',
    activeRing: 'ring-2 ring-gray-900',
  },
  {
    id: 'demo',
    label: 'Demo',
    icon: '🎯',
    description: 'Shows all screens — even if API pending',
    color: 'bg-blue-600 text-white border-blue-600',
    activeRing: 'ring-2 ring-blue-600',
  },
  {
    id: 'dev',
    label: 'Dev',
    icon: '🔨',
    description: 'Shows everything with status badges',
    color: 'bg-amber-500 text-white border-amber-500',
    activeRing: 'ring-2 ring-amber-500',
  },
];

export const AppModeSwitcher = () => {
  const { mode, switchMode } = useAppMode();
  const summary = getFeatureSummary();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">

      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
        App display mode
      </div>

      <div className="flex gap-2 mb-4">
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => switchMode(m.id)}
            className={`flex-1 rounded-lg border px-3 py-2.5 text-center transition-all ${
              mode === m.id
                ? `${m.color} ${m.activeRing} ring-offset-1`
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <div className="text-base">{m.icon}</div>
            <div className="text-xs font-medium mt-0.5">{m.label}</div>
          </button>
        ))}
      </div>

      <div className="text-xs text-gray-500 mb-4 bg-gray-50 rounded-lg px-3 py-2">
        {MODES.find(m => m.id === mode)?.description}
      </div>

      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        Feature status
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-green-50 rounded-lg p-2 text-center">
          <div className="text-lg font-medium text-green-700">{summary.done}</div>
          <div className="text-xs text-green-600">API done</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-2 text-center">
          <div className="text-lg font-medium text-amber-700">{summary.in_progress}</div>
          <div className="text-xs text-amber-600">In progress</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2 text-center">
          <div className="text-lg font-medium text-red-700">{summary.pending}</div>
          <div className="text-xs text-red-600">Pending</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-2 text-center">
          <div className="text-lg font-medium text-blue-700">{summary.visual_yes}</div>
          <div className="text-xs text-blue-600">Visual yes</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center border border-gray-200">
          <div className="text-lg font-medium text-gray-500">{summary.visual_no}</div>
          <div className="text-xs text-gray-400">Visual no</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-2 text-center">
          <div className="text-lg font-medium text-purple-700">{summary.total}</div>
          <div className="text-xs text-purple-600">Total</div>
        </div>
      </div>

    </div>
  );
};
