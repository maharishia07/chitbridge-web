// src/components/DevBadge.jsx
// Shows API status and visual flag in dev mode only
// Hidden in demo and production modes

import { useAppMode } from '../context/AppModeContext';

const STATUS_STYLES = {
  'done':        'bg-green-100 text-green-800 border-green-300',
  'in-progress': 'bg-amber-100 text-amber-800 border-amber-300',
  'pending':     'bg-red-100   text-red-800   border-red-300',
};

const STATUS_LABELS = {
  'done':        '✅ API done',
  'in-progress': '🔨 API in-progress',
  'pending':     '⏳ API pending',
};

export const DevBadge = ({ feature }) => {
  const { showDevBadges } = useAppMode();
  if (!showDevBadges || !feature) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1 mb-1">
      <span className={`text-xs px-2 py-0.5 rounded border font-mono ${STATUS_STYLES[feature.api_status]}`}>
        {STATUS_LABELS[feature.api_status]}
      </span>
      <span className={`text-xs px-2 py-0.5 rounded border font-mono ${
        feature.visual_flag
          ? 'bg-blue-100 text-blue-800 border-blue-300'
          : 'bg-gray-100 text-gray-600 border-gray-300'
      }`}>
        {feature.visual_flag ? '🎨 Visual: Yes' : '🎨 Visual: No'}
      </span>
      <span className="text-xs px-2 py-0.5 rounded border bg-purple-100 text-purple-800 border-purple-300 font-mono">
        {feature.phase}
      </span>
    </div>
  );
};

// Wraps a section of UI — shows warning overlay if feature not done
export const FeatureSection = ({ feature, children, placeholder }) => {
  const { mode, isVisible } = useAppMode();

  if (!isVisible(feature)) {
    if (mode === 'dev' && placeholder) {
      return (
        <div className="border-2 border-dashed border-amber-300 rounded-lg p-3 bg-amber-50">
          <div className="text-xs text-amber-700 font-mono mb-1">
            🔨 Feature not yet available: {feature.name}
          </div>
          <div className="text-xs text-amber-600">
            API: {feature.api_status} · Visual: {feature.visual_flag ? 'Yes' : 'No'} · {feature.phase}
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="relative">
      {children}
      <DevBadge feature={feature} />
    </div>
  );
};
