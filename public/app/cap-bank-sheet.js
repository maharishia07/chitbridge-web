/* cap-bank-sheet.js — the Bank view's "Add to your books" SHEET (FIN-117): the statement's lines against the books, the questions each line asks, one confirm that says what it reaches, then the lines posted.
 * OWNS      bankSheetOpen (the sheet) · the controller's in-app options (ledger, post, parties, learned rules, who may post) · the confirm and the posting of the ready lines · the read of the books after.
 *           The flow is public/app/bank-preview.js (the same module the no-login demo runs), the lines are painted by public/app/bank-preview-ui.js, each line is posted by public/app/cap-bank-post.js.
 * CALLED BY cap-bank.js (the primary Add button in the band, and Add missing on a line: bankAdd → bankSheetOpen). Loaded by public/accounts.html after cap-bank.js.
 * FLOW      bankSheetOpen → countrySetup (tax registered? unknown stays unknown) → CBBankPreview.create({ ledger: bkshBook().ledger, post: CBBankPost.adapter }) → load(bkshBook().text) → CBBankPreviewUI.mount → answers → Add N → CBAction.ask (reach) → postReady → bankLedger → paint
 * ⭐ THE STATEMENT NEVER LEAVES THE DEVICE: bkshBook().text is read by the engine here; what is sent is each confirmed entry (kind, date, amount, narration, one client_ref), as before.
 * ⭐ THE PAGE COMPUTES NO MONEY and defaults no unasked fact: the entry, its tax and its totals are the engine's; a registered shop is asked what tax a charge is (bank-preview.js heldHere_), an unknown registration asks nothing and claims nothing.
 * IDS       BKS014-U03 (the sheet) · BKS014-B16 (Add) · BKS014-B17 (Close) · BKS014-B18 (the Add button in the band, drawn by cap-bank.js bankPrimaryHtml). CARD 16-finance/bank-reconciliation-and-bank-rail
 */
