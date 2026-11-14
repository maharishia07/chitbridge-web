/* cap-bank-sheet.js — the Bank view's "Add to your books" SHEET (FIN-117): the statement's lines against the books, the questions each line asks, one confirm that says what it reaches, then the lines posted.
 * OWNS      bankSheetOpen (the sheet) · the controller's in-app options (ledger, post, parties, learned rules, who may post) · the confirm and the posting of the ready lines · the read of the books after.
 *           The flow is public/app/bank-preview.js (the same module the no-login demo runs), the lines are painted by public/app/bank-preview-ui.js, each line is posted by public/app/cap-bank-post.js.
 * CALLED BY cap-bank.js (the Add button over the lines, and Add missing on a line: bankAdd → bankSheetOpen). Loaded by public/accounts.html after cap-bank.js.
 * FLOW      bankSheetOpen → countrySetup (tax registered? unknown stays unknown) → CBBankPreview.create({ ledger: BKB.ledger, post: CBBankPost.adapter }) → load(BKB.text) → CBBankPreviewUI.mount → answers → Add N → CBAction.ask (reach) → postReady → bankLedger → paint
 * ⭐ THE STATEMENT NEVER LEAVES THE DEVICE: BKB.text is read by the engine here; what is sent is each confirmed entry (kind, date, amount, narration, one client_ref), as before.
 * ⭐ THE PAGE COMPUTES NO MONEY and defaults no unasked fact: the entry, its tax and its totals are the engine's; a registered shop is asked what tax a charge is (bank-preview.js heldHere_), an unknown registration asks nothing and claims nothing.
 * IDS       BKS014-U03 (the sheet) · BKS014-B16 (Add) · BKS014-B17 (Close) · BKS014-B18 (the Add button over the lines). CARD 16-finance/bank-reconciliation-and-bank-rail
 */
