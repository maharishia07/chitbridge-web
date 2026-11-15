/* cap-bank-statements.js — the STATEMENTS BOX of the Bank view (l16, W15-51; api: POST/GET /api/books/bank/statement-files, b872).
 * OWNS      bankStmtMount (the box on the Bank page) · the account × month grid with its gaps ("Oct missing") · Add statement (account + file, the period from the reader) · Read (a kept file into the ONE reader) · Download.
 * CALLED BY cap-bank.js (bankView draws #bk_stmts and calls bankStmtMount(banks)); loaded after cap-bank-store.js by public/accounts.html. The owner and the acting adviser see the same box (the server decides who may add).
 * FLOW      bankStmtMount → GET /bank/statement-files (the page's own bank list names the accounts) → grid + files · Add → the reader's own period and currency → POST (the sha256 of the UTF-8 text, bkbHash: the ONE hash) · Read → GET …/file?use=read → bankTake(text, name, false)
 * ⭐ NO SECOND PARSER AND NO MONEY: the period is what CBBankRecon.parse already returned (bankStmtPeriod); Read hands the text to bankTake, which parses, hashes, projects and posts as it always did. A file with no period is refused, never guessed.
 * ⭐ EVERY FILE IS FILED AGAINST AN ACCOUNT AND A PERIOD (Athi, 15 Nov): the account is required; "Oct missing" is a cell of the grid, with a shortcut that picks that account.
 * ⭐ THE WORDS: "Kept on our server for the record period; visible to the adviser or auditor you give access." is the box's own line (cb-compliance owns the final text). The plain picker above keeps its own, still-true device-only sentence.
 * IDS       BKS014-B45 (Just read a file, do not keep it) · BKS014-B41 (Show/Hide the box) · BKS014-I12 (the account label) · BKS014-I13 (the statement file) · BKS014-B42 (Read) · BKS014-B43 (Download) · BKS014-B44 (a missing month: add for it); the account select and Add button are the page's library builders (peSel BKS016-S01, peBtn BKS016-B02).
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 */
'use strict';
if (typeof EP !== 'undefined') {
  Object.assign(EP, {
    booksStmtList: { m: 'GET', p: '/api/books/bank/statement-files' },
    booksStmtAdd: { m: 'POST', p: '/api/books/bank/statement-files' }
  });
}
const BKST = { banks: [], data: null, open: null, mode: 'idle', pickAcct: '', busy: false };
const BKST_MONTHS = 6;
const bkstE = (text) => (typeof bkbE === 'function' ? bkbE(text) : String(text));
const bkstEl = (id) => document.getElementById(id);
/** 'Oct' for '2026-10', in the reader's own language (a date helper, no money) */
function bkstMonth(month) {
  try {
    return new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)).toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' });
  } catch (_) {
    return month.slice(5);
  }
}
/** the bank ledgers the page lists (bkbBanks: the ONE list), each { code, name } */
const bkstBanks = () => BKST.banks.map((item) => ({ code: String(item.code), name: item.name }));
/** the account of a row of the answer, as the page names it: its name and the owner's label (..1234) */
const bkstAccountName = (account) => (account.name || tx('Bank account')) + (account.label ? ' ' + account.label : '');
const bkstAccountOf = (id) => ((BKST.data && BKST.data.accounts) || []).filter((item) => item.account_id === id)[0] || {};

