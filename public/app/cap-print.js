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
 * OWNS      the Print setup screen: the signature editor (lines · order · paper), its model, and the live message to the sample bill's frame.
 * CALLED BY settings.html (#/print → CBPrint.mount(host)); e2e walks read signatureOf / headLinesOf / rowsOf.
 * FLOW      mount → read() → signatureOf() → paint() → onClick/onInput → tell() → (postMessage) bill-print.html … save() → saveVaultPatch()
 * CARD 20-settings-governance-and-plan/print-setup
 */
'use strict';
var CBPrint = (function () {
  var STATE = { host: null, me: null, base: null, model: null, frame: null, timer: null, saving: false };
  var PREVIEW_DELAY_MS = 120;   // typing waits this long before the sample bill repaints
  /** the lines of a signature, in their default order — [tag, label] */
  var LINES = [
    ['trade_name', 'Trading name'], ['legal_name', 'Legal name'], ['tax_id', 'Tax ID'], ['address', 'Address'],
    ['phone', 'Phone'], ['email', 'E-mail'], ['footer', 'Footer line'], ['logo', 'Logo (a web address)'],
  ];
  var PAPERS = [['80', '80 mm slip'], ['58', '58 mm slip'], ['a4', 'A4']];
  /** the lines a tax invoice MUST carry under the shop's pack — cannot be unticked; the cite is the pack's own */
  var REQUIRED = { IN: ['trade_name', 'tax_id', 'address'], AU: ['trade_name', 'tax_id'], AE: ['trade_name', 'tax_id', 'address'] };
  var DEFAULT_SHOWN = ['trade_name', 'tax_id', 'address', 'phone'];
  var DEFAULT_PAPER = '80';
  var DEFAULT_TAX_WORD = 'GST', DEFAULT_TAX_RATE = 18, DEFAULT_CURRENCY = 'INR';   // the sample bill's words when the pack says nothing
  function countryCode() { return (STATE.me && String(STATE.me.country || STATE.me.country_code || '').toUpperCase()) || ''; }
  /** the shop's country pack (the regulation engine's), or null when there is none or the engine is not loaded */
  function pack() {
    try { return (window.CBRegulation && countryCode() && CBRegulation.packFor(countryCode())) || null; }
    catch (error) { console.warn('print setup: no country pack for ' + countryCode(), (error && error.message) || error); return null; }
  }
  function requiredLines() { return REQUIRED[countryCode()] || ['trade_name', 'tax_id']; }
  function requiredWhy() {
    var shopPack = pack(), cite = shopPack && shopPack.tax && shopPack.tax.taxInvoice && shopPack.tax.taxInvoice.cite;
    return cite ? txf('A tax invoice must carry it — {cite}', { cite: String(cite).split(';')[0] }) : tx('A tax invoice must carry it.');
  }
  function lineLabel(tag) { return tag === 'tax_id' ? taxIdWord(countryCode()) : tx((LINES.filter(function (line) { return line[0] === tag; })[0] || [])[1] || tag); }

  /* ── the model: the vault's `signature` section (rows by tag) → { lines: {tag: value}, shown: [tags in order], paper } ── */
  function sectionOf(sections, type) { return (sections || []).filter(function (section) { return section.type === type; })[0] || null; }
  function rowsByTag(section) { var byTag = {}; ((section && section.rows) || []).forEach(function (row) { if (row.tag) byTag[row.tag] = row.value || ''; }); return byTag; }
  /** the first of the candidates that holds something, else '' */
  function firstFilled() { return Array.prototype.filter.call(arguments, Boolean)[0] || ''; }
  /** each line's value: what was saved on the signature, else the vault's identity rows, else what the shop already holds */
  function linesOf(saved, identity, shop) {
    return {
      trade_name: firstFilled(saved.trade_name, shop.display_name), legal_name: firstFilled(saved.legal_name, identity.legal_name), tax_id: firstFilled(saved.tax_id, identity.gstin, shop.gstn),
      address: firstFilled(saved.address, identity.address, shop.address), phone: firstFilled(saved.phone, identity.phone, shop.phone), email: firstFilled(saved.email, identity.email, shop.email),
      footer: firstFilled(saved.footer), logo: firstFilled(saved.logo),
    };
  }
  /** the editor's model from the vault + the shop's own facts (a line never set falls to what the shop already holds) */
  function signatureOf(sections, shop) {
    var saved = rowsByTag(sectionOf(sections, 'signature')), identity = rowsByTag(sectionOf(sections, 'identity'));
    var shown = saved.order ? saved.order.split(',').filter(Boolean) : DEFAULT_SHOWN.slice();
    requiredLines().forEach(function (tag) { if (shown.indexOf(tag) < 0) shown.push(tag); });
    var knownPaper = PAPERS.some(function (paper) { return paper[0] === saved.paper; });
    return { lines: linesOf(saved, identity, shop), shown: shown, paper: knownPaper ? saved.paper : DEFAULT_PAPER };
  }
  /** the model back to vault rows (the section the merge-patch writes) */
  function rowsOf(model) {
    var rows = LINES.map(function (line) { return { name: lineLabel(line[0]), tag: line[0], value: model.lines[line[0]] || '' }; });
    rows.push({ name: 'Order', tag: 'order', value: model.shown.join(',') });
    rows.push({ name: 'Paper', tag: 'paper', value: model.paper });
    return rows;
  }
  /** one head line for the renderer: the tax id under the pack's word (only on a tax invoice), the phone as "Ph …", the logo as an image */
  function headLineOf(tag, value, model) {
    if (tag === 'tax_id') return { tag: tag, text: taxIdWord(countryCode()) + ' ' + value, only_taxed: true };
    if (tag === 'phone') return { tag: tag, text: 'Ph ' + value };
    if (tag === 'logo') return { tag: tag, logo: value };
    return { tag: tag, text: value, big: tag === 'trade_name' };
  }
  /** what the renderer paints at the head of the paper, in the shop's order — the tax id under the pack's word */
  function headLinesOf(model) {
    return model.shown.map(function (tag) { var value = model.lines[tag]; return value ? headLineOf(tag, value, model) : null; }).filter(Boolean);
  }

  /* ── paint ── */
  /** the "shows on the bill" tick; a line the pack requires on a tax invoice is ticked, disabled, with the pack's cite */
  function tick(tag) {
    var isShown = STATE.model.shown.indexOf(tag) >= 0, isLocked = requiredLines().indexOf(tag) >= 0;
    return '<label class="tick"><input type="checkbox" data-pr-show="' + esc(tag) + '" data-testid="pr-show-' + esc(tag) + '"' + (isShown ? ' checked' : '') + (isLocked ? ' disabled' : '') + '> ' + esc(tx('shows on the bill')) + '</label>'
      + (isLocked ? '<span class="why" data-testid="pr-locked-' + esc(tag) + '">' + esc(requiredWhy()) + '</span>' : '');
  }
  /** one ↑ / ↓ button that moves a line in the order */
  function moveButton(tag, direction, arrow, isDisabled) {
    var which = direction < 0 ? 'up' : 'down', label = direction < 0 ? 'Move up' : 'Move down';
    return '<button type="button" class="composebtn ghost" data-pr-move="' + esc(tag) + '" data-dir="' + direction + '" data-testid="pr-' + which + '-' + esc(tag) + '" aria-label="' + esc(tx(label)) + '" style="min-height:30px;padding:0 8px"' + (isDisabled ? ' disabled' : '') + '>' + arrow + '</button>';
  }
  /** one line of the editor: its label, its text box, the tick and the two move buttons */
  function lineRow(tag) {
    var model = STATE.model, position = model.shown.indexOf(tag);
    return '<div class="pr-row" data-testid="pr-line-' + esc(tag) + '"><label class="fl" style="margin:0;flex-basis:100%">' + esc(lineLabel(tag)) + '</label>'
      + '<input class="inp" data-pr-line="' + esc(tag) + '" data-testid="pr-in-' + esc(tag) + '" value="' + esc(model.lines[tag] || '') + '" maxlength="240">'
      + tick(tag)
      + moveButton(tag, -1, '↑', position <= 0)
      + moveButton(tag, 1, '↓', position < 0 || position >= model.shown.length - 1) + '</div>';
  }
  /** the shown lines in their order, then the lines not shown */
  function orderedTags() {
    var model = STATE.model, rest = LINES.map(function (line) { return line[0]; }).filter(function (tag) { return model.shown.indexOf(tag) < 0; });
    return model.shown.concat(rest);
  }
  function paperRow(model) {
    return '<div class="pr-row"><label class="fl" style="margin:0;flex-basis:100%">' + esc(tx('Paper')) + '</label><select class="inp" id="pr_paper" data-testid="pr-paper" style="max-width:220px">'
      + PAPERS.map(function (paper) { return '<option value="' + paper[0] + '"' + (model.paper === paper[0] ? ' selected' : '') + '>' + esc(tx(paper[1])) + '</option>'; }).join('') + '</select></div>';
  }
  /** paint the editor on the left and the sample bill's frame on the right; the frame tells itself once loaded */
  function paint() {
    var host = STATE.host, model = STATE.model; if (!host || !model) return;
    host.innerHTML = '<h1 class="sx-h" data-testid="sx-title">' + esc(tx('Print setup')) + '</h1>'
      + '<p class="sub" data-testid="pr-why">' + esc(tx('The bill’s signature: set once, printed on every bill, quote and receipt.')) + '</p>'
      + '<div class="pr-grid"><div data-testid="pr-editor">'
      + orderedTags().map(lineRow).join('')
      + paperRow(model)
      + '<div class="err" id="pr_err" data-testid="pr-err" style="margin-top:8px"></div>'
      + '<button type="button" class="act" id="pr-save" data-testid="pr-save" style="margin-top:8px">' + esc(tx('Save')) + '</button>'
      + '<p class="sub"><a class="sx-link" href="/settings.html#/shop" data-testid="pr-shop-link">' + esc(tx('The shop’s own facts — Your shop')) + ' ›</a></p>'
      + '</div><div class="pr-prev" data-testid="pr-preview"><div class="sec" style="margin:0 0 6px">' + esc(tx('Sample bill — live')) + '</div>'
      + '<iframe id="pr_frame" title="' + esc(tx('Sample bill')) + '" src="/bill-print.html?preview=1"></iframe></div></div>';
    STATE.frame = document.getElementById('pr_frame');
    STATE.frame.addEventListener('load', tell);
    host.onclick = onClick; host.oninput = onInput; host.onchange = onInput;
    document.getElementById('pr-save').onclick = save;
  }
  /** an ↑ / ↓ press: move the line one place in the order, repaint, tell the sample bill */
  function onClick(event) {
    var button = event.target.closest && event.target.closest('[data-pr-move]'); if (!button || button.disabled) return;
    var tag = button.getAttribute('data-pr-move'), direction = Number(button.getAttribute('data-dir')), model = STATE.model;
    var from = model.shown.indexOf(tag), to = from + direction;
    if (from < 0 || to < 0 || to >= model.shown.length) return;
    model.shown.splice(from, 1); model.shown.splice(to, 0, tag); STATE.dirty = true; paint(); tell();
  }
  /** tick a line on (added at the end) or off */
  function setShown(model, tag, isOn) {
    if (isOn) { if (model.shown.indexOf(tag) < 0) model.shown.push(tag); }
    else model.shown = model.shown.filter(function (shownTag) { return shownTag !== tag; });
  }
  /** a typed line, a tick or the paper changed: take it into the model and tell the sample bill (typing waits a beat) */
  function onInput(event) {
    var field = event.target, model = STATE.model; if (!field) return;
    if (field.hasAttribute('data-pr-line')) { model.lines[field.getAttribute('data-pr-line')] = field.value; STATE.dirty = true; return tellSoon(); }
    if (field.hasAttribute('data-pr-show')) { setShown(model, field.getAttribute('data-pr-show'), field.checked); STATE.dirty = true; paint(); return tell(); }
    if (field.id === 'pr_paper') { model.paper = field.value; STATE.dirty = true; return tell(); }
  }
  /** the pack's standard tax rate: its own `standard_rate`, else the last of its rates, else the sample's */
  function packRate(shopPack) {
    var taxRules = shopPack && shopPack.tax;
    return (taxRules && (taxRules.standard_rate || (taxRules.rates && taxRules.rates[taxRules.rates.length - 1]))) || DEFAULT_TAX_RATE;
  }
  /** the tax words the sample bill uses: the pack's word, whether it splits by state, its rate, the tax id's word */
  function taxMessage(shopPack) {
    return { word: (shopPack && shopPack.tax && shopPack.tax.scheme) || DEFAULT_TAX_WORD, split: typeof packSplitsByState === 'function' ? packSplitsByState(countryCode()) : true,
      rate: packRate(shopPack), id_word: taxIdWord(countryCode()) };
  }
  /** the sample bill's money: the shop's own currency, else the pack's, else the sample's */
  function currencyOf(shopPack) { return (STATE.me && STATE.me.currency_code) || (shopPack && shopPack.currency) || DEFAULT_CURRENCY; }
  /** the renderer's message: the head lines in order, the footer, the paper, the pack's tax words and rate — bill-print.html paints the rest */
  function tell() {
    var frame = STATE.frame, model = STATE.model; if (!frame || !frame.contentWindow || !model) return;
    var shopPack = pack(), isTaxed = !!((STATE.me && STATE.me.gstn) || model.lines.tax_id);
    frame.contentWindow.postMessage({ cb_preview: true, head: headLinesOf(model), footer: model.lines.footer || '', paper: model.paper, kind: isTaxed ? 'tax' : 'cash',
      currency: currencyOf(shopPack), tax: taxMessage(shopPack) }, '*');
  }
  function tellSoon() { clearTimeout(STATE.timer); STATE.timer = setTimeout(tell, PREVIEW_DELAY_MS); }
  /* ── the one save: the signature section through the vault's merge-patch (cap-shop.js W25) ── */
  function save(trigger) {
    var errorBox = document.getElementById('pr_err'); if (errorBox) errorBox.textContent = '';
    var sections = _vaultSecs(), signature = sectionOf(sections, 'signature');
    if (signature) signature.rows = rowsOf(STATE.model); else sections.push({ type: 'signature', label: '', rows: rowsOf(STATE.model) });
    var saveButton = trigger && trigger.tagName ? trigger : document.getElementById('pr-save');
    return CBAction.run(saveButton, function () { return saveVaultPatch(); }, {
      key: 'pr-save', busy: tx('Saving…'),
      outcome: function () { STATE.dirty = false; toast(tx('Print setup saved.')); },
      onFail: function (words, err) { if (errorBox) errorBox.innerHTML = err && err.status === 409 ? vaultConflictHTML(words) : esc(words); },
    });
  }
  /** the vault's patch writer, awaited (saveVaultUI paints its own outcome; this one answers the action helper) */
  function saveVaultPatch() {
    var patch = vaultPatch(UI._vaultBase || [], _vaultSecs());
    if (!patch) return Promise.resolve({});
    return api('vaultSave', { body: { version: UI._vaultVersion, patch: patch } }).then(function (saved) { vaultHold((saved && saved.vault) || { sections: _vaultSecs() }, saved && saved.version); return saved; });
  }
  /** the two reads the screen paints from (the shop, the profile with its vault), then the model and the first paint */
  function read() {
    STATE.host.innerHTML = '<div class="loadwrap"><span class="spin"></span> ' + esc(tx('Reading…')) + '</div>';
    return Promise.all([api('me').then(function (answer) { return (answer && (answer.entity || answer)) || {}; }), api('profileGet')]).then(function (answers) {
      STATE.me = answers[0]; var profile = answers[1] || {};
      vaultHold({ sections: ((profile.vault || {}).sections) || [] }, profile.vault_version); UI._vaultEnc = !!profile.vault_encrypted;
      STATE.model = signatureOf(_vaultSecs(), STATE.me); STATE.dirty = false;
      paint(); tell();
    }, function (err) {
      if (err && err.status === 401 && typeof CBFrame !== 'undefined') return CBFrame.ended();
      STATE.host.innerHTML = '<div class="empty" data-testid="pr-readerr"><div class="t">' + esc(tx('Could not read the shop')) + '</div>' + esc(tx('Nothing was lost. Try again in a moment.')) + '</div>';
    });
  }
  function mount(host) {
    STATE.host = host; STATE.model = null; STATE.dirty = false;
    if (window.CBUnsaved) CBUnsaved.form({ dirty: function () { return !!STATE.dirty; }, save: function () { return save(); } });   /* W24 */
    return read();
  }
  return { mount: mount, signatureOf: signatureOf, headLinesOf: headLinesOf, rowsOf: rowsOf, LINES: LINES, PAPERS: PAPERS, REQUIRED: REQUIRED };
})();
