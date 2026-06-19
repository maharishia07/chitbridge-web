// src/pages/DiagnosisPanel.jsx — DEMO-5 unhappy-path diagnosis over B3.10 disputes.
// Read-only. One card per dispute: probe (fault) → localise (coordinate) → route (routing) + proof.
import { useState, useEffect } from 'react';
import { getDiagnosis } from '../api/client';

const CATEGORY_LABEL = {
  quality: 'Quality issue', quantity: 'Quantity mismatch', delivery: 'Delivery problem',
  payment: 'Payment concern', docs: 'Documentation error', other: 'Other',
};

// a small labelled chip
const Chip = ({ children, tone = 'gray' }) => {
  const tones = {
    green: 'bg-green-100 text-green-700 border-green-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    gray:  'bg-gray-100 text-gray-600 border-gray-200',
    blue:  'bg-blue-50 text-blue-700 border-blue-200',
  };
  return <span className={`text-xs px-1.5 py-0.5 rounded-full border ${tones[tone]}`}>{children}</span>;
};

const Row = ({ label, children }) => (
  <div className="flex items-start gap-2 py-1.5 border-t border-black/5 first:border-t-0">
    <span className="text-xs font-semibold text-gray-400 w-20 flex-shrink-0">{label}</span>
    <div className="text-xs text-gray-700 flex-1 min-w-0">{children}</div>
  </div>
);

function DiagnosisCard({ d }) {
  const resolvable = d.resolvable;
  return (
    <div className={`rounded-xl border p-3 mb-3 ${
      resolvable ? 'border-green-300 bg-green-50/50' : 'border-gray-200 bg-gray-50 opacity-90'}`}>
      {/* header */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className={`text-sm font-semibold ${resolvable ? 'text-green-800' : 'text-gray-500'}`}>
          {CATEGORY_LABEL[d.category] || d.category}
        </span>
        {resolvable
          ? <Chip tone="green">resolvable</Chip>
          : <Chip tone="amber">record-only</Chip>}
      </div>

      {/* Coordinate — localise (who / what / which version) */}
      <Row label="Coordinate">
        <span className="font-medium text-gray-800">{d.coordinate.party}</span>
        {d.coordinate.line_item && <span className="text-gray-500"> · {d.coordinate.line_item}</span>}
        {d.coordinate.schema_version != null && <span className="text-gray-400"> · v{d.coordinate.schema_version}</span>}
      </Row>

      {/* Fault — probe (what went wrong) */}
      <Row label="Fault">
        {d.fault.summary}
        <span className="text-gray-400"> ({d.fault.state})</span>
      </Row>

      {/* Routing — route (how it's handled) */}
      <Row label="Routing">
        <span className="inline-flex gap-1.5 flex-wrap">
          <Chip tone="blue">{d.routing.scope === 'chit_wide' ? 'chit-wide' : 'targeted'}</Chip>
          <Chip tone={d.routing.mode === 'two_sided' ? 'green' : 'amber'}>
            {d.routing.mode === 'two_sided' ? 'two-sided' : 'one-sided'}
          </Chip>
          <Chip tone={d.routing.answerable ? 'green' : 'gray'}>
            {d.routing.answerable ? 'answerable' : 'not answerable'}
          </Chip>
        </span>
      </Row>

      {/* Proof — presence only + provenance */}
      <Row label="Proof">
        {d.proof.evidence_captured
          ? <span className="text-green-700">✓ Evidence captured</span>
          : <span className="text-gray-400">No evidence</span>}
        <span className="text-gray-400"> · arose from: {d.proof.arose_from}</span>
      </Row>

      {/* reason footer */}
      <div className="text-xs text-gray-500 italic mt-2 pt-2 border-t border-black/5">{d.reason}</div>
    </div>
  );
}

export default function DiagnosisPanel({ chitId }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      try { const r = await getDiagnosis(chitId); if (live) setData(r.data); }
      catch { if (live) setData({ diagnoses: [] }); }
      if (live) setLoading(false);
    })();
    return () => { live = false; };
  }, [chitId]);

  if (loading) return <div className="px-4 py-3 text-xs text-gray-400">Running diagnosis…</div>;

  const diagnoses = data?.diagnoses || [];

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">🩺</span>
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Diagnosis</span>
        {diagnoses.length > 0 && (
          <span className="text-xs text-gray-400">probe → localise → route</span>
        )}
      </div>
      {diagnoses.length === 0 ? (
        <div className="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-lg border border-gray-100">
          No diagnoses — this chit has no disputes.
        </div>
      ) : (
        diagnoses.map(d => <DiagnosisCard key={d.dispute_id} d={d} />)
      )}
    </div>
  );
}