/* ── the box ── */
/** draw the box into #bk_stmts and read the list; `banks` is bkbBanks(accts) (the Bank page's own list) */
function bankStmtMount(banks) {
  BKST.banks = banks || [];
  BKST.pickAcct = BKST.pickAcct || (BKST.banks[0] ? String(BKST.banks[0].code) : '');
  const host = bkstEl('bk_stmts');
  if (!host) return;
  host.innerHTML = '<div class="bks-bar"><b>' + bkstE(tx('Statements')) + '</b><span class="bks-sum" data-testid="bank-stmts-sum">' + bkstE(tx('Reading what is kept')) + '</span></div>';
  bankStmtLoad().catch((failure) => typeof bkQuiet === 'function' && bkQuiet('bank-stmts', failure));
}
async function bankStmtLoad() {
  if (!bkstEl('bk_stmts')) return;
  try {
    const answer = await api('booksStmtList', { query: { accounts: bkstBanks().map((item) => item.code).join(','), months: BKST_MONTHS }, fresh: true });
    if (!answer || !Array.isArray(answer.cells) || !Array.isArray(answer.accounts) || !Array.isArray(answer.files)) throw new Error('the statements answer is not the statements box answer');
    BKST.data = answer;
    BKST.mode = 'server';
  } catch (failure) {
    BKST.data = null;
    BKST.mode = failure && failure.status === 503 ? 'device' : 'error';
  }
  bankStmtPaint();
}
const bkstMissing = (data) => (data ? data.cells.filter((cell) => cell.missing).length : 0);
/** one line: what the box holds, said as the gap the person should fix */
function bkstSummary() {
  if (BKST.mode === 'device') return tx('Starts after an update. Your statement is still read on this device.');
  if (BKST.mode === 'error') return tx('Could not read the statements kept.');
  const data = BKST.data;
  if (!data || !data.files.length) return data && data.older ? txf('{n} older statements kept', { n: data.older }) : tx('Nothing kept yet');
  const gaps = bkstMissing(data),
    last = data.files.map((file) => String(file.period_to || '').slice(0, 7)).filter(Boolean).sort().pop(),
    kept = last ? bkstMonth(last) + ' ✓ · ' : '';
  return kept + (gaps ? txf('{n} months missing', { n: gaps }) : tx('Every month is kept'));
}
function bankStmtPaint() {
  const host = bkstEl('bk_stmts');
  if (!host) return;
  const open = BKST.open === null ? !(typeof BKB !== 'undefined' && BKB.rows && BKB.rows.length) : BKST.open; /* open on a bare page; folded while a statement is on screen */
  const ready = BKST.mode === 'server';
  bkstOneDoor(ready);
  host.innerHTML =
    '<div class="bks-bar"><b>' + bkstE(tx('Statements')) + '</b><span class="bks-sum" data-testid="bank-stmts-sum">' + bkstE(bkstSummary()) + '</span>' +
    (ready ? '<button data-cbsid="BKS014-B41" type="button" class="bks-tog" data-testid="bank-stmts-toggle" onclick="bankStmtToggle()" aria-expanded="' + open + '">' + bkstE(open ? tx('Hide') : tx('Add statement') + ' ▾') + '</button>' : '') +
    '</div>' +
    (ready && open ? bkstAddHtml() + bkstGridHtml() + bkstFilesHtml() + bkstJustReadHtml() + '<div class="pe-note" data-testid="bank-stmts-kept">' + bkstE(tx('Kept on our server for the record period; visible to the adviser or auditor you give access.')) + '</div>' : '');
}
/** W15-62: while the box is the door, the plain picker's file field and its sentence step aside (one "Add statement" door); the file input stays for "Just read a file", the quiet choice inside the box. Box not ready (503, error): the picker is the only door and stays. */
function bkstOneDoor(ready) {
  const field = bkstEl('bk_file') && bkstEl('bk_file').closest('label'),
    note = document.querySelector('[data-testid="bank-private"]');
  if (field) field.style.display = ready ? 'none' : '';
  if (note) note.style.display = ready ? 'none' : '';
}
/** the quiet secondary: read a file for this visit, keep nothing on our server (the device keeps the latest, as the picker always did) */
function bkstJustReadHtml() {
  return (
    '<div class="bks-just" data-testid="bank-stmts-justread"><button data-cbsid="BKS014-B45" type="button" class="bks-link" id="bks_just" data-testid="bank-stmts-justread-go" onclick="bankStmtJustRead()">' + bkstE(tx("Just read a file, don't keep it")) + '</button> ' +
    '<span class="bks-sum">' + bkstE(tx('Read on this device only. Not sent to our server; this device keeps the latest one.')) + '</span></div>'
  );
}
/** opens the plain picker's file input (bankPick reads it: the ONE reader) */
function bankStmtJustRead() {
  const input = bkstEl('bk_file');
  if (input) input.click();
}
function bankStmtToggle() {
  const open = BKST.open === null ? !(BKB.rows && BKB.rows.length) : BKST.open;
  BKST.open = !open;
  bankStmtPaint();
}

