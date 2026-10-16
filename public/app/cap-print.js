/* app/cap-print.js — PRINT SETUP: what prints on the bill, set ONCE and previewed LIVE (SET-WALK1 · W27 / W27b, 2026-10-15).
 *
 * Athi's direction on the live AU shop (15 Oct): "something like signature in mail box" — the bill's SIGNATURE / LETTERHEAD: trading name ·
 * legal name · tax ID (the pack's word: ABN · GSTIN · TRN) · address · phone · e-mail · a footer line · a logo slot, each with a "shows on the
 * bill" tick and an order; paper A4 / 80 mm / 58 mm; and the LIVE SAMPLE BILL beside it, painted by the real renderer (bill-print.html — the
 * standalone slip the till's paper was proven from) with sample lines, per country (AU: "Tax invoice" + ABN + GST 10 %).
 *
 * ── WHAT IS REUSED (CLAUDE.md rule 1) ───────────────────────────────────────────────────────────────────────────────────────────────
 *   · the store: the vault's one merge-patch writer (cap-shop.js vaultHold · vaultPatch · saveVaultUI — W25); the signature is a vault SECTION
 *     of type `signature` (rows by tag: trade_name · legal_name · tax_id · address · phone · email · footer · logo · order · paper) — no new table
 *   · the words: taxIdWord / packWord (helpers.js); the pack (CBRegulation.packFor) says which lines a tax invoice must carry and the GST rate
 *   · the renderer: /bill-print.html in a frame, told by postMessage (its own render(), never a lookalike here)
 *   · the frame: settings.html's #set pane; the inputs are the page's .inp / .fl; the Save is CBAction (M64)
 * ── WHAT IS NEW, AND WHY ────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *   CBPrint.mount(host)  — nothing painted a signature editor before: the bill box on Your shop had the tax id and the address only (W26/W27)
 *   signatureOf / headLinesOf — the vault rows ↔ the editor's model ↔ the renderer's head lines (one shape per hop, built here once)
 * Host globals (as every cap-*.js): api · UI · SESSION · esc · tx · txf · toast · CBAction · CBUnsaved · the vault helpers of cap-shop.js.
 * Flow step: SET · print (docs/process/flows.json) — the bill's signature; O2C · invoice reads what it prints.
 * CARD 20-settings-governance-and-plan/print-setup
 */
