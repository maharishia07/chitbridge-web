// src/api/client.js — Axios instance pointing to backend API
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('cb_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally — redirect to login
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('cb_token');
      localStorage.removeItem('cb_entity');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── API functions — one per endpoint ────────────────────────

// Entities
export const registerEntity = (data) =>
  apiClient.post('/api/entities/register', data);

export const verifyOTP = (data) =>
  apiClient.post('/api/entities/verify', data);

export const searchEntities = (q) =>
  apiClient.get(`/api/entities/search?q=${encodeURIComponent(q)}`);

export const getMyProfile = () =>
  apiClient.get('/api/entities/me');

// Connections
export const requestConnection = (data) =>
  apiClient.post('/api/connections/request', data);

export const getPendingConnections = () =>
  apiClient.get('/api/connections/pending');

export const respondToConnection = (id, action) =>
  apiClient.put(`/api/connections/${id}/respond`, { action });

export const getConnections = () =>
  apiClient.get('/api/connections/list');

// Chits
export const sendChit = (data) =>
  apiClient.post('/api/chits/send', data);

export const getInbox = (params = {}) =>
  apiClient.get('/api/chits/inbox', { params });

export const getChitDetail = (chitId) =>
  apiClient.get(`/api/chits/${chitId}`);

export const updateChitStatus = (chitId, status, note) =>
  apiClient.put(`/api/chits/${chitId}/status`, { status, note });

// Health
export const healthCheck = () =>
  apiClient.get('/health');
