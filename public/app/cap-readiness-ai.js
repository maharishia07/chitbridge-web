/* app/cap-readiness-ai.js — Trade readiness: the AI co-assist, split out of cap-readiness.js (web split 1129), code moved verbatim.
 * OWNS      the co-assist draft affordance of the readiness screens: RD_SKILL (which standard has which skill), the lane's query (_laneVert · _laneOrigin · _laneQuery), aiSuggestStandards · aiSuggestPartner · aiDraftReadiness · aiDraftCommerce, the draft panel (_aiDraft · _aiCopy · _aiAccept · _aiPdf); invoked, never autonomous: the person reviews and confirms
 * CALLED BY cap-readiness.js (the buttons it draws call these by name), loaded first through CAP_WITH.readiness (app.html); everything is read when called
 * FLOW      a button ──▶ aiDraftReadiness(standard, doc, skill) ──▶ _aiDraft ──▶ api aiDraft (accounts-shell CB_ASSIST_EP) ──▶ the panel ──▶ _aiAccept (the person confirms) | _aiCopy | _aiPdf
 * CARD      21-compliance-attestation-and-trade/trade-readiness-lanes-instruments-journey-track
 * RISK      plain (a draft only; the person decides)
 */
// ── AI CO-ASSIST (invoked, never autonomous) — the ONE reusable draft affordance. Any path passes a skill_id + the
// context it already holds; the co-assist PROPOSES a draft; the human reviews & confirms. Mirrors lib/ai.js single pipe. ──
var RD_SKILL = {
  'sds': 'sds',
  'exim-policy': 'export-declaration',
  'reach': 'evidence-assemble',
  'tsca': 'evidence-assemble',
  'iso-9001': 'evidence-assemble',
  'iso-14001': 'evidence-assemble',
  'iso-45001': 'evidence-assemble',
  'iso-27000': 'evidence-assemble',
  'bis': 'product-classify'
}; // which clearance standards have a drafting skill (the co-assist drafts the doc/evidence checklist)
function _rdSkill(it) {
  return it ? RD_SKILL[it.standard] || null : null;
}
/* CMP-1 (VERT-BOX VB4): the lane's sector and origin are the SERVER's answer (readiness.laneOf → govresolve.verticalOf, the stated
   country) unless the person picked a sector here. Never 'paint', never 'IN': an unstated value travels as null and the server asks. */
