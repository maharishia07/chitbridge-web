const BASE = import.meta.env.VITE_API_URL || "";
const call = async (m, p, b) => { const r = await fetch(`${BASE}/api/network${p}`, { method:m, headers:{"Content-Type":"application/json"}, body: b?JSON.stringify(b):undefined }); const d = await r.json().catch(()=>({})); if(!r.ok) throw Object.assign(new Error(d.error||r.statusText),{code:d.code}); return d; };
export const catalogueApi = {
  items:   (id, tier)  => call("GET", `/entities/${id}/catalogue${tier?`?tier=${tier}`:""}`),
  addItem: (id, item)  => call("POST", `/entities/${id}/catalogue`, item),
  update:  (itemId, p) => call("PATCH", `/catalogue/${itemId}`, p),
  remove:  (itemId)    => call("DELETE", `/catalogue/${itemId}`),
};
