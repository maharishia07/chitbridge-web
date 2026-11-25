/**
 * e2e/cap-readiness-ai-minimums.test.cjs — the AI co-assist draft panel of Trade readiness (public/app/cap-readiness-ai.js) on the real functions: its screen minimums.
 * OWNS      the proof of a walk through the draft (the modal opens first, the api is asked with the skill and the clearance's context, the draft is drawn, Accept appears only for a document),
 *           that the draft box pairs the card surface with the card ink token (AA contrast follows the theme) and has no fixed width (dark and cream, 390 and 1366 px),
 *           and that a draft that could not be read says so in words, with the not-connected sentence for a missing key.
 * CALLED BY .github/workflows/ci.yml (Offline guards). No browser, no network.
 * CARD      21-compliance-attestation-and-trade/trade-readiness-lanes-instruments-journey-track
 *   node e2e/cap-readiness-ai-minimums.test.cjs
 */
'use strict';
const vm = require('vm');
const { liftFns } = require('./lib/lift-fn.cjs');
let fail = 0;
const t = (name, ok, why) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (ok ? '' : ' - ' + why)); if (!ok) fail++; };

function page(apiAnswer) {
  const seen = { modal: '', body: '', asked: null };
  const body = { set innerHTML(html) { seen.body = html; }, get innerHTML() { return seen.body; } };
  const context = vm.createContext({
    UI: { laneRd: { clearances: [{ standard: 'sds', doc: 'SDS', title: 'Safety data sheet' }] }, laneMatrix: { vertical: 'paint', origin: 'IN' }, laneDest: 'EU', profile: { legal_name: 'Asha Traders' } },
    esc: (text) => String(text), tx: (words) => words, modal: (html) => { seen.modal = html; }, closeModal() {},
    document: { getElementById: (id) => (id === 'aidbody' ? body : null) },
    api: async (name, options) => { seen.asked = { name, options }; return apiAnswer(); }
  });
  vm.runInContext(liftFns('public/app/cap-readiness-ai.js', ['_laneVert', '_laneOrigin', '_aiCtxExporter', 'aiDraftReadiness', '_aiDraft']) + '\nthis.f = { aiDraftReadiness };', context);
  return { context, seen };
}

(async () => {
  const document = page(async () => ({ draft: '# Safety data sheet', kind: 'document', note: 'Review before use' }));
  await document.context.f.aiDraftReadiness('sds', 'SDS', 'sds');
  t('walk: the modal opens first, saying it is invoking the co-assist', /Invoking the co-assist/.test(document.seen.modal), document.seen.modal.slice(0, 200));
  t('walk: the api is asked with the skill and the clearance context (standard, document, sector, origin, exporter)', document.seen.asked.name === 'aiDraft' && document.seen.asked.options.body.skill_id === 'sds' && document.seen.asked.options.body.context.standard === 'sds' && document.seen.asked.options.body.context.sector === 'paint' && document.seen.asked.options.body.context.exporter.name === 'Asha Traders', JSON.stringify(document.seen.asked));
  t('walk: the draft is drawn with Accept (a document), PDF, Copy and Done', /Accept &amp; attach as evidence/.test(document.seen.body) && /_aiPdf\(\)/.test(document.seen.body) && /_aiCopy\(this\)/.test(document.seen.body) && /closeModal\(\)/.test(document.seen.body), document.seen.body.slice(0, 200));
  t('dark and cream theme, 390 and 1366 px: the draft box is the card token, scrolls inside (max-height) and has no fixed width', /class="amddoc" style="background:var\(--card\)/.test(document.seen.body) && /max-height:52vh;overflow:auto/.test(document.seen.body) && !/class="amddoc"[^>]*\bwidth:\s*\d+px/.test(document.seen.body), document.seen.body.slice(0, 400));
  t('AA contrast: the draft box pairs var(--card) with var(--on-card), the Copy and Done buttons pair var(--card) with var(--ink)', /background:var\(--card\);border:1px solid var\(--line\);border-radius:9px;padding:16px 20px;max-height:52vh;overflow:auto;color:var\(--on-card\)/.test(document.seen.body) && /background:var\(--card\);color:var\(--ink\)/.test(document.seen.body), document.seen.body.slice(0, 400));

  const aid = page(async () => ({ draft: 'A hint', kind: 'aid' }));
  await aid.context.f.aiDraftReadiness('sds', 'SDS', 'sds');
  t('an aid (not a document) offers no Accept: only a document can become evidence', !/Accept &amp; attach/.test(aid.seen.body), aid.seen.body.slice(0, 200));

  const noKey = page(async () => { throw new Error('API 503 not connected'); });
  await noKey.context.f.aiDraftReadiness('sds', 'SDS', 'sds');
  t('could not draft, no key: says in words that AI is not connected yet', /AI is not connected yet \(no key on this environment\)\./.test(noKey.seen.body), noKey.seen.body);

  const broken = page(async () => { throw new Error('The draft service did not answer'); });
  await broken.context.f.aiDraftReadiness('sds', 'SDS', 'sds');
  t('could not draft, any other reason: the person reads the reason, nothing is filed', /The draft service did not answer/.test(broken.seen.body) && !/Accept/.test(broken.seen.body), broken.seen.body);
  process.exit(fail ? 1 : 0);
})();