'use strict';
/** the Bank view's own state (cap-bank.js declares BKB; this file reads it through one door) */
const bkshBook = () => BKB;
/** the shop's own login (the page's isOwner: a co-assist is not the owner); false where the page has none */
const bkshIsOwner = () => typeof isOwner === 'function' && isOwner();
const BKSH = { ctl: null, ui: null, key: '', taxRegistered: null, posting: false };
/** the statement the answers belong to: the account and the file's hash; the controller (and every answer on it) is kept for this key, so closing the sheet never loses them */
const bkshKey = () => String(bkshBook().stmtAcct || bkshBook().acct) + ':' + ((bkshBook().file && bkshBook().file.hash) || '');
/** the engine parts the sheet needs, or null when the page did not load them */
function bkshEngine() {
  const parts = { recon: window.CBBankRecon, project: window.CBBankProject, entry: window.CBBankEntry, statementCheck: window.CBBankStatementCheck };
  return parts.recon && parts.project && parts.entry ? parts : null;
}
/** the shop's bank ledger as the preview reads it: every line carries its currency; read again after a post through bankLedger */
function bkshLedger() {
  const cur = String(bkCur() || '').toUpperCase(),
    lines = (bkshBook().ledger || []).map((item) => Object.assign({}, item, { currency: cur }));
  return { lines, opening_minor: Number((bkshBook().ledgerRaw || {}).opening_minor) || 0, posted_refs: lines.map((item) => item.ref).filter(Boolean) };
}
/** the parties the books know, in the shape the engine compares names against */
function bkshParties() {
  const known = (bkshBook().rail && bkshBook().rail.parties) || [];
  return known.map((item) => ({ id: item.party_id, name: item.name || '', kind: item.kind || item.role || undefined })).filter((item) => item.id && item.name);
}
/** true / false as the shop said, null when it did not say (SET-49: unknown is not false, nothing is claimed on it); 'unread' when the read failed: the sheet then ASKS the tax kind and says so, so a registered shop's charge is never posted untaxed by a failed read */
async function bkshRegistered() {
  try {
    const answer = (await api('countrySetup')) || {};
    return answer.tax && typeof answer.tax.registered === 'boolean' ? answer.tax.registered : null;
  } catch (failure) {
    bkQuiet('bank-sheet-registration', failure);
    return 'unread';
  }
}
/** the shop's own bank ledger stands in for "bank" on the entry: the statement's own account, never a fixed Bank */
function bkshModeOf(body) {
  const mode = bkbModeOf(bkshBook().accts, bkshBook().stmtAcct || bkshBook().acct),
    swap = (key) => (body[key] === 'bank' ? mode : body[key]);
  if (!mode) return body;
  return Object.assign({}, body, { paid_from: swap('paid_from'), into: swap('into'), from: swap('from'), to: swap('to') });
}
/** the registration answer the preview takes: an unread answer asks each charge its tax kind (true), a said answer stands, unknown stays unknown */
function bkshTaxRegisteredFor(answer) {
  return answer === true || answer === 'unread' ? true : answer;
}
/** who is signed in, as the post adapter reads it: the shop's own login is the owner */
function bkshSignedIn() {
  return { role: bkshIsOwner() ? 'owner' : 'other' };
}
/** the books account the statement is for */
function bkshStatementAccount() {
  const code = String(bkshBook().stmtAcct || bkshBook().acct);
  return (bkshBook().accts || []).filter((item) => String(item.code) === code)[0] || {};
}
/** the entries already posted from bank lines, by ref: { ref → { at, by, entry_no } } (the check names who and when per line) */
function bkshPostedFeed() {
  const feed = {};
  (bankStoreState.posted || []).forEach((row) => {
    feed[row.ref] = { at: row.made_at, by: row.made_by, entry_no: row.entry_no };
  });
  return feed;
}
/** the carried figures the statement check compares: this account, the books' balance before the statement (the ledger read, never summed here), the reconciled statements and the posted feed */
function bkshCheckInput() {
  const acct = bkshStatementAccount(),
    statements = (bankStoreState.statements || []).map((row) => Object.assign({ made_by: row.by, made_at: row.at }, row));
  return {
    today: bkToday(),
    accounts: [{ id: String(acct.code || bkshBook().acct), name: acct.name || null, number: null }],
    saved_account_id: String(acct.code || bkshBook().acct) /* the owner already picked this account for the statement in the Bank view */,
    books: { opening_minor: Number((bkshBook().ledgerRaw || {}).opening_minor) || 0 },
    log: { statements },
    posted: bkshPostedFeed()
  };
}
/** the controller for this statement: the books it reads, the adapter that posts, the pack's country and the rules this device learned */
function bkshController() {
  const country = bkbCountry(),
    signedIn = bkshSignedIn(),
    acct = bkshStatementAccount();
  return CBBankPreview.create({
    engine: bkshEngine(),
    currency: String(bkCur() || '').toUpperCase(),
    account: acct.name || String(bkshBook().acct),
    ledger: bkshLedger,
    post: CBBankPost.adapter({ api, who: signedIn, modeOf: bkshModeOf }),
    lockedMonth: () => null /* a closed month is the server's answer, shown on the line */,
    statementCurrency: () => bkshBook().stmtCur || null,
    checkInput: bkshCheckInput,
    postable: CBBankPost.POSTABLE,
    taxRegistered: bkshTaxRegisteredFor(BKSH.taxRegistered),
    suggestOpts: { country, learned: bkbRules(), parties: bkshParties() },
    parseOpts: { country, currency: bkshBook().stmtCur || undefined, preset: bkshBook().preset || undefined }
  });
}
const bkshEl = (id) => document.getElementById(id);
/** the sheet's own words under the title: the band's ONE truth (bankFigures, cap-bank.js), so the page and the sheet never say two things; nothing here is worked out */
function bkshStrip() {
  const fig = typeof bankFigures === 'function' ? bankFigures() : null;
  if (!fig) return '';
  return txf('Statement {s} · Books {b} · Difference {d}{parts} · Unexplained {u}', {
    s: fig.statement,
    b: fig.books,
    d: fig.gap,
    parts: fig.parts ? ' = ' + fig.parts : '',
    u: fig.unexplained
  });
}
/** paint the sheet again from the controller: the strip, the lines, and the Add button with its count */
function bkshPaint() {
  const model = BKSH.ctl.view(),
    addButton = bkshEl('bks_add'),
    ready = BKSH.ctl.readyCount();
  bkshEl('bks_strip').textContent = bkshStrip();
  if (model.parsed) BKSH.ui.paint(model);
  if (model.refusal) bkshEl('bks_say').textContent = model.refusal;
  if (addButton) {
    addButton.disabled = !ready || BKSH.posting;
    addButton.textContent = ready ? txf('Add {n} to your books', { n: ready }) : tx('Nothing ready to add');
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
    await bankRun(); /* the Bank view reads the books and the rail again and repaints: its band and its counts follow what was posted (B4) */
    BKSH.ctl.answer('ledger_read', Date.now()); /* projects again over the books just read */
    bkshEl('bks_say').textContent = done.failed ? txf('{a} added, {f} not added: each says why on its line.', { a: done.added, f: done.failed }) : txf('{a} added to your books.', { a: done.added });
  } catch (failure) {
    bkQuiet('bank-sheet-add', failure);
    bkshEl('bks_say').textContent = tx('Could not finish adding. Nothing more was sent. Open the Bank view again to see what was added.');
  }
  BKSH.posting = false;
  bkshPaint();
}
/** the one step on a line the sheet cannot finish (a tax payment, a loan, a transfer): the ＋ Entry opens for that line, the sheet stays kept behind it. The entry is pre-filled by bankEntryPreset when the bank-match build provides it; else the date, amount and words of the line */
function bkshEntry(key) {
  const item = ((BKSH.ctl && BKSH.ctl.view().items) || []).filter((one) => one.key === key)[0];
  if (!item) return { ok: false, why: tx('That line is gone') };
  if (typeof enOpen !== 'function') return { ok: false, why: tx('This starts after an update') };
  const line = item.line || {},
    minor = line.debit_minor || line.credit_minor || 0,
    preset =
      typeof bankEntryPreset === 'function'
        ? bankEntryPreset(item, bkshBook())
        : { v: { date: line.date, amount: bkMinorText(minor, bkCur()), narration: 'Bank statement ' + line.date + ': ' + String(line.narration || '').slice(0, 120) }, ref: 'bank:' + ((bkshBook().file && bkshBook().file.hash) || '') + ':' + key };
  closeModal();
  enOpen(preset);
  return { ok: true };
}
/** the sheet closed: the Bank view reads the books again so the lines that were added show as matched */
function bkshClose() {
  closeModal();
  if (typeof bankRun === 'function' && bkshBook().parsed) bankRun().catch((failure) => bkQuiet('bank-sheet-close', failure));
}
/** the statement, the engine and the three scripts the sheet needs are all there */
function bkshReady() {
  const scripts = [typeof CBBankPreview, typeof CBBankPreviewUI, typeof CBBankPost];
  return !!bkshBook().text && !!bkshEngine() && scripts.every((kind) => kind !== 'undefined');
}
/** the sheet's first words under the title: the engine's refusal, or that registration could not be read */
function bkshFirstWords(said, unread) {
  if (!said.ok) return said.why;
  return unread ? tx('Could not check whether the shop is registered for GST, so each charge asks what GST it carries.') : '';
}
/** open the sheet for the statement on screen */
async function bankSheetOpen() {
  if (!bkbBound()) return;
  if (!bkshReady()) return toast(tx('Load the statement file again to add its lines.'));
  BKSH.taxRegistered = await bkshRegistered();
  const unread = BKSH.taxRegistered === 'unread',
    kept = !!BKSH.ctl && BKSH.key === bkshKey();
  if (!kept) {
    BKSH.ctl = bkshController();
    BKSH.key = bkshKey();
  }
  ui.dialog({
    mount: 'BKS014-U03', pop: 'POP092', titleTestid: 'bank-sheet-title',
    titleText: tx('Add to your books'), wide: true,
    bodyStyle: 'display:flex;flex-direction:column;gap:8px',
    body: '<div class="pe-note" id="bks_strip" data-testid="bank-sheet-strip" aria-live="polite"></div><div class="pe-bad" id="bks_say" data-testid="bank-sheet-say" role="status"></div><div id="bks_lines" class="bks-lines" data-testid="bank-sheet-lines"></div>',
    footerHtml: '<span class="bks-keep" data-testid="bank-sheet-kept">' + bkbE(tx('Your answers are kept if you close this. They clear when you load another statement.')) + '</span><button data-cbsid="BKS014-B17" type="button" data-testid="bank-sheet-close" onclick="bkshClose()">' + bkbE(tx('Close')) + '</button>' +
      '<button data-cbsid="BKS014-B16" id="bks_add" type="button" class="pri" data-testid="bank-sheet-add" disabled onclick="bkshAdd(this)">' + bkbE(tx('Nothing ready to add')) + '</button>'
  });
  BKSH.ui = CBBankPreviewUI.mount({
    host: bkshEl('bks_lines'), controller: () => BKSH.ctl, currency: String(bkCur() || '').toUpperCase(), country: bkbCountry(), entry: bkshEntry, amountText: (value) => bkMoney(CBBankPreview.minorOf(value), (value && value.currency) || undefined), addedWords: tx('Added to your books'),
    say: (words) => { bkshEl('bks_say').textContent = words || ''; }, changed: bkshPaint
  });
  if (kept) BKSH.ctl.answer('ledger_read', Date.now()); /* the books may have moved since: project again, keep every answer */
  else bkshEl('bks_say').textContent = bkshFirstWords(BKSH.ctl.load(bkshBook().text, bkshBook().file && bkshBook().file.name), unread);
  bkshPaint();
}
