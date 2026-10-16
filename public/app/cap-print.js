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
 * OWNS the signature editor and its live preview · CALLED BY settings.html (CBPrint.mount for #/print) · FLOW  mount → read (me + vault) → signatureOf → paint → tell (postMessage) → edit → Save (vault merge-patch)
 * CARD 20-settings-governance-and-plan/print-setup
 */
'use strict';
var CBPrint = (function () {
  var held = { host: null, me: null, model: null, frame: null, timer: null, dirty: false };
  /** the lines of a signature, in their default order — [tag, label] */
  var LINES = [
    ['trade_name', 'Trading name'], ['legal_name', 'Legal name'], ['tax_id', 'Tax ID'], ['address', 'Address'],
    ['phone', 'Phone'], ['email', 'E-mail'], ['footer', 'Footer line'], ['logo', 'Logo (a web address)'],
  ];
  var PAPERS = [['80', '80 mm slip'], ['58', '58 mm slip'], ['a4', 'A4']];
  var DEFAULT_PAPER = '80', DEFAULT_SHOWN = ['trade_name', 'tax_id', 'address', 'phone'], PREVIEW_DELAY_MS = 120, INPUT_MAX_LENGTH = 240;
  /** the lines a tax invoice MUST carry under the shop's pack — cannot be unticked; the cite is the pack's own */
  var REQUIRED = { IN: ['trade_name', 'tax_id', 'address'], AU: ['trade_name', 'tax_id'], AE: ['trade_name', 'tax_id', 'address'] };
  var MOVE_BUTTON_STYLE = 'min-height:30px;padding:0 8px';

  function logQuiet(where, failure) { if (window.cbQuiet) window.cbQuiet('print:' + where, failure); }
  /** the first value that is filled in (a line never set falls to what the shop already holds); '' when none is */
  function firstFilled() { return Array.prototype.slice.call(arguments).filter(Boolean)[0] || ''; }
  function shopCountry() { var shop = held.me || {}; return String(shop.country || shop.country_code || '').toUpperCase(); }
  /** the shop's regulation pack (CBRegulation) — null when the engine is not loaded or has no pack for the country */
  function shopPack() {
    var country = shopCountry();
    if (!window.CBRegulation || !country) return null;
    try { return CBRegulation.packFor(country) || null; } catch (failure) { logQuiet('pack', failure); return null; }
  }
  function requiredLines() { return REQUIRED[shopCountry()] || ['trade_name', 'tax_id']; }
  /** why a locked line cannot be unticked: the pack's own cite when it has one */
  function requiredWhy() {
    var pack = shopPack(), cite = pack && pack.tax && pack.tax.taxInvoice && pack.tax.taxInvoice.cite;
    return cite ? txf('A tax invoice must carry it — {cite}', { cite: String(cite).split(';')[0] }) : tx('A tax invoice must carry it.');
  }
  function lineLabel(tag) {
    if (tag === 'tax_id') return taxIdWord(shopCountry());
    var line = LINES.filter(function (entry) { return entry[0] === tag; })[0] || [];
    return tx(line[1] || tag);
  }

  /* ── the model: the vault's `signature` section (rows by tag) → { lines: {tag: value}, shown: [tags in order], paper } ── */
  function sectionOfType(sections, type) { return (sections || []).filter(function (section) { return section.type === type; })[0] || null; }
  function rowsByTag(section) {
    var byTag = {};
    ((section && section.rows) || []).forEach(function (row) { if (row.tag) byTag[row.tag] = row.value || ''; });
    return byTag;
  }
  /** every line's value: the signature's own row, else the identity's, else the shop's own fact */
  function lineValues(signatureRows, identity, shop) {
    return {
      trade_name: firstFilled(signatureRows.trade_name, shop.display_name), legal_name: firstFilled(signatureRows.legal_name, identity.legal_name),
      tax_id: firstFilled(signatureRows.tax_id, identity.gstin, shop.gstn), address: firstFilled(signatureRows.address, identity.address, shop.address),
      phone: firstFilled(signatureRows.phone, identity.phone, shop.phone), email: firstFilled(signatureRows.email, identity.email, shop.email),
      footer: signatureRows.footer || '', logo: signatureRows.logo || '',
    };
  }
  /** the editor's model from the vault + the shop's own facts; the lines a tax invoice must carry are always shown */
  function signatureOf(sections, shop) {
    var signatureRows = rowsByTag(sectionOfType(sections, 'signature')), identity = rowsByTag(sectionOfType(sections, 'identity'));
    var shown = signatureRows.order ? signatureRows.order.split(',').filter(Boolean) : DEFAULT_SHOWN.slice();
    requiredLines().forEach(function (tag) { if (shown.indexOf(tag) < 0) shown.push(tag); });
    var knownPaper = PAPERS.some(function (paper) { return paper[0] === signatureRows.paper; });
    return { lines: lineValues(signatureRows, identity, shop), shown: shown, paper: knownPaper ? signatureRows.paper : DEFAULT_PAPER };
  }
  /** the model back to vault rows (the section the merge-patch writes) */
  function rowsOf(model) {
    var rows = LINES.map(function (line) { return { name: lineLabel(line[0]), tag: line[0], value: model.lines[line[0]] || '' }; });
    rows.push({ name: 'Order', tag: 'order', value: model.shown.join(',') });
    rows.push({ name: 'Paper', tag: 'paper', value: model.paper });
    return rows;
  }
  /** one shown line as the renderer paints it at the head of the paper (null when the line is empty) */
  function headLineOf(model, tag) {
    var value = model.lines[tag]; if (!value) return null;
    if (tag === 'tax_id') return { tag: tag, text: taxIdWord(shopCountry()) + ' ' + value, only_taxed: true };
    if (tag === 'phone') return { tag: tag, text: 'Ph ' + value };
    if (tag === 'logo') return { tag: tag, logo: value };
    return { tag: tag, text: value, big: tag === 'trade_name' };
  }
  /** what the renderer paints at the head of the paper, in the shop's order — the tax id under the pack's word */
  function headLinesOf(model) { return model.shown.map(function (tag) { return headLineOf(model, tag); }).filter(Boolean); }

  /* ── paint ── */
  /** the "shows on the bill" tick; a line the pack requires is ticked, locked, and says why */
  function tickHTML(tag) {
    var isOn = held.model.shown.indexOf(tag) >= 0, isLocked = requiredLines().indexOf(tag) >= 0;
    return '<label class="tick"><input type="checkbox" data-pr-show="' + esc(tag) + '" data-testid="pr-show-' + esc(tag) + '"' + (isOn ? ' checked' : '') + (isLocked ? ' disabled' : '') + '> ' + esc(tx('shows on the bill')) + '</label>'
      + (isLocked ? '<span class="why" data-testid="pr-locked-' + esc(tag) + '">' + esc(requiredWhy()) + '</span>' : '');
  }
  /** one ↑ / ↓ button that moves a line in the order (direction −1 or +1) */
  function moveButtonHTML(tag, direction, testId, label, arrow, isDisabled) {
    return '<button type="button" class="composebtn ghost" data-pr-move="' + esc(tag) + '" data-dir="' + direction + '" data-testid="' + testId + '-' + esc(tag) + '" aria-label="' + esc(tx(label)) + '" style="' + MOVE_BUTTON_STYLE + '"' + (isDisabled ? ' disabled' : '') + '>' + arrow + '</button>';
  }
  /** one line of the editor: its label, the text, the tick, and the two move buttons (disabled at the ends and when the line is not shown) */
  function lineRowHTML(tag) {
    var model = held.model, position = model.shown.indexOf(tag);
    return '<div class="pr-row" data-testid="pr-line-' + esc(tag) + '"><label class="fl" style="margin:0;flex-basis:100%">' + esc(lineLabel(tag)) + '</label>'
      + '<input class="inp" data-pr-line="' + esc(tag) + '" data-testid="pr-in-' + esc(tag) + '" value="' + esc(model.lines[tag] || '') + '" maxlength="' + INPUT_MAX_LENGTH + '">'
      + tickHTML(tag)
      + moveButtonHTML(tag, -1, 'pr-up', 'Move up', '↑', position <= 0)
      + moveButtonHTML(tag, 1, 'pr-down', 'Move down', '↓', position < 0 || position >= model.shown.length - 1) + '</div>';
  }
  /** every line's tag: the shown ones in their order, then the rest */
  function orderedTags() {
    var shown = held.model.shown, rest = LINES.map(function (line) { return line[0]; }).filter(function (tag) { return shown.indexOf(tag) < 0; });
    return shown.concat(rest);
  }
  function paperRowHTML() {
    var options = PAPERS.map(function (paper) { return '<option value="' + paper[0] + '"' + (held.model.paper === paper[0] ? ' selected' : '') + '>' + esc(tx(paper[1])) + '</option>'; }).join('');
    return '<div class="pr-row"><label class="fl" style="margin:0;flex-basis:100%">' + esc(tx('Paper')) + '</label><select class="inp" id="pr_paper" data-testid="pr-paper" style="max-width:220px">' + options + '</select></div>';
  }
  /** the editor column: every line, the paper, the error spot, Save, and the door to Your shop */
  function editorHTML() {
    return '<div data-testid="pr-editor">' + orderedTags().map(lineRowHTML).join('') + paperRowHTML()
      + '<div class="err" id="pr_err" data-testid="pr-err" style="margin-top:8px"></div>'
      + '<button type="button" class="act" id="pr-save" data-testid="pr-save" style="margin-top:8px">' + esc(tx('Save')) + '</button>'
      + '<p class="sub"><a class="sx-link" href="/settings.html#/shop" data-testid="pr-shop-link">' + esc(tx('The shop’s own facts — Your shop')) + ' ›</a></p></div>';
  }
  /** the preview column: the real renderer (bill-print.html) in a frame */
  function previewHTML() {
    return '<div class="pr-prev" data-testid="pr-preview"><div class="sec" style="margin:0 0 6px">' + esc(tx('Sample bill — live')) + '</div>'
      + '<iframe id="pr_frame" title="' + esc(tx('Sample bill')) + '" src="/bill-print.html?preview=1"></iframe></div>';
  }
  /** paint the whole screen and wire it: one delegated click / input handler on the host, the frame told when it loads */
  function paint() {
    var host = held.host; if (!host || !held.model) return;
    host.innerHTML = '<h1 class="sx-h" data-testid="sx-title">' + esc(tx('Print setup')) + '</h1>'
      + '<p class="sub" data-testid="pr-why">' + esc(tx('The bill’s signature: set once, printed on every bill, quote and receipt.')) + '</p>'
      + '<div class="pr-grid">' + editorHTML() + previewHTML() + '</div>';
    held.frame = document.getElementById('pr_frame');
    held.frame.addEventListener('load', tell);
    host.onclick = onClick; host.oninput = onInput; host.onchange = onInput;
    document.getElementById('pr-save').onclick = save;
  }
  /** a ↑ / ↓ press: swap the line with its neighbour in the shown order */
  function onClick(event) {
    var button = event.target.closest && event.target.closest('[data-pr-move]'); if (!button || button.disabled) return;
    var tag = button.getAttribute('data-pr-move'), shown = held.model.shown, from = shown.indexOf(tag), to = from + Number(button.getAttribute('data-dir'));
    if (from < 0 || to < 0 || to >= shown.length) return;
    shown.splice(from, 1); shown.splice(to, 0, tag);
    held.dirty = true; paint(); tell();
  }
  /** a "shows on the bill" tick: add the line to (or take it off) the shown order, then repaint */
  function onShowTick(box) {
    var tag = box.getAttribute('data-pr-show'), model = held.model;
    if (!box.checked) model.shown = model.shown.filter(function (shownTag) { return shownTag !== tag; });
    else if (model.shown.indexOf(tag) < 0) model.shown.push(tag);
    held.dirty = true; paint(); tell();
  }
  /** a typed line, a tick or the paper select: hold it, mark the screen unsaved, tell the preview */
  function onInput(event) {
    var target = event.target, model = held.model; if (!target) return;
    if (target.hasAttribute('data-pr-line')) { model.lines[target.getAttribute('data-pr-line')] = target.value; held.dirty = true; return tellSoon(); }
    if (target.hasAttribute('data-pr-show')) return onShowTick(target);
    if (target.id === 'pr_paper') { model.paper = target.value; held.dirty = true; return tell(); }
  }
  /** the pack's standard rate for the sample lines: its own standard_rate, else the last of its rates, else 18 */
  function packRate(pack) {
    var taxRules = pack && pack.tax; if (!taxRules) return 18;
    return taxRules.standard_rate || (taxRules.rates && taxRules.rates[taxRules.rates.length - 1]) || 18;
  }
  /** the tax words the renderer paints: the pack's scheme word, split by state or one line, its rate, the id's word */
  function previewTax(pack) {
    var country = shopCountry();
    return { word: (pack && pack.tax && pack.tax.scheme) || 'GST', split: typeof packSplitsByState === 'function' ? packSplitsByState(country) : true, rate: packRate(pack), id_word: taxIdWord(country) };
  }
  /** the bill's currency for the sample: the shop's, else the pack's, else INR */
  function previewCurrency(shop, pack) { return shop.currency_code || (pack && pack.currency) || 'INR'; }
  /** the renderer's message: the head lines in order, the footer, the paper, the pack's tax words and rate — bill-print.html paints the rest */
  function tell() {
    var frame = held.frame, model = held.model; if (!frame || !frame.contentWindow || !model) return;
    var pack = shopPack(), shop = held.me || {}, isTaxed = !!(shop.gstn || model.lines.tax_id);
    frame.contentWindow.postMessage({ cb_preview: true, head: headLinesOf(model), footer: model.lines.footer || '', paper: model.paper, kind: isTaxed ? 'tax' : 'cash',
      currency: previewCurrency(shop, pack), tax: previewTax(pack) }, '*');
  }
  function tellSoon() { clearTimeout(held.timer); held.timer = setTimeout(tell, PREVIEW_DELAY_MS); }
  /* ── the one save: the signature section through the vault's merge-patch (cap-shop.js W25) ── */
  /** put the model's rows into the vault's `signature` section (created when the vault has none) */
  function holdSignatureRows() {
    var sections = _vaultSecs(), section = sectionOfType(sections, 'signature');
    if (section) section.rows = rowsOf(held.model); else sections.push({ type: 'signature', label: '', rows: rowsOf(held.model) });
  }
  /** Save: hold the rows, send the patch through CBAction; a stale version (409) shows the vault's Reload sentence */
  function save(source) {
    var errorBox = document.getElementById('pr_err'); if (errorBox) errorBox.textContent = '';
    holdSignatureRows();
    var button = source && source.tagName ? source : document.getElementById('pr-save');
    return CBAction.run(button, saveVaultPatch, {
      key: 'pr-save', busy: tx('Saving…'),
      outcome: function () { held.dirty = false; toast(tx('Print setup saved.')); },
      onFail: function (words, failure) { if (errorBox) errorBox.innerHTML = failure && failure.status === 409 ? vaultConflictHTML(words) : esc(words); },
    });
  }
  /** the vault's patch writer, awaited (saveVaultUI paints its own outcome; this one answers the action helper) */
  function saveVaultPatch() {
    var patch = vaultPatch(UI._vaultBase || [], _vaultSecs());
    if (!patch) return Promise.resolve({});
    return api('vaultSave', { body: { version: UI._vaultVersion, patch: patch } }).then(function (answer) {
      vaultHold((answer && answer.vault) || { sections: _vaultSecs() }, answer && answer.version);
      return answer;
    });
  }
  /** the shop and its vault read together; the vault becomes the base for the next patch, the model is built from it */
  function readAll() {
    return Promise.all([api('me').then(function (reply) { return (reply && (reply.entity || reply)) || {}; }), api('profileGet')]).then(function (answers) {
      held.me = answers[0]; var profile = answers[1] || {};
      vaultHold({ sections: ((profile.vault || {}).sections) || [] }, profile.vault_version); UI._vaultEnc = !!profile.vault_encrypted;
      held.model = signatureOf(_vaultSecs(), held.me); held.dirty = false;
      paint(); tell();
    });
  }
  /** could not read: a lost sign-in ends the frame's session; anything else says so in words */
  function readFailed(failure) {
    if (failure && failure.status === 401 && typeof CBFrame !== 'undefined') return CBFrame.ended();
    held.host.innerHTML = '<div class="empty" data-testid="pr-readerr"><div class="t">' + esc(tx('Could not read the shop')) + '</div>' + esc(tx('Nothing was lost. Try again in a moment.')) + '</div>';
  }
  function read() {
    held.host.innerHTML = '<div class="loadwrap"><span class="spin"></span> ' + esc(tx('Reading…')) + '</div>';
    return readAll().then(null, readFailed);
  }
  function mount(host) {
    held.host = host; held.model = null; held.dirty = false;
    if (window.CBUnsaved) CBUnsaved.form({ dirty: function () { return !!held.dirty; }, save: function () { return save(); } });   /* W24 */
    return read();
  }
  return { mount: mount, signatureOf: signatureOf, headLinesOf: headLinesOf, rowsOf: rowsOf, LINES: LINES, PAPERS: PAPERS, REQUIRED: REQUIRED };
})();
