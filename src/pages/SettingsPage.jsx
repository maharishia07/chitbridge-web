// src/pages/SettingsPage.jsx
import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAppMode } from '../context/AppModeContext';
import { useAuth } from '../context/AuthContext';
import { getMySchema, createDefaultSchema } from '../api/client';

const ModeBtn = ({ mode, current, label, colour, onClick }) => (
  <button onClick={() => onClick(mode)}
    className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
      current === mode ? colour : 'bg-gray-100 text-gray-500'
    }`}>
    {label}
  </button>
);

export default function SettingsPage() {
  const { mode, switchMode } = useAppMode();
  const { entity }           = useAuth();
  const [schema, setSchema]  = useState(null);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [creating, setCreating]   = useState(false);
  const [schemaMsg, setSchemaMsg] = useState('');

  useEffect(() => { loadSchema(); }, []);

  const loadSchema = async () => {
    try {
      const res = await getMySchema();
      setSchema(res.data.schema);
    } catch {}
    setSchemaLoading(false);
  };

  const handleCreateSchema = async () => {
    setCreating(true);
    try {
      const res = await createDefaultSchema();
      setSchema(res.data.schema);
      setSchemaMsg('Product schema created — 3 fields ready');
    } catch (err) {
      setSchemaMsg(err.response?.data?.message || 'Failed to create schema');
    } finally { setCreating(false); }
  };

  return (
    <Layout title="Settings">
      <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">

        {/* App mode switcher */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">App mode</div>
          <div className="flex gap-2 mb-3">
            <ModeBtn mode="dev"        current={mode} label="🔨 Dev"        colour="bg-amber-400 text-amber-900"  onClick={switchMode}/>
            <ModeBtn mode="demo"       current={mode} label="🎯 Demo"       colour="bg-blue-600 text-white"       onClick={switchMode}/>
            <ModeBtn mode="production" current={mode} label="🚀 Production" colour="bg-gray-800 text-white"       onClick={switchMode}/>
          </div>
          <div className={`text-xs p-2 rounded-lg ${
            mode === 'dev'        ? 'bg-amber-50 text-amber-800'  :
            mode === 'demo'       ? 'bg-blue-50 text-blue-800'    :
                                    'bg-gray-50 text-gray-600'
          }`}>
            {mode === 'dev'        && 'Dev mode — all features visible with status badges'}
            {mode === 'demo'       && 'Demo mode — all screens with visual built'}
            {mode === 'production' && 'Production mode — only fully working features'}
          </div>
        </div>

        {/* Entity info */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">Identity</div>
          <div className="flex flex-col gap-2">
            {[
              ['Display name', entity?.display_name],
              ['Bridge ID',    entity?.bridge_id],
              ['Country',      entity?.country || 'IN'],
              ['Currency',     entity?.currency_code || 'INR'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-none">
                <span className="text-xs text-gray-500">{label}</span>
                <span className="text-xs font-medium text-gray-800 font-mono">{value || '—'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Schema section */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">My schema</div>

          {schemaLoading ? (
            <div className="text-xs text-gray-400 py-2">Checking schema...</div>
          ) : schema ? (
            /* Schema exists — show preview */
            <>
              {schemaMsg && (
                <div className="bg-green-50 text-green-700 text-xs p-2 rounded-lg mb-3 border border-green-200">
                  {schemaMsg}
                </div>
              )}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-medium text-gray-800">{schema.schema_name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {schema.fields?.filter(f => f).length || 0} fields · {schema.schema_type}
                  </div>
                </div>
                <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                  Active
                </span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-2">Fields in schema:</div>
                {schema.fields?.filter(f => f).map((field, i) => (
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
            </>
          ) : (
            /* No schema — show notice */
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="text-amber-500 text-xl flex-shrink-0">⚠️</div>
                  <div>
                    <div className="text-sm font-medium text-amber-800 mb-1">No schema configured</div>
                    <div className="text-xs text-amber-700">
                      A schema defines what your transactions look like.
                      Without a schema your Compose form uses default fields.
                    </div>
                  </div>
                </div>
              </div>
              {schemaMsg && (
                <div className="bg-red-50 text-red-700 text-xs p-2 rounded-lg mb-3">{schemaMsg}</div>
              )}
              <button onClick={handleCreateSchema} disabled={creating}
                className="w-full bg-blue-600 text-white text-sm font-medium py-3 rounded-lg disabled:opacity-50">
                {creating ? 'Creating...' : 'Create product schema'}
              </button>
              <div className="text-xs text-gray-400 text-center mt-2">
                Creates Product · Quantity · Price fields
              </div>
            </>
          )}
        </div>

        {/* Business status */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">Business status</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-800">Open for business</div>
              <div className="text-xs text-gray-400 mt-0.5">Partners can send you transactions</div>
            </div>
            <div className="w-10 h-6 bg-blue-600 rounded-full relative flex-shrink-0">
              <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"/>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