/* ── Add statement ── */
function bkstAddHtml() {
  const banks = bkstBanks();
  return (
    '<div class="bks-add" data-testid="bank-stmts-add">' +
    peField('bks_acct', 'Bank account', peSel('bks_acct', banks.map((item) => [item.code, item.name]), BKST.pickAcct, ' onchange="BKST.pickAcct=this.value"')) +
    peField('bks_label', 'Label, such as ..1234', '<input data-cbsid="BKS014-I12" class="inp" id="bks_label" data-testid="bank-stmts-label" maxlength="40" autocomplete="off" value="' + bkstE(bkstLabelOf(BKST.pickAcct)) + '">') +
    peField('bks_file', 'Statement file (CSV or JSON)', '<input data-cbsid="BKS014-I13" class="inp" type="file" id="bks_file" data-testid="bank-stmts-file" accept=".csv,.json,.txt,text/csv,application/json">') +
    peBtn('bank-stmts-add-go', 'Add statement', 'bankStmtAdd()') +
    '</div><div id="bks_out" class="pe-slot" data-testid="bank-stmts-out"></div>'
  );
}
/** the label already kept for the account (the owner typed it once), else empty: never guessed */
function bkstLabelOf(code) {
  const bank = ((BKST.data && BKST.data.accounts) || []).filter((item) => String(item.code) === String(code))[0];
  return (bank && bank.label) || '';
}
/** the statement's period as the reader found it (CBBankRecon.parse's from and to, else the dates of its own lines, as bankTake takes them); null when there is none */
function bkstPeriod(parsed) {
  const dates = (parsed.lines || []).map((item) => item.date).filter(Boolean).sort();
  const from = parsed.from || dates[0],
    to = parsed.to || dates[dates.length - 1];
  return from && to ? { from: String(from).slice(0, 10), to: String(to).slice(0, 10) } : null;
}
/** the currency of the ledger picked: what the file says, else what the ledger or the shop has on record; '' asks the person, nothing is assumed */
function bkstCurrency(parsed, code) {
  const ledger = (BKB.accts || []).filter((item) => String(item.code) === String(code))[0] || {};
  return String(parsed.currency || ledger.currency || bkCur() || '').toUpperCase();
}
async function bankStmtAdd() {
  if (BKST.busy) return;
  const out = 'bks_out',
    code = String((bkstEl('bks_acct') || {}).value || ''),
    file = (bkstEl('bks_file') || {}).files && bkstEl('bks_file').files[0];
  if (!code) return peBad(out, tx('Pick which bank account this statement is for.'));
  if (!file) return peBad(out, tx('Pick the statement file first.'));
  if (bkbNoCountryWords()) return peBad(out, bkbNoCountryWords());
  let text;
  try {
    text = await file.text();
  } catch (_) {
    return peBad(out, tx('That file could not be read.'));
  }
  const parsed = CBBankRecon.parse(text, { format: 'auto', preset: BKB.preset || undefined, country: bkbCountry() }); /* the ONE reader: its period and currency, nothing parsed here */
  if (!parsed || !parsed.ok) return peBad(out, (parsed && parsed.why) || tx('That file could not be read as a bank statement.'));
  const period = bkstPeriod(parsed);
  if (!period) return peBad(out, tx('We could not tell which dates this statement covers, so it cannot be kept. Check it is a bank statement.'));
  const currency = bkstCurrency(parsed, code);
  if (!currency) return peBad(out, tx('Which currency is this statement in? Nothing is assumed.'));
  const hash = await bkbHash(text);
  if (!/^[0-9a-f]{64}$/.test(hash)) return peBad(out, tx('This page cannot fingerprint the file here. Open ChitBridge over its secure address to keep statements.'));
  BKST.busy = true;
  try {
    const kept = await api('booksStmtAdd', { body: { account: code, label: String((bkstEl('bks_label') || {}).value || '').trim() || undefined, period_from: period.from, period_to: period.to, currency, sha256: hash, name: file.name, text } });
    BKST.pickAcct = code;
    await bankStmtLoad();
    const slot = bkstEl(out);
    if (slot) slot.innerHTML = '<div class="pe-' + (kept && kept.overlaps && kept.overlaps.length ? 'warn' : 'ok') + '" data-testid="bank-stmts-kept-say" role="status">' + bkstE((kept && kept.words) || tx('Kept.')) + '</div>';
  } catch (failure) {
    peBad(out, failure, tx('The statement could not be kept'));
  } finally {
    BKST.busy = false;
  }
}