function _laneVert() {
  return UI.laneVertical || (UI.laneMatrix && UI.laneMatrix.vertical) || null;
}
function _laneOrigin() {
  return (UI.laneMatrix && UI.laneMatrix.origin) || UI.laneOrigin || null;
}
/** the lane query: the person's sector pick only — the origin is the shop's stated country, read by the server */
function _laneQuery(extra) {
  var query = Object.assign({}, extra || {});
  if (UI.laneVertical) query.vertical = UI.laneVertical;
  return query;
}
// advisory co-assist buttons (reuse the global aiRun) — standards to adopt, and who can carry a gap
function aiSuggestStandards() {
  if (typeof aiRun !== 'function') return;
  aiRun('standards-suggest', { sector: _laneVert(), market: UI.laneDest || 'EU', origin: _laneOrigin() }, { title: '✨ Standards to adopt' });
}
function aiSuggestPartner(std, doc) {
  if (typeof aiRun !== 'function') return;
  var it = ((UI.laneRd && UI.laneRd.clearances) || (UI.readiness && UI.readiness.clearances) || []).filter(function (item) {
    return item.standard === std && item.doc === doc;
  })[0];
  aiRun('partner-suggest', { gap: (it && (it.title || it.doc)) || std, standard: std, market: UI.laneDest || 'EU' }, { title: '✨ Suggest a partner' });
}
function _aiCtxExporter() {
  return { name: (UI.profile && UI.profile.legal_name) || (UI.profile && UI.profile.name) || '[to confirm]' };
}
// clearance path — draft a document from the standard/product the entity holds. Passes an ATTACH target so a document
// draft can be ACCEPTED → filed as the clearance's evidence on the rail (closes the advise→produce loop).
async function aiDraftReadiness(std, doc, skill) {
  var it = ((UI.laneRd && UI.laneRd.clearances) || (UI.readiness && UI.readiness.clearances) || []).filter(function (item) {
    return item.standard === std && item.doc === doc;
  })[0];
  return _aiDraft(
    skill,
    std,
    {
      standard: std,
      document: doc,
      sector: _laneVert(),
      origin: _laneOrigin(),
      destination: UI.laneDest || null,
      product: { description: doc },
      exporter: _aiCtxExporter()
    },
    { standard: std, doc: doc, title: (it && it.title) || doc, skill: skill }
  );
}
// commerce path — draft a commercial document/advice from the current trade lane (order specifics → [to confirm])
async function aiDraftCommerce(skill, label) {
  return _aiDraft(skill, label, {
    area: label,
    sector: _laneVert(),
    origin: _laneOrigin(),
    destination: UI.laneDest || null,
    incoterm: 'CIF',
    lc: { type: 'irrevocable confirmed', amount: '[to confirm]', expiry: '[to confirm]', incoterm: 'CIF' },
    order: { note: 'draft from the current lane; fill order specifics [to confirm]' },
    exporter: _aiCtxExporter()
  });
}
// AI draft modals use the SHARED global markdown renderer (_aiMd / _AI_MDCSS from app.html) — one renderer, converged (#8).
// the ONE reusable invoke+review modal — every path funnels here (mirrors lib/ai.js single pipe). `attach` (optional) =
// a clearance target {standard,doc,title,skill}; a DOCUMENT draft can then be ACCEPTED → filed as that clearance's evidence.
async function _aiDraft(skill, label, ctx, attach) {
  if (typeof modal === 'function')
    modal(
      '<div class="mhd"><div class="t">✨ Draft with AI — ' +
        esc(label) +
        '</div></div><div class="mbody" style="padding:16px"><div id="aidbody" style="font-size:var(--fs-2);color:var(--grey)">✨ Invoking the co-assist… drafting from what this order/profile holds.</div></div>',
      true
    );
  try {
    var reply = await api('aiDraft', { body: { skill_id: skill, context: ctx } });
    var draft = (reply && reply.draft) || '',
      cost = reply && reply.usage && reply.usage.est_cost_usd;
    UI._aiLast = { draft: draft, label: label, note: (reply && reply.note) || '', cost: cost, attach: attach || null };
    var bs = 'font-size:var(--fs-2);font-weight:700;border-radius:9px;padding:9px 13px;cursor:pointer';
    // a DOCUMENT (the actual cert/declaration) can become the clearance's evidence; aids (classify/summarize) cannot.
    var acceptBtn =
      attach && reply && reply.kind === 'document'
        ? '<button data-cbsid="SCR033-B01" onclick="_aiAccept()" title="File as evidence for ' +
          esc(attach.title || attach.doc) +
          '" style="' +
          bs +
          ';flex:1;border:1px solid var(--ok-3);background:var(--ok-3);color:var(--on-ok)">✓ Accept &amp; attach as evidence</button>'
        : '';
    var html =
      '<style>' +
      (typeof _AI_MDCSS !== 'undefined' ? _AI_MDCSS : '') +
      '</style>' +
      '<div style="font-size:var(--fs-1);color:var(--purple);background:var(--blue-tint-bg);border:1px solid #ddd4f5;border-radius:9px;padding:8px 11px;margin-bottom:12px;line-height:1.5">🤖 <b>AI proposal — not evidence.</b> ' +
      esc((reply && reply.note) || 'Review and confirm before you use it.') +
      (cost != null ? ' <span style="color:var(--grey)">· cost $' + cost + '</span>' : '') +
      '</div>' +
      '<div class="amddoc" style="background:var(--card);border:1px solid var(--line);border-radius:9px;padding:16px 20px;max-height:52vh;overflow:auto;color:var(--on-card)">' +
      (typeof _aiMd === 'function' ? _aiMd(draft) : esc(draft)) +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:13px;flex-wrap:wrap">' +
      acceptBtn +
      '<button data-cbsid="SCR033-B02" onclick="_aiPdf()" style="' +
      bs +
      ';flex:' +
      (acceptBtn ? '0 0 auto' : '1') +
      ';border:1px solid var(--purple);background:' +
      (acceptBtn ? 'var(--card)' : 'var(--purple)') +
      ';color:' +
      (acceptBtn ? 'var(--purple)' : 'var(--on-accent)') +
      '">⬇ PDF</button>' +
      '<button data-cbsid="SCR033-B03" onclick="_aiCopy(this)" data-draft="' +
      esc(encodeURIComponent(draft)) +
      '" style="' +
      bs +
      ';flex:0 0 auto;border:1px solid var(--line);background:var(--card);color:var(--ink)">' +
      tx('📋 Copy') +
      '</button>' +
      '<button data-cbsid="CMP004" onclick="closeModal()" style="' +
      bs +
      ';flex:0 0 auto;border:1px solid var(--line);background:var(--card);color:var(--ink)">' +
      tx('Done') +
      '</button>' +
      '</div>';
    var node = document.getElementById('aidbody');
    if (node) node.innerHTML = html;
  } catch (e) {
    var msg = (e && e.message) || 'AI draft failed';
    var b2 = document.getElementById('aidbody');
    if (b2)
      b2.innerHTML =
        '<div style="font-size:var(--fs-2);color:var(--warn-2);background:var(--warn-tint);border:1px solid #f0dcae;border-radius:9px;padding:10px 12px">' +
        esc(String(msg).indexOf('503') >= 0 || String(msg).indexOf('not connected') >= 0 ? 'AI is not connected yet (no key on this environment).' : msg) +
        '</div>';
  }
}
function _aiCopy(btn) {
  try {
    var t = decodeURIComponent(btn.getAttribute('data-draft') || '');
    if (navigator.clipboard) navigator.clipboard.writeText(t);
    if (typeof toast === 'function') toast('Draft copied ✓');
  } catch (_) { /* best effort: failing here changes nothing the user sees */ }
}
// close the loop: a confirmed DOCUMENT draft becomes the clearance's evidence — a self-chit on the rail carrying the
// document, then gather (identical to a manually-uploaded cert). AI goes from advisor → producer on the rail.
async function _aiAccept() {
  var d = UI._aiLast || {},
    at = d.attach;
  if (!d.draft || !at) {
    if (typeof toast === 'function') toast('Nothing to attach');
    return;
  }
  try {
    var subj = 'Clearance — ' + (at.title || at.doc || at.standard) + ' (AI-drafted)';
    var reply = await api('createChit', {
      body: { recipients: [{ name: 'self', role: 'to' }], manual_subject: subj, subject: subj, purpose: 'general', line_items: [] }
    });
    var chitId = reply && reply.chit_id;
    if (chitId && typeof attUpload === 'function' && typeof File !== 'undefined') {
      try {
        var f = new File([d.draft], String(at.skill || 'draft') + '.md', { type: 'text/markdown' });
        await attUpload(chitId, f);
      } catch (_) { /* best effort: failing here changes nothing the user sees */ }
    }
    var date = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    await api('readinessGather', {
      body: { standard_key: at.standard, doc_key: at.doc, evidence_ref: chitId || 'ai-drafted', valid_until: date, status: 'gathered' }
    });
    if (typeof closeModal === 'function') closeModal();
    if (typeof toast === 'function') toast('Accepted — filed as evidence on the rail ✓');
    UI.laneMatrix = undefined;
    UI.laneRd = undefined;
    if (typeof loadLanes === 'function') loadLanes();
  } catch (e) {
    if (typeof toast === 'function') toast((e && e.message) || 'Could not attach');
  }
}
// export the draft as a print-ready A4 document → the browser's "Save as PDF" (no dependency, works offline)
function _aiPdf() {
  var d = UI._aiLast || {};
  if (!d.draft) {
    if (typeof toast === 'function') toast('Nothing to export');
    return;
  }
  var node = window.open('', '_blank');
  if (!node) {
    if (typeof toast === 'function') toast('Allow pop-ups to export the PDF');
    return;
  }
  var pcss =
    '@page{size:A4;margin:18mm}*{box-sizing:border-box}body{margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1e2530}' +
    '.pg{max-width:760px;margin:0 auto;padding:22px}' +
    '.hd{border-bottom:2px solid var(--purple);padding-bottom:12px;margin-bottom:18px}' +
    '.brand{font-weight:800;letter-spacing:.05em;color:var(--purple);font-size:var(--fs-2)}' +
    '.doctitle{font-size:var(--fs-5);font-weight:800;margin-top:4px;color:#141a22}' +
    '.meta{font-size:var(--fs-1);color:#7a8494;margin-top:5px}' +
    '.stamp{display:inline-block;margin-top:9px;font-size:var(--fs-1);font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--warn-2);background:var(--warn-tint);border:1px solid #f0dcae;border-radius:5px;padding:3px 8px}' +
    '.foot{margin-top:26px;padding-top:10px;border-top:1px solid #e6eaf0;font-size:var(--fs-1);color:#9aa3b0;text-align:center}' +
    (typeof _AI_MDCSS !== 'undefined' ? _AI_MDCSS : '') +
    '.amddoc{font-size:var(--fs-2)}';
  var when = CBLocale.datetime(Date.now());
  node.document.write(
    '<!doctype html><html><head><meta charset="utf-8"><title>' +
      esc(d.label || 'AI draft') +
      '</title><style>' +
      pcss +
      '</style></head><body><div class="pg">' +
      '<div class="hd"><div class="brand">CHIT &amp; BRIDGE</div><div class="doctitle">' +
      esc(d.label || 'Draft') +
      '</div><div class="meta">Drafted by AI co-assist · ' +
      esc(when) +
      (d.cost != null ? ' · est. $' + d.cost : '') +
      '</div><div class="stamp">AI draft — not evidence until accepted</div></div>' +
      '<div class="amddoc">' +
      (typeof _aiMd === 'function' ? _aiMd(d.draft || '') : esc(d.draft || '')) +
      '</div>' +
      '<div class="foot">Generated on the Chit &amp; Bridge governance rail · review and confirm before use</div>' +
      '</div></body></html>'
  );
  node.document.close();
  node.focus();
  setTimeout(function () {
    try {
      node.print();
    } catch (_) { /* best effort: failing here changes nothing the user sees */ }
  }, 350);
}
