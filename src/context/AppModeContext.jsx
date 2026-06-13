// src/context/AppModeContext.jsx
// Controls production | demo | dev mode
// Accessible from anywhere in the app

import { createContext, useContext, useState } from 'react';
import { APP_MODE as DEFAULT_MODE } from '../config/features';

const AppModeContext = createContext(null);

export const AppModeProvider = ({ children }) => {
  const [mode, setMode] = useState(
    localStorage.getItem('cb_app_mode') || DEFAULT_MODE
  );

  const switchMode = (newMode) => {
    setMode(newMode);
    localStorage.setItem('cb_app_mode', newMode);
  };

  const isVisible = (feature) => {
    switch (mode) {
      case 'production':
        return feature.api_status === 'done' && feature.visual_flag === true;
      case 'demo':
        return feature.visual_flag === true;
      case 'dev':
      default:
        return true;
    }
  };

  const showDevBadges = mode === 'dev';

  return (
    <AppModeContext.Provider value={{ mode, switchMode, isVisible, showDevBadges }}>
      {children}
    </AppModeContext.Provider>
  );
};

export const useAppMode = () => {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error('useAppMode must be inside AppModeProvider');
  return ctx;
};
