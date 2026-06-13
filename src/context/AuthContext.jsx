// src/context/AuthContext.jsx
import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken]   = useState(localStorage.getItem('cb_token') || null);
  const [entity, setEntity] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cb_entity') || 'null'); }
    catch { return null; }
  });

  const login = (newToken, newEntity) => {
    setToken(newToken);
    setEntity(newEntity);
    localStorage.setItem('cb_token', newToken);
    localStorage.setItem('cb_entity', JSON.stringify(newEntity));
  };

  const logout = () => {
    setToken(null);
    setEntity(null);
    localStorage.removeItem('cb_token');
    localStorage.removeItem('cb_entity');
  };

  return (
    <AuthContext.Provider value={{ token, entity, login, logout, isLoggedIn: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