'use strict';
var CBPrint = (function () {
  var H = { host: null, me: null, base: null, model: null, frame: null, timer: null, saving: false };
  /** the lines of a signature, in their default order — [tag, label, what feeds the default, locked-why reader] */
  var LINES = [
    ['trade_name', 'Trading name'], ['legal_name', 'Legal name'], ['tax_id', 'Tax ID'], ['address', 'Address'],
    ['phone', 'Phone'], ['email', 'E-mail'], ['footer', 'Footer line'], ['logo', 'Logo (a web address)'],
  ];
  var PAPERS = [['80', '80 mm slip'], ['58', '58 mm slip'], ['a4', 'A4']];
  /** the lines a tax invoice MUST carry under the shop's pack — cannot be unticked; the cite is the pack's own */
  var REQUIRED = { IN: ['trade_name', 'tax_id', 'address'], AU: ['trade_name', 'tax_id'], AE: ['trade_name', 'tax_id', 'address'] };
  function cc() { return (H.me && String(H.me.country || H.me.country_code || '').toUpperCase()) || ''; }
  function pack() { try { return (window.CBRegulation && cc() && CBRegulation.packFor(cc())) || null; } catch (_) { return null; } }
  function requiredLines() { return REQUIRED[cc()] || ['trade_name', 'tax_id']; }
  function requiredWhy() {
    var p = pack(), cite = p && p.tax && p.tax.taxInvoice && p.tax.taxInvoice.cite;
    return cite ? txf('A tax invoice must carry it — {cite}', { cite: String(cite).split(';')[0] }) : tx('A tax invoice must carry it.');
  }
  function lineLabel(tag) { return tag === 'tax_id' ? taxIdWord(cc()) : tx((LINES.filter(function (l) { return l[0] === tag; })[0] || [])[1] || tag); }

  /* ── the model: the vault's `signature` section (rows by tag) → { lines: {tag: value}, shown: [tags in order], paper } ── */
  function sectionOf(secs) { return (secs || []).filter(function (x) { return x.type === 'signature'; })[0] || null; }
  function rowsByTag(sec) { var m = {}; ((sec && sec.rows) || []).forEach(function (r) { if (r.tag) m[r.tag] = r.value || ''; }); return m; }
  /** the editor's model from the vault + the shop's own facts (a line never set falls to what the shop already holds) */
  function signatureOf(secs, me) {
    var r = rowsByTag(sectionOf(secs)), id = rowsByTag((secs || []).filter(function (x) { return x.type === 'identity'; })[0]);
    var lines = {
      trade_name: r.trade_name || me.display_name || '', legal_name: r.legal_name || id.legal_name || '', tax_id: r.tax_id || id.gstin || me.gstn || '',
      address: r.address || id.address || me.address || '', phone: r.phone || id.phone || me.phone || '', email: r.email || id.email || me.email || '',
      footer: r.footer || '', logo: r.logo || '',
    };
    var shown = r.order ? r.order.split(',').filter(Boolean) : ['trade_name', 'tax_id', 'address', 'phone'];
    requiredLines().forEach(function (t) { if (shown.indexOf(t) < 0) shown.push(t); });
    return { lines: lines, shown: shown, paper: PAPERS.some(function (p) { return p[0] === r.paper; }) ? r.paper : '80' };
  }
  /** the model back to vault rows (the section the merge-patch writes) */
  function rowsOf(m) {
    var rows = LINES.map(function (l) { return { name: lineLabel(l[0]), tag: l[0], value: m.lines[l[0]] || '' }; });
    rows.push({ name: 'Order', tag: 'order', value: m.shown.join(',') });
    rows.push({ name: 'Paper', tag: 'paper', value: m.paper });
    return rows;
  }
  /** what the renderer paints at the head of the paper, in the shop's order — the tax id under the pack's word */
  function headLinesOf(m) {
    return m.shown.map(function (t) {
      var v = m.lines[t]; if (!v) return null;
      if (t === 'tax_id') return { tag: t, text: taxIdWord(cc()) + ' ' + v, only_taxed: true };
      if (t === 'phone') return { tag: t, text: 'Ph ' + v };
      if (t === 'logo') return { tag: t, logo: v };
      return { tag: t, text: v, big: t === 'trade_name' };
    }).filter(Boolean);
  }

  /* ── paint ── */
  function tick(tag) {
    var m = H.model, on = m.shown.indexOf(tag) >= 0, locked = requiredLines().indexOf(tag) >= 0;
    return '<label class="tick"><input type="checkbox" data-pr-show="' + esc(tag) + '" data-testid="pr-show-' + esc(tag) + '"' + (on ? ' checked' : '') + (locked ? ' disabled' : '') + '> ' + esc(tx('shows on the bill')) + '</label>'
      + (locked ? '<span class="why" data-testid="pr-locked-' + esc(tag) + '">' + esc(requiredWhy()) + '</span>' : '');
  }
  function lineRow(tag) {
    var m = H.model, i = m.shown.indexOf(tag);
    return '<div class="pr-row" data-testid="pr-line-' + esc(tag) + '"><label class="fl" style="margin:0;flex-basis:100%">' + esc(lineLabel(tag)) + '</label>'
      + '<input class="inp" data-pr-line="' + esc(tag) + '" data-testid="pr-in-' + esc(tag) + '" value="' + esc(m.lines[tag] || '') + '" maxlength="240">'
      + tick(tag)
      + '<button type="button" class="composebtn ghost" data-pr-move="' + esc(tag) + '" data-dir="-1" data-testid="pr-up-' + esc(tag) + '" aria-label="' + esc(tx('Move up')) + '" style="min-height:30px;padding:0 8px"' + (i <= 0 ? ' disabled' : '') + '>↑</button>'
      + '<button type="button" class="composebtn ghost" data-pr-move="' + esc(tag) + '" data-dir="1" data-testid="pr-down-' + esc(tag) + '" aria-label="' + esc(tx('Move down')) + '" style="min-height:30px;padding:0 8px"' + (i < 0 || i >= m.shown.length - 1 ? ' disabled' : '') + '>↓</button></div>';
  }
  function orderedTags() { var m = H.model, rest = LINES.map(function (l) { return l[0]; }).filter(function (t) { return m.shown.indexOf(t) < 0; }); return m.shown.concat(rest); }
  function paint() {
    var h = H.host, m = H.model; if (!h || !m) return;
    h.innerHTML = '<h1 class="sx-h" data-testid="sx-title">' + esc(tx('Print setup')) + '</h1>'
      + '<p class="sub" data-testid="pr-why">' + esc(tx('The bill’s signature: set once, printed on every bill, quote and receipt.')) + '</p>'
      + '<div class="pr-grid"><div data-testid="pr-editor">'
      + orderedTags().map(lineRow).join('')
      + '<div class="pr-row"><label class="fl" style="margin:0;flex-basis:100%">' + esc(tx('Paper')) + '</label><select class="inp" id="pr_paper" data-testid="pr-paper" style="max-width:220px">' + PAPERS.map(function (p) { return '<option value="' + p[0] + '"' + (m.paper === p[0] ? ' selected' : '') + '>' + esc(tx(p[1])) + '</option>'; }).join('') + '</select></div>'
      + '<div class="err" id="pr_err" data-testid="pr-err" style="margin-top:8px"></div>'
      + '<button type="button" class="act" id="pr-save" data-testid="pr-save" style="margin-top:8px">' + esc(tx('Save')) + '</button>'
      + '<p class="sub"><a class="sx-link" href="/settings.html#/shop" data-testid="pr-shop-link">' + esc(tx('The shop’s own facts — Your shop')) + ' ›</a></p>'
      + '</div><div class="pr-prev" data-testid="pr-preview"><div class="sec" style="margin:0 0 6px">' + esc(tx('Sample bill — live')) + '</div>'
      + '<iframe id="pr_frame" title="' + esc(tx('Sample bill')) + '" src="/bill-print.html?preview=1"></iframe></div></div>';
    H.frame = document.getElementById('pr_frame');
    H.frame.addEventListener('load', tell);
    h.onclick = onClick; h.oninput = onInput; h.onchange = onInput;
    document.getElementById('pr-save').onclick = save;
  }
  function onClick(ev) {
    var b = ev.target.closest && ev.target.closest('[data-pr-move]'); if (!b || b.disabled) return;
    var tag = b.getAttribute('data-pr-move'), dir = Number(b.getAttribute('data-dir')), m = H.model, i = m.shown.indexOf(tag), j = i + dir;
    if (i < 0 || j < 0 || j >= m.shown.length) return;
    m.shown.splice(i, 1); m.shown.splice(j, 0, tag); H.dirty = true; paint(); tell();
  }
  function onInput(ev) {
    var t = ev.target, m = H.model; if (!t) return;
    if (t.hasAttribute('data-pr-line')) { m.lines[t.getAttribute('data-pr-line')] = t.value; H.dirty = true; return tellSoon(); }
    if (t.hasAttribute('data-pr-show')) { var tag = t.getAttribute('data-pr-show'); if (t.checked) { if (m.shown.indexOf(tag) < 0) m.shown.push(tag); } else m.shown = m.shown.filter(function (x) { return x !== tag; }); H.dirty = true; paint(); return tell(); }
    if (t.id === 'pr_paper') { m.paper = t.value; H.dirty = true; return tell(); }
  }
  /** the renderer's message: the head lines in order, the footer, the paper, the pack's tax words and rate — bill-print.html paints the rest */
  function tell() {
    var f = H.frame, m = H.model; if (!f || !f.contentWindow || !m) return;
    var p = pack(), taxed = !!((H.me && H.me.gstn) || m.lines.tax_id);
    f.contentWindow.postMessage({ cb_preview: true, head: headLinesOf(m), footer: m.lines.footer || '', paper: m.paper, kind: taxed ? 'tax' : 'cash', currency: (H.me && H.me.currency_code) || (p && p.currency) || 'INR',
      tax: { word: (p && p.tax && p.tax.scheme) || 'GST', split: typeof packSplitsByState === 'function' ? packSplitsByState(cc()) : true, rate: (p && p.tax && (p.tax.standard_rate || (p.tax.rates && p.tax.rates[p.tax.rates.length - 1]))) || 18, id_word: taxIdWord(cc()) } }, '*');
  }
  function tellSoon() { clearTimeout(H.timer); H.timer = setTimeout(tell, 120); }
  /* ── the one save: the signature section through the vault's merge-patch (cap-shop.js W25) ── */
  function save(btn) {
    var e = document.getElementById('pr_err'); if (e) e.textContent = '';
    var secs = _vaultSecs(), sec = sectionOf(secs);
    if (sec) sec.rows = rowsOf(H.model); else secs.push({ type: 'signature', label: '', rows: rowsOf(H.model) });
    var b = btn && btn.tagName ? btn : document.getElementById('pr-save');
    return CBAction.run(b, function () { return saveVaultPatch(); }, {
      key: 'pr-save', busy: tx('Saving…'),
      outcome: function () { H.dirty = false; toast(tx('Print setup saved.')); },
      onFail: function (words, err) { if (e) e.innerHTML = err && err.status === 409 ? vaultConflictHTML(words) : esc(words); },
    });
  }
  /** the vault's patch writer, awaited (saveVaultUI paints its own outcome; this one answers the action helper) */
  function saveVaultPatch() {
    var patch = vaultPatch(UI._vaultBase || [], _vaultSecs());
    if (!patch) return Promise.resolve({});
    return api('vaultSave', { body: { version: UI._vaultVersion, patch: patch } }).then(function (r) { vaultHold((r && r.vault) || { sections: _vaultSecs() }, r && r.version); return r; });
  }
  function read() {
    H.host.innerHTML = '<div class="loadwrap"><span class="spin"></span> ' + esc(tx('Reading…')) + '</div>';
    return Promise.all([api('me').then(function (r) { return (r && (r.entity || r)) || {}; }), api('profileGet')]).then(function (rs) {
      H.me = rs[0]; var p = rs[1] || {};
      vaultHold({ sections: ((p.vault || {}).sections) || [] }, p.vault_version); UI._vaultEnc = !!p.vault_encrypted;
      H.model = signatureOf(_vaultSecs(), H.me); H.dirty = false;
      paint(); tell();
    }, function (err) {
      if (err && err.status === 401 && typeof CBFrame !== 'undefined') return CBFrame.ended();
      H.host.innerHTML = '<div class="empty" data-testid="pr-readerr"><div class="t">' + esc(tx('Could not read the shop')) + '</div>' + esc(tx('Nothing was lost. Try again in a moment.')) + '</div>';
    });
  }
  function mount(host) {
    H.host = host; H.model = null; H.dirty = false;
    if (window.CBUnsaved) CBUnsaved.form({ dirty: function () { return !!H.dirty; }, save: function () { return save(); } });   /* W24 */
    return read();
  }
  return { mount: mount, signatureOf: signatureOf, headLinesOf: headLinesOf, rowsOf: rowsOf, LINES: LINES, PAPERS: PAPERS, REQUIRED: REQUIRED };
})();
