// src/context/AuthContext.jsx
import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

// Parse JWT payload without library
const parseJWT = (token) => {
  try {
    const base64 = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    return JSON.parse(atob(base64));
  } catch { return {}; }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('cb_token') || null);
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

  const updateEntity = (updates) => {
    const updated = { ...entity, ...updates };
    setEntity(updated);
    localStorage.setItem('cb_entity', JSON.stringify(updated));
  };

  // Parse identity_type from JWT
  const tokenPayload = token ? parseJWT(token) : {};
  const isActor        = tokenPayload.identity_type === 'actor';
  const identityType   = tokenPayload.identity_type || 'entity';
  const parentEntity   = tokenPayload.parent_entity_name || null;
  const parentEntityId = tokenPayload.parent_entity_id   || null;
  const actorKey       = tokenPayload.actor_key  || null;
  const actorRole      = tokenPayload.actor_role || null;

  return (
    <AuthContext.Provider value={{
      token, entity, login, logout, updateEntity,
      isLoggedIn: !!token,
      isActor, identityType,
      parentEntity, parentEntityId, actorKey, actorRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
