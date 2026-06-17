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

// Public (no-auth) instance — for the customer-facing catalogue.
// Deliberately has NO token interceptor and NO 401 redirect.
export const pub = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

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

export const deleteChit = (chitId) =>
  apiClient.delete(`/api/chits/${chitId}`);

// Relationships — Suppliers (B3.6)
export const addSupplier      = (data) => apiClient.post('/api/relationships/suppliers', data);
export const getSuppliers     = ()     => apiClient.get('/api/relationships/suppliers');
export const removeSupplier   = (id)   => apiClient.delete(`/api/relationships/suppliers/${id}`);
export const getSupplierCatalogue = (supplierEntityId) =>
  apiClient.get(`/api/relationships/suppliers/${supplierEntityId}/catalogue`);
// Relationships — Customers (B3.6)
export const getCustomers     = (segment) =>
  apiClient.get(`/api/relationships/customers${segment ? `?segment=${segment}` : ''}`);
export const setCustomerSegment = (id, segment_override) =>
  apiClient.patch(`/api/relationships/customers/${id}`, { segment_override });

// B3.7 — Public catalogue + end-customer order (no auth)
export const getPublicCatalogue = (bridgeId)       => pub.get(`/api/catalogue/${bridgeId}`);
export const startOrder         = (bridgeId, data) => pub.post(`/api/catalogue/${bridgeId}/order/start`, data);
export const confirmOrder       = (bridgeId, data) => pub.post(`/api/catalogue/${bridgeId}/order/confirm`, data);
// B3.7 — Entity sets catalogue visibility (auth)
export const setCatalogueVisibility = (visibility) => apiClient.patch('/api/schemas/visibility', { visibility });

// Health
export const healthCheck = () =>
  apiClient.get('/health');

// Schema endpoints
export const getMySchema = () =>
  apiClient.get('/api/schemas/my');

export const createDefaultSchema = () =>
  apiClient.post('/api/schemas/create-default');

export const getSchemaFields = () =>
  apiClient.get('/api/schemas/fields');

// ── Actor / Co-Assist endpoints ──────────────────────────────

export const actorLogin = (data) =>
  apiClient.post('/api/actors/login', data);

export const suggestActorKey = (display_name) =>
  apiClient.post('/api/actors/suggest-key', { display_name });

export const checkActorKey = (actor_key) =>
  apiClient.post('/api/actors/check-key', { actor_key });

export const createActor = (data) =>
  apiClient.post('/api/actors', data);

export const listActors = (params = {}) =>
  apiClient.get('/api/actors', { params });

export const resetActorOTP = (actor_id) =>
  apiClient.post(`/api/actors/${actor_id}/otp`);

export const updateActorStatus = (actor_id, data) =>
  apiClient.put(`/api/actors/${actor_id}/status`, data);

export const actorBreak = (data) =>
  apiClient.put('/api/actors/break', data);

export const assignChit = (chit_id, data) =>
  apiClient.put(`/api/actors/assign/${chit_id}`, data);

export const getActorSettings = () =>
  apiClient.get('/api/actors/settings');

export const updateActorSettings = (data) =>
  apiClient.put('/api/actors/settings', data);

// ── PIN management ───────────────────────────────────────────

export const checkActorLogin = (username) =>
  apiClient.get(`/api/actors/check-login?username=${encodeURIComponent(username)}`);

export const setActorPin = (data) =>
  apiClient.post('/api/actors/set-pin', data);

export const changeActorPin = (data) =>
  apiClient.put('/api/actors/change-pin', data);

export const clearActorPin = (actor_id) =>
  apiClient.delete(`/api/actors/${actor_id}/pin`);

// ── B3.3 — Actor task management ────────────────────────────

export const getActorTasks = (actor_id) =>
  apiClient.get(`/api/actors/${actor_id}/tasks`);

export const routeActorTask = (actor_id, data) =>
  apiClient.put(`/api/actors/${actor_id}/tasks/route`, data);

// ── B3.5 — Messaging ────────────────────────────────────────
export const sendMessage = (chit_id, data) =>
  apiClient.post(`/api/chits/${chit_id}/messages`, data);

export const getMessages = (chit_id, thread_type = 'all') =>
  apiClient.get(`/api/chits/${chit_id}/messages`, { params: { thread_type } });

// ── B3.5 — Disputes ─────────────────────────────────────────
export const raiseDispute = (chit_id, data) =>
  apiClient.post(`/api/chits/${chit_id}/disputes`, data);

export const getDisputes = (chit_id) =>
  apiClient.get(`/api/chits/${chit_id}/disputes`);

export const resolveDispute = (chit_id, dispute_id, data) =>
  apiClient.put(`/api/chits/${chit_id}/disputes/${dispute_id}/resolve`, data);

export const getDisputeQueue = () =>
  apiClient.get('/api/chits/disputes/queue');