'use strict';
const BKSH = { ctl: null, ui: null, taxRegistered: null, posting: false };
/** the engine parts the sheet needs, or null when the page did not load them */
function bkshEngine() {
  const parts = { recon: window.CBBankRecon, project: window.CBBankProject, entry: window.CBBankEntry };
  return parts.recon && parts.project && parts.entry ? parts : null;
}
/** the shop's bank ledger as the preview reads it: every line carries its currency; read again after a post through bankLedger */
function bkshLedger() {
  const cur = String(bkCur() || '').toUpperCase(),
    lines = (BKB.ledger || []).map((item) => Object.assign({}, item, { currency: cur }));
  return { lines, opening_minor: Number((BKB.ledgerRaw || {}).opening_minor) || 0, posted_refs: lines.map((item) => item.ref).filter(Boolean) };
}
/** the parties the books know, in the shape the engine compares names against */
function bkshParties() {
  const known = (BKB.rail && BKB.rail.parties) || [];
  return known.map((item) => ({ id: item.party_id, name: item.name || '', kind: item.kind || item.role || undefined })).filter((item) => item.id && item.name);
}
/** true / false as the shop said, null when it did not or the read failed (SET-49: unknown is not false, and nothing is claimed on unknown) */
async function bkshRegistered() {
  try {
    const answer = (await api('countrySetup')) || {};
    return answer.tax && typeof answer.tax.registered === 'boolean' ? answer.tax.registered : null;
  } catch (failure) {
    bkQuiet('bank-sheet-registration', failure);
    return null;
  }
}
/** the shop's own bank ledger stands in for "bank" on the entry: the statement's own account, never a fixed Bank */
function bkshModeOf(body) {
  const mode = bkbModeOf(BKB.accts, BKB.stmtAcct || BKB.acct),
    swap = (key) => (body[key] === 'bank' ? mode : body[key]);
  if (!mode) return body;
  return Object.assign({}, body, { paid_from: swap('paid_from'), into: swap('into'), from: swap('from'), to: swap('to') });
}
/** the controller for this statement: the books it reads, the adapter that posts, the pack's country and the rules this device learned */
function bkshController() {
  const country = bkbCountry(),
    who = { role: typeof SESSION !== 'undefined' && SESSION && SESSION.role === 'entity' ? 'owner' : (SESSION && SESSION.role) || 'unknown' },
    acct = (BKB.accts || []).filter((item) => String(item.code) === String(BKB.stmtAcct || BKB.acct))[0] || {};
  return CBBankPreview.create({
    engine: bkshEngine(),
    currency: String(bkCur() || '').toUpperCase(),
    account: acct.name || String(BKB.acct),
    ledger: bkshLedger,
    post: CBBankPost.adapter({ api, who, modeOf: bkshModeOf }),
    lockedMonth: () => null /* a closed month is the server's answer, shown on the line */,
    statementCurrency: () => BKB.stmtCur || null,
    postable: CBBankPost.POSTABLE,
    taxRegistered: BKSH.taxRegistered,
    suggestOpts: { country, learned: bkbRules(), parties: bkshParties() },
    parseOpts: { country, currency: BKB.stmtCur || undefined, preset: BKB.preset || undefined }
  });
}
const bkshEl = (id) => document.getElementById(id);
/** the sheet's own words under the title: the refusal first, else the statement against the books now */
function bkshStrip(model) {
  const brs = model.projection && model.projection.brs;
  if (!brs) return '';
  return txf('Statement {s} · Books now {b} · Difference now {d}', {
    s: CBBankPreview.moneyText(brs.closing_statement, BKB.stmtCur),
    b: CBBankPreview.moneyText(brs.closing_books_before, BKB.stmtCur),
    d: CBBankPreview.moneyText(brs.difference_before, BKB.stmtCur)
  });
}
/** paint the sheet again from the controller: the strip, the lines, and the Add button with its count */
function bkshPaint() {
  const model = BKSH.ctl.view(),
    add = bkshEl('bks_add'),
    ready = BKSH.ctl.readyCount();
  bkshEl('bks_strip').textContent = bkshStrip(model);
  if (model.parsed) BKSH.ui.paint(model);
  if (model.refusal) bkshEl('bks_say').textContent = model.refusal;
  if (add) {
    add.disabled = !ready || BKSH.posting;
    add.textContent = ready ? txf('Add {n} to your books', { n: ready }) : tx('Nothing ready to add');
  }
}
/** the question the Add press asks first: how many entries, how much, which dates, how many new parties, how many still need you (the engine's own carried totals) */
function bkshAsk() {
  const said = BKSH.ctl.confirmText();
  if (!said) return null;
  return { title: tx(said.title), body: said.lines.map((words) => '<p>' + bkbE(words) + '</p>').join(''), yes: tx('Add to your books'), danger: false };
}
/** the one write: confirm, post the ready lines one at a time, read the books again, paint what happened on each line */
async function bkshAdd(btn) {
  const question = bkshAsk();
  if (!question) return void (bkshEl('bks_say').textContent = tx('The engine sent no figures for this press, so nothing was added.'));
  if (BKSH.posting || (await CBAction.ask(question)) !== true) return;
  BKSH.posting = true;
  bkshPaint();
  try {
    const done = await BKSH.ctl.postReady(() => {});
    await bankLedger();
    BKSH.ctl.answer('ledger_read', Date.now()); /* projects again over the books just read */
    bkshEl('bks_say').textContent = done.failed ? txf('{a} added, {f} not added: each says why on its line.', { a: done.added, f: done.failed }) : txf('{a} added to your books.', { a: done.added });
  } catch (failure) {
    bkQuiet('bank-sheet-add', failure);
    bkshEl('bks_say').textContent = tx('Could not finish adding. Nothing more was sent. Open the Bank view again to see what was added.');
  }
  BKSH.posting = false;
  bkshPaint();
}
/** the sheet closed: the Bank view reads the books again so the lines that were added show as matched */
function bkshClose() {
  closeModal();
  if (typeof bankRun === 'function' && BKB.parsed) bankRun().catch((failure) => bkQuiet('bank-sheet-close', failure));
}
/** open the sheet for the statement on screen */
async function bankSheetOpen() {
  if (!bkbBound()) return;
  if (!BKB.text || !bkshEngine() || typeof CBBankPreview === 'undefined' || typeof CBBankPreviewUI === 'undefined' || typeof CBBankPost === 'undefined') return toast(tx('Load the statement file again to add its lines.'));
  BKSH.taxRegistered = await bkshRegistered();
  BKSH.ctl = bkshController();
  ui.dialog({
    mount: 'BKS014-U03', pop: 'POP092', titleTestid: 'bank-sheet-title',
    titleText: tx('Add to your books'),
    bodyStyle: 'display:flex;flex-direction:column;gap:8px',
    body: '<div class="pe-note" id="bks_strip" data-testid="bank-sheet-strip" aria-live="polite"></div><div class="pe-bad" id="bks_say" data-testid="bank-sheet-say" role="status"></div><div id="bks_lines" class="bks-lines" data-testid="bank-sheet-lines"></div>',
    footerHtml: '<button data-cbsid="BKS014-B17" type="button" data-testid="bank-sheet-close" onclick="bkshClose()">' + bkbE(tx('Close')) + '</button>' +
      '<button data-cbsid="BKS014-B16" id="bks_add" type="button" class="pri" data-testid="bank-sheet-add" disabled onclick="bkshAdd(this)">' + bkbE(tx('Nothing ready to add')) + '</button>'
  });
  BKSH.ui = CBBankPreviewUI.mount({
    host: bkshEl('bks_lines'), controller: () => BKSH.ctl, currency: String(bkCur() || '').toUpperCase(), country: bkbCountry(), addedWords: tx('Added to your books'),
    say: (words) => { bkshEl('bks_say').textContent = words || ''; }, changed: bkshPaint
  });
  const said = BKSH.ctl.load(BKB.text, BKB.file && BKB.file.name);
  if (!said.ok) bkshEl('bks_say').textContent = said.why;
  bkshPaint();
}
/** the Add button over the lines (owner only: POST /events is the owner's); the sheet then shows every line with what it needs */
function bankSheetButton() {
  if (!BKB.text || (typeof SESSION !== 'undefined' && SESSION && SESSION.role && SESSION.role !== 'entity')) return '';
  return '<div class="pe-note"><button data-cbsid="BKS014-B18" type="button" class="pri" data-testid="bank-sheet-open" onclick="bankAdd()">' + bkbE(tx('Add to your books')) + '</button> ' + bkbE(tx('Lines your books lack, with what each needs.')) + '</div>';
}
