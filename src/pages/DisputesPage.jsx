// src/pages/DisputesPage.jsx — Dispute queue across all chits (B3.5)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getDisputeQueue } from '../api/client';

const CATEGORY_LABEL = {
  quality:  'Quality issue',
  quantity: 'Quantity mismatch',
  delivery: 'Delivery problem',
  payment:  'Payment concern',
  docs:     'Documentation error',
  other:    'Other',
};

const fmtShort = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  : '';

export default function DisputesPage() {
  const { entity, isActor, parentEntityId } = useAuth();
  const navigate = useNavigate();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('all');

  const effectiveEntityId = isActor ? parentEntityId : entity?.identity_id;

  useEffect(() => { load(); }, [entity]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getDisputeQueue();
      setDisputes(res.data.disputes || []);
    } catch {}
    setLoading(false);
  };

  const openDisputes  = disputes.filter(d => d.status === 'open');
  const raised        = openDisputes.filter(d => d.raised_by_entity_id === effectiveEntityId);
  const counterparty  = openDisputes.filter(d => d.raised_by_entity_id !== effectiveEntityId);

  const tabs = [
    { id: 'all',    label: `All (${openDisputes.length})` },
    { id: 'raised', label: `You raised (${raised.length})` },
    { id: 'other',  label: `Other party (${counterparty.length})` },
  ];

  const shown = tab === 'raised' ? raised : tab === 'other' ? counterparty : openDisputes;

  return (
    <Layout title="Disputes">
      <div className="flex flex-col h-full">

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-white flex-shrink-0">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <div className="text-4xl mb-3">✅</div>
              <div className="text-sm font-medium text-gray-700">No open disputes</div>
              <div className="text-xs text-gray-400 mt-1">All clear</div>
            </div>
          ) : (
            shown.map(d => (
              <button
                key={d.dispute_id}
                onClick={() => navigate(`/chit/${d.chit_id}?tab=status`)}
                className="w-full text-left bg-white rounded-xl border border-gray-100 p-4 mb-3 active:bg-gray-50">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-red-500 text-base">⚠️</span>
                    <span className="text-xs font-semibold text-red-700">
                      {CATEGORY_LABEL[d.category] || d.category}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{fmtShort(d.created_at)}</span>
                </div>
                <div className="text-xs text-gray-700 leading-snug mb-2 line-clamp-2">
                  {d.reason}
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    Raised by <span className="font-medium text-gray-700">{d.raised_by_display_name}</span>
                  </div>
                  <div className="text-xs text-blue-600 font-medium">
                    View chit →
                  </div>
                </div>
                {d.chit_subject && (
                  <div className="mt-1.5 text-xs text-gray-400 truncate">
                    {d.chit_subject}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