/* ── the grid: account × month ── */
function bkstGridHtml() {
  const data = BKST.data;
  if (!data || !data.accounts.length) return '';
  const cellOf = (account, month) => data.cells.filter((item) => item.account_id === account.account_id && item.month === month)[0];
  const fileOf = (id) => data.files.filter((item) => item.id === id)[0] || {};
  const head = '<tr><th scope="col">' + bkstE(tx('Account')) + '</th>' + data.months.map((month) => '<th scope="col">' + bkstE(bkstMonth(month)) + '</th>').join('') + '</tr>';
  const rows = data.accounts
    .map((account) => {
      const cells = data.months
        .map((month) => {
          const cell = cellOf(account, month) || { missing: true, file_ids: [] };
          if (cell.missing)
            return (
              '<td class="bks-gap"><button data-cbsid="BKS014-B44" type="button" class="bks-miss" data-testid="bank-stmts-miss-' + bkstE(account.account_id) + '-' + bkstE(month) + '" data-acct="' + bkstE(account.code || '') + '" onclick="bankStmtPickGap(this)" title="' + bkstE(tx('Add a statement for this account')) + '">' + bkstE(txf('{month} missing', { month: bkstMonth(month) })) + '</button></td>'
            );
          const crossed = cell.file_ids.some((id) => fileOf(id).overlaps);
          return '<td class="bks-have" data-testid="bank-stmts-have-' + bkstE(account.account_id) + '-' + bkstE(month) + '"><span aria-hidden="true">✓</span> ' + bkstE(String(cell.file_ids.length)) + (crossed ? ' <span class="bks-flag">' + bkstE(tx('overlap')) + '</span>' : '') + '</td>';
        })
        .join('');
      return '<tr><th scope="row">' + bkstE(bkstAccountName(account)) + '</th>' + cells + '</tr>';
    })
    .join('');
  return '<div class="bks-wrap"><table class="bks-grid" data-testid="bank-stmts-grid"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>';
}
/** a missing month pressed: that account is picked in the form and the file picker is the next thing */
function bankStmtPickGap(button) {
  BKST.pickAcct = String(button.getAttribute('data-acct') || BKST.pickAcct);
  const select = bkstEl('bks_acct');
  if (select) select.value = BKST.pickAcct;
  const label = bkstEl('bks_label');
  if (label) label.value = bkstLabelOf(BKST.pickAcct);
  const file = bkstEl('bks_file');
  if (file) file.focus();
}

