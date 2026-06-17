// src/utils/filterList.js — case-insensitive client-side list search
// fields supports dot-paths, e.g. 'item_data.product'
export function filterList(items, query, fields) {
  if (!query || !query.trim()) return items;
  const q = query.trim().toLowerCase();
  return (items || []).filter(it =>
    fields.some(f => {
      const v = f.split('.').reduce((o, k) => (o == null ? o : o[k]), it);
      return v != null && String(v).toLowerCase().includes(q);
    })
  );
}
