// src/pages/MyCataloguePage.jsx — B3.6 Publish your product catalogue (D-059)
// A "catalogue" is the entity's active default schema. Once published,
// buyers who add you as a supplier see an "Order" button (has_catalogue = true).
import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { getMySchema, createDefaultSchema, getMyProfile, setCatalogueVisibility } from '../api/client';

export default function MyCataloguePage() {
  const [schema, setSchema]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg]         = useState('');
  const [vis, setVis]         = useState('private');   // B3.7 catalogue visibility
  const [bridge, setBridge]   = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await getMySchema();
      setSchema(res.data.schema);
      setVis(res.data.schema?.visibility || 'private');
      try { const me = await getMyProfile(); setBridge(me.data.entity?.bridge_id || ''); } catch {}
    } catch { setSchema(null); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggleVisibility = async () => {
    const next = vis === 'public' ? 'private' : 'public';
    try { await setCatalogueVisibility(next); setVis(next); }
    catch (err) { setMsg(err.response?.data?.message || 'Could not change visibility'); }
  };

  const publish = async () => {
    setCreating(true); setMsg('');
    try {
      const res = await createDefaultSchema();
      setSchema(res.data.schema);
      setMsg('Catalogue published — buyers can now order from you');
    } catch (err) {
      setMsg(err.response?.data?.message || 'Failed to publish catalogue');
    } finally { setCreating(false); }
  };

  const fields = schema?.fields?.filter(f => f) || [];

  return (
    <Layout title="My Catalogue">
      <div className="p-4 max-w-lg mx-auto flex flex-col gap-4">

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">Product catalogue</div>

          {loading ? (
            <div className="text-xs text-gray-400 py-4 text-center">Loading…</div>
          ) : schema ? (
            <>
              {msg && (
                <div className="bg-green-50 text-green-700 text-xs p-2 rounded-lg mb-3 border border-green-200">
                  {msg}
                </div>
              )}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-medium text-gray-800">{schema.schema_name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {fields.length} field{fields.length !== 1 ? 's' : ''} · {schema.schema_type}
                  </div>
                </div>
                <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                  Published
                </span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-2">Catalogue fields buyers will see:</div>
                {fields.map((field, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-none">
                    <span className="text-xs font-medium text-gray-700">{field.field_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{field.field_type}</span>
                      {field.required && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">required</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-400 mt-3">
                ✓ Buyers who add you as a supplier now see an <span className="font-medium text-gray-600">Order</span> button.
              </div>

              {/* B3.7 — public storefront link */}
              <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-800">Public storefront</div>
                    <div className="text-xs text-gray-400">
                      {vis === 'public'
                        ? 'Anyone with the link can place an order'
                        : 'Only you can see this catalogue'}
                    </div>
                  </div>
                  <button onClick={toggleVisibility}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${
                      vis === 'public'
                        ? 'bg-gray-50 text-gray-600 border-gray-200'
                        : 'bg-blue-600 text-white border-blue-600'}`}>
                    {vis === 'public' ? 'Make private' : 'Make public'}
                  </button>
                </div>
                {vis === 'public' && bridge && (
                  <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg p-2.5">
                    <div className="text-xs text-gray-400 mb-0.5">Share this link with customers:</div>
                    <div className="text-xs text-blue-700 break-all font-mono">
                      {window.location.origin}/c/{bridge}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="text-amber-500 text-xl flex-shrink-0">📦</div>
                  <div>
                    <div className="text-sm font-medium text-amber-800 mb-1">No catalogue published yet</div>
                    <div className="text-xs text-amber-700">
                      Publish a catalogue so buyers who add you as a supplier can place orders
                      directly — no phone call needed.
                    </div>
                  </div>
                </div>
              </div>
              {msg && (
                <div className="bg-red-50 text-red-700 text-xs p-2 rounded-lg mb-3">{msg}</div>
              )}
              <button onClick={publish} disabled={creating}
                className="w-full bg-blue-600 text-white text-sm font-medium py-3 rounded-lg disabled:opacity-50">
                {creating ? 'Publishing…' : 'Publish product catalogue'}
              </button>
              <div className="text-xs text-gray-400 text-center mt-2">
                Creates Product · Quantity · Price fields
              </div>
            </>
          )}
        </div>

      </div>
    </Layout>
  );
}
