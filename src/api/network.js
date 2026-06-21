const BASE = import.meta.env.VITE_API_URL || "";
async function call(method, path, body) {
  const res = await fetch(`${BASE}/api/network${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { code: data.code, status: res.status });
  return data;
}
export const networkApi = {
  register:    (b)                     => call("POST", "/entities", b),
  lookup:      (bridgeId)              => call("GET",  `/entities/lookup?bridgeId=${encodeURIComponent(bridgeId)}`),
  claim:       (id)                    => call("POST", `/entities/${id}/claim`),
  subtree:     (id)                    => call("GET",  `/entities/${id}/subtree`),
  connections: (id)                    => call("GET",  `/entities/${id}/connections`),
  request:     (b)                     => call("POST", "/connections", b),
  approve:     (id, actingEntityId)    => call("POST", `/connections/${id}/approve`, { actingEntityId }),
  decline:     (id, actingEntityId)    => call("POST", `/connections/${id}/decline`, { actingEntityId }),
  suspend:     (id)                    => call("POST", `/connections/${id}/suspend`),
  resume:      (id)                    => call("POST", `/connections/${id}/resume`),
  disconnect:  (id, settle = false)    => call("POST", `/connections/${id}/disconnect`, { settle }),
};