/* ── the files: Read and Download ── */
function bkstFilesHtml() {
  const data = BKST.data;
  if (!data || !data.files.length) return '';
  const by = (file) => (file.by_name ? file.by_name + (file.by_firm ? ', ' + file.by_firm : '') : '—');
  const rows = data.files
    .slice()
    .sort((first, second) => String(second.period_from).localeCompare(String(first.period_from)))
    .map(
      (file) =>
        '<tr data-testid="bank-stmts-file-' + bkstE(file.id) + '"><td>' + bkstE(bkstAccountName(bkstAccountOf(file.account_id))) + '</td><td>' + bkstE(bkDate(file.period_from)) + ' – ' + bkstE(bkDate(file.period_to)) + (file.overlaps ? ' <span class="bks-flag">' + bkstE(tx('overlap')) + '</span>' : '') + '</td><td class="bks-name">' + bkstE(file.name) + '</td><td>' + bkstE(by(file)) + '</td><td class="bks-acts">' +
        '<button data-cbsid="BKS014-B42" type="button" class="bks-btn" data-testid="bank-stmts-read" data-file="' + bkstE(file.id) + '" onclick="bankStmtRead(this)">' + bkstE(tx('Read')) + '</button>' +
        '<button data-cbsid="BKS014-B43" type="button" class="bks-btn" data-testid="bank-stmts-download" data-file="' + bkstE(file.id) + '" onclick="bankStmtDownload(this)">' + bkstE(tx('Download')) + '</button></td></tr>'
    )
    .join('');
  return '<div class="bks-wrap"><table class="bks-files" data-testid="bank-stmts-files"><thead><tr><th scope="col">' + bkstE(tx('Account')) + '</th><th scope="col">' + bkstE(tx('Period')) + '</th><th scope="col">' + bkstE(tx('File')) + '</th><th scope="col">' + bkstE(tx('Added by')) + '</th><th scope="col"></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}
/** the kept file's bytes through the seat's own headers (the adviser's X-Books-For rides in CBBooksActing), never cached */
function bkstFetch(id, use) {
  return fetch(CFG.API_BASE + '/api/books/bank/statement-files/' + encodeURIComponent(id) + '/file?use=' + use, {
    cache: 'no-store',
    headers: Object.assign({ Authorization: 'Bearer ' + SESSION.token }, typeof CBBooksActing !== 'undefined' ? CBBooksActing.headers() : {})
  });
}
const bkstWhyNot = (res) => (res.status === 403 ? tx('This access has ended.') : res.status === 404 ? tx('That statement is no longer here.') : tx('The statement could not be opened. Nothing was lost; try again in a minute.'));
/** Read: the kept text goes to the page's ONE reader (bankTake), for the account it was kept against; nothing is parsed or hashed here */
async function bankStmtRead(button) {
  const id = button.getAttribute('data-file'),
    file = ((BKST.data && BKST.data.files) || []).filter((item) => item.id === id)[0],
    code = file ? bkstAccountOf(file.account_id).code : null;
  if (!file || !code) return peBad('bks_out', tx('That statement is no longer here.'));
  let res;
  try {
    res = await bkstFetch(id, 'read');
  } catch (_) {
    return peBad('bks_out', tx('The statement could not be opened. Nothing was lost; try again in a minute.'));
  }
  if (!res.ok) return peBad('bks_out', bkstWhyNot(res));
  const text = await res.text();
  const select = bkbEl('bk_acct');
  if (select) select.value = String(code);
  bankAcctPick(String(code), true); /* the account the file was kept against; the screen is cleared, the device copy is not loaded over it */
  BKST.open = false;
  bankStmtPaint();
  const out = bkbEl('bk_out');
  if (out) out.innerHTML = '';
  return bankTake(text, file.name, false);
}
/** Download: the file as kept, to the device */
async function bankStmtDownload(button) {
  const id = button.getAttribute('data-file'),
    file = ((BKST.data && BKST.data.files) || []).filter((item) => item.id === id)[0];
  let res;
  try {
    res = await bkstFetch(id, 'download');
  } catch (_) {
    return peBad('bks_out', tx('The statement could not be opened. Nothing was lost; try again in a minute.'));
  }
  if (!res.ok) return peBad('bks_out', bkstWhyNot(res));
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = (file && file.name) || 'statement';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
