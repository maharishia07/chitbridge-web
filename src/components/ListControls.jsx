// src/components/ListControls.jsx — reusable search box + optional filter chips
export default function ListControls({
  query, onQuery, placeholder = 'Search…',
  filters,            // optional: [{ value, label }]
  value, onFilter,    // active filter value + setter
}) {
  return (
    <div className="mb-3">
      <input
        value={query}
        onChange={e => onQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
      />
      {filters && (
        <div className="flex gap-2 flex-wrap mt-2">
          {filters.map(f => (
            <button key={f.value} onClick={() => onFilter(f.value)}
              className={`text-xs px-3 py-1 rounded-full border ${
                value === f.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 text-gray-600'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
