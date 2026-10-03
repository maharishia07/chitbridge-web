/* ADOPTED from chitbridge-engines v1.18.0 · bank-recon · sha256 fdbf6190577fa7b8473ac4e07f4da01762808191229f379a3861ab35cca281d3 — DO NOT EDIT HERE. Change it in chitbridge-engines, release a version, then run tools/adopt.cjs. */
/* chitbridge-engines · bank-recon. Edited ONLY in chitbridge-engines/src/bank-recon.js; every platform adopts a released version of it. */
(function (root) {
'use strict';
// @stage tested
// @stage-note A bank statement (CSV / JSON) read, matched to the Ledger's bank lines, the missing entries SUGGESTED, the BRS. Pure — no I/O, no clock.
/**
 * bank-recon.js — BANK RECONCILIATION: READ THE STATEMENT, MATCH IT, SUGGEST WHAT THE BOOKS MISS, STATE THE DIFFERENCE. v1.18.0.
 *
 * Athi, 2026-10-03: *"can u build bank stt reconciliation by reading the csv / json file and add any transaction which is missing?"*
 * Standing rules carried here: (1) PROPOSE, NEVER AUTO-APPLY — suggest() hands back an event a person confirms (an owner-made entry,
 * series MJ); nothing here posts. (2) THE BOOKS ARE INSERT-ONLY — a match is a separate record (statement line ↔ ledger line ids);
 * no journal line is edited. (3) COMPUTE ONCE — amounts are read as written, in PAISE (integers), never re-derived; a suggestion's
 * entry is composed by posting.post (the existing events, no new posting rule), so Dr = Cr to the paisa by that engine's own check.
 *
 *   parse(text, { format?, preset?, mapping?, bank? })  → { ok, account?, from?, to?, opening_minor?, closing_minor?, lines, warnings }
 *   match(stmtLines, ledgerLines, { window_days? })      → { matched, unmatched_stmt, unmatched_ledger, ambiguous }
 *   suggest(stmtLine, { parties?, receipts?, rules?, bank? }) → { event, confidence, why, … }   a PROPOSAL
 *   brs({ asOf, bookBalance_minor, bankBalance_minor, unmatched_ledger, unmatched_stmt })     → the Bank Reconciliation Statement
 *
 * ── THE SHAPES ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *   statement line  { date 'YYYY-MM-DD', value_date?, narration, ref?, cheque_no?, debit_minor, credit_minor, balance_minor? }
 *                   debit = money OUT of the bank, credit = money IN (the bank's own words). balance_minor is signed: a credit balance
 *                   is positive, an overdrawn (Dr) one negative.
 *   ledger line     { id, date, dr_minor, cr_minor, ref?, narration, entry_no, party? } — a journal line of the BANK account.
 *                   Bank Dr (money in) pairs with a statement credit; bank Cr (money out) with a statement debit.
 *
 * ── parse: CSV ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *   delimiter (, ; tab |) and the header row are detected (the first row naming a date column and a narration or amount column);
 *   rows above it are a preamble (an "Account No" line there is read as `account`). Amounts: Indian grouping "1,23,456.78", a
 *   ₹ / Rs / INR prefix, "Dr" / "Cr" suffix, (brackets) or a minus for a debit in a single Amount column, separate Debit and Credit
 *   columns, or an Amount column with a Dr/Cr column. A single signed Amount column reads negative as debit. Dates: dd/mm/yyyy,
 *   dd-mm-yy, dd-MMM-yyyy, dd MMM yyyy, yyyy-mm-dd (and an ISO time after it). A statement listed newest-first is turned round (warned).
 *   PRESETS (data, below): sbi · hdfc · icici · axis · kotak — each names its header cells. ⚠️ They are written from the shape of each
 *   bank's usual export and are all marked verify:true — check against a real file before trusting one; a bank changes its headers.
 *   `mapping` { field: 'Header text' | columnIndex } for any other bank; fields: date value_date narration ref cheque_no debit credit
 *   amount drcr balance. With no preset and no mapping the generic header words are tried.
 *   RUNNING BALANCE: when balance_minor is present each line must follow the one before (prev + credit − debit); a break is a
 *   WARNING naming the line number; the check carries on from the stated balance.
 * ── parse: JSON ────────────────────────────────────────────────────────────────────────────────────────────────────
 *   (1) an array of statement lines as above — *_minor integers are read as given; `debit` / `credit` / `amount` (rupees, string or
 *       number) are read exactly to the paisa. (2) { account?, opening_minor?, closing_minor?, lines | transactions: [ … ] }.
 *   (3) Account Aggregator FI data — the ReBIT deposit-account schema: Account.Transactions.Transaction[] of { type CREDIT | DEBIT,
 *       mode, amount "1234.56", currentBalance, transactionTimestamp, valueDate, txnId, narration, reference }, with
 *       Account.Summary.currentBalance and Account.Transactions.startDate / endDate. Found wherever it sits in the document.
 *       ⚠️ Written from the published ReBIT FI-schema field names; check against the schema version a real AA response carries.
 */

var T_ = null, P_ = null;
function dep_(file, g) {
  var G = (typeof globalThis !== 'undefined' ? globalThis : root);
  if (G[g] && typeof G[g] === 'object' && Object.keys(G[g]).length) return G[g];
  if (typeof require === 'function') { try { return require(file); } catch (_) { return null; } }
  return null;
}
function posting_() { return P_ || (P_ = dep_('./posting', 'CBPosting')); }
function fail_(why) { return { ok: false, why: why, lines: [], warnings: [] }; }

/* ═══ PRESETS — DATA, NOT CODE PATHS ═══════════════════════════════════════════════════════════════════════════════
 * field → the header cell(s) the bank prints (compared with case, spaces and punctuation ignored). verify:true = not yet checked
 * against a real file of that bank. */
var PRESETS = {
  sbi:   { bank: 'State Bank of India', verify: true, note: 'Txn Date · Value Date · Description · Ref No./Cheque No. · Debit · Credit · Balance',
           map: { date: ['Txn Date'], value_date: ['Value Date'], narration: ['Description'], ref: ['Ref No./Cheque No.', 'Ref No'], debit: ['Debit'], credit: ['Credit'], balance: ['Balance'] } },
  hdfc:  { bank: 'HDFC Bank', verify: true, note: 'Date · Narration · Chq./Ref.No. · Value Dt · Withdrawal Amt. · Deposit Amt. · Closing Balance',
           map: { date: ['Date'], narration: ['Narration'], ref: ['Chq./Ref.No.', 'Chq/Ref No'], value_date: ['Value Dt'], debit: ['Withdrawal Amt.'], credit: ['Deposit Amt.'], balance: ['Closing Balance'] } },
  icici: { bank: 'ICICI Bank', verify: true, note: 'S No. · Value Date · Transaction Date · Cheque Number · Transaction Remarks · Withdrawal Amount (INR ) · Deposit Amount (INR ) · Balance (INR )',
           map: { date: ['Transaction Date'], value_date: ['Value Date'], cheque_no: ['Cheque Number'], narration: ['Transaction Remarks'], debit: ['Withdrawal Amount (INR )'], credit: ['Deposit Amount (INR )'], balance: ['Balance (INR )'] } },
  axis:  { bank: 'Axis Bank', verify: true, note: 'SRL NO · Tran Date · CHQNO · PARTICULARS · DR · CR · BAL · SOL',
           map: { date: ['Tran Date'], cheque_no: ['CHQNO'], narration: ['PARTICULARS'], debit: ['DR'], credit: ['CR'], balance: ['BAL'] } },
  kotak: { bank: 'Kotak Mahindra Bank', verify: true, note: 'Sl. No. · Transaction Date · Value Date · Description · Chq / Ref No. · Debit · Credit · Dr / Cr · Balance (balance carries a Dr / Cr marker)',
           map: { date: ['Transaction Date'], value_date: ['Value Date'], narration: ['Description'], ref: ['Chq / Ref No.', 'Chq/Ref No'], debit: ['Debit'], credit: ['Credit'], balance: ['Balance'] } },
};
/** the header words tried when no preset or mapping is given */
var GENERIC = {
  date: ['Date', 'Txn Date', 'Transaction Date', 'Tran Date', 'Posting Date'], value_date: ['Value Date', 'Value Dt'],
  narration: ['Narration', 'Description', 'Particulars', 'Transaction Remarks', 'Remarks', 'Details'],
  ref: ['Ref No', 'Ref No.', 'Reference', 'Chq./Ref.No.', 'Chq / Ref No', 'UTR', 'Transaction Id'], cheque_no: ['Cheque No', 'Cheque Number', 'Chq No', 'CHQNO', 'Instrument No'],
  debit: ['Debit', 'Withdrawal', 'Withdrawal Amt.', 'Withdrawals', 'DR', 'Debit Amount'], credit: ['Credit', 'Deposit', 'Deposit Amt.', 'Deposits', 'CR', 'Credit Amount'],
  amount: ['Amount', 'Transaction Amount'], drcr: ['Dr/Cr', 'Dr / Cr', 'Type', 'Cr/Dr'], balance: ['Balance', 'Closing Balance', 'Running Balance', 'BAL'],
};
var FIELDS = ['date', 'value_date', 'narration', 'ref', 'cheque_no', 'debit', 'credit', 'amount', 'drcr', 'balance'];

/* ═══ small readers ═══════════════════════════════════════════════════════════════════════════════════════════════ */
var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
var norm_ = function (s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); };
var pad_ = function (n) { return (n < 10 ? '0' : '') + n; };
function ymd_(y, m, d) {
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  var dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;                                  /* 31 Feb */
  return y + '-' + pad_(m) + '-' + pad_(d);
}
/** a date in any of the common statement forms → 'YYYY-MM-DD', or null */
function dateOf_(s) {
  s = String(s == null ? '' : s).trim(); var m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s))) return ymd_(+m[1], +m[2], +m[3]);
  if ((m = /^(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{2}|\d{4})$/.exec(s))) return ymd_(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  if ((m = /^(\d{1,2})[\/\-. ]([A-Za-z]{3})[A-Za-z]*[\/\-. ,]*(\d{2}|\d{4})$/.exec(s))) { var mo = MONTHS[m[2].toLowerCase()]; return mo ? ymd_(m[3].length === 2 ? 2000 + +m[3] : +m[3], mo, +m[1]) : null; }
  return null;
}
/** an amount as printed → { minor (≥0), side 'dr'|'cr'|null, neg } — read from the digits, never through a float; null when it is not an amount */
function amountOf_(raw) {
  if (typeof raw === 'number') raw = isFinite(raw) ? String(raw) : '';
  var s = String(raw == null ? '' : raw).trim(); if (!s) return { minor: 0, side: null, neg: false, empty: true };
  var side = null, neg = false, m;
  if ((m = /^\((.*)\)$/.exec(s))) { neg = true; s = m[1]; }
  if ((m = /^(.*?)\s*(Dr|Cr|D|C)\.?$/i.exec(s))) { side = m[2].toLowerCase()[0] === 'd' ? 'dr' : 'cr'; s = m[1]; }
  if ((m = /^(Dr|Cr)\.?\s*(.*)$/i.exec(s))) { side = m[1].toLowerCase() === 'dr' ? 'dr' : 'cr'; s = m[2]; }
  s = s.replace(/^(₹|rs\.?|inr)\s*/i, '').replace(/\s/g, '');
  if (s[0] === '-') { neg = true; s = s.slice(1); } else if (s[0] === '+') s = s.slice(1);
  s = s.replace(/,/g, '');
  if (!/^\d*\.?\d*$/.test(s) || !/\d/.test(s)) return null;
  var parts = s.split('.'), whole = parts[0] || '0', frac = (parts[1] || '').padEnd(2, '0');
  if (frac.length > 2) { if (/[1-9]/.test(frac.slice(2))) return null; frac = frac.slice(0, 2); }   /* a third decimal that is not zero is not paise */
  var minor = parseInt(whole, 10) * 100 + parseInt(frac, 10);
  if (!isFinite(minor) || minor > Number.MAX_SAFE_INTEGER) return null;
  return { minor: minor, side: side, neg: neg, empty: false };
}

/* ═══ CSV ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
function csvRows_(text, delim) {
  var rows = [], row = [], cell = '', q = false, i = 0, n = text.length, c;
  for (; i < n; i++) {
    c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"' && cell === '') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; rows.push(row); row = []; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ''; }); });
}
function delimiterOf_(text) {
  var best = ',', top = 0, sample = text.split(/\r?\n/).slice(0, 25).join('\n');
  [',', ';', '\t', '|'].forEach(function (d) { var k = sample.split(d).length - 1; if (k > top) { top = k; best = d; } });
  return best;
}
/** header-cell → column index for each field, from a preset / mapping / the generic words. A preset or mapping that names a header the row lacks is simply not found. */
function columnsFor_(head, spec) {
  var h = head.map(norm_), cols = {};
  FIELDS.forEach(function (f) {
    var want = spec[f]; if (want == null) return;
    var list = Array.isArray(want) ? want : [want];
    for (var k = 0; k < list.length; k++) {
      if (typeof list[k] === 'number') { if (list[k] >= 0 && list[k] < head.length) { cols[f] = list[k]; return; } continue; }
      var w = norm_(list[k]), at = h.indexOf(w); if (at >= 0) { cols[f] = at; return; }
    }
  });
  return cols;
}
function isHeader_(row, spec) { var c = columnsFor_(row, spec); return c.date != null && (c.narration != null || c.amount != null || c.debit != null || c.credit != null); }

function parseCsv_(text, o) {
  var warnings = [], lines = [], preset = o.preset ? PRESETS[String(o.preset).toLowerCase()] : null;
  if (o.preset && !preset) return fail_('Unknown bank preset "' + o.preset + '" — presets: ' + Object.keys(PRESETS).join(', ') + '; or pass a mapping.');
  var spec = o.mapping || (preset ? preset.map : GENERIC);
  var rows = csvRows_(text.replace(/^﻿/, ''), delimiterOf_(text));
  var hi = -1, cols, headerless = !!o.mapping && o.header === false;
  if (headerless) { hi = -1; cols = columnsFor_([], {}); FIELDS.forEach(function (f) { if (typeof spec[f] === 'number') cols[f] = spec[f]; }); }
  else {
    for (var i = 0; i < rows.length; i++) if (isHeader_(rows[i], spec)) { hi = i; break; }
    if (hi < 0) return fail_('No header row found' + (preset ? ' for the ' + preset.bank + ' preset (' + preset.note + ')' : '') + ' — pass a preset or a mapping naming the columns.');
    cols = columnsFor_(rows[hi], spec);
  }
  if (cols.date == null) return fail_('The mapping names no date column.');
  if (cols.amount == null && cols.debit == null && cols.credit == null) return fail_('The mapping names no amount, debit or credit column.');
  if (preset && preset.verify) warnings.push('preset ' + o.preset + ' is marked "verify against a real file" — headers: ' + preset.note);
  var account = o.account || null, pre = rows.slice(0, Math.max(hi, 0));
  pre.forEach(function (r) { var m = /account\s*(?:no|number|#)?\.?\s*[:\-]?\s*([A-Za-z0-9*Xx]{6,})/i.exec(r.join(' ')); if (!account && m) account = m[1]; });
  var get = function (r, f) { return cols[f] == null ? '' : String(r[cols[f]] == null ? '' : r[cols[f]]).trim(); };
  for (var r = hi + 1; r < rows.length; r++) {
    var row = rows[r], no = r + 1, dtxt = get(row, 'date');
    if (!dtxt && !get(row, 'narration')) continue;
    var date = dateOf_(dtxt);
    if (!date) { if (/^(total|opening|closing|statement|page|\*)/i.test(dtxt) || !dtxt) continue; warnings.push('row ' + no + ': unreadable date "' + dtxt + '" — row skipped'); continue; }
    var debit = 0, credit = 0, bad = false;
    if (cols.debit != null || cols.credit != null) {
      var d = amountOf_(get(row, 'debit')), c = amountOf_(get(row, 'credit'));
      if (!d || !c) bad = true; else { debit = d.minor; credit = c.minor; }
    } else {
      var a = amountOf_(get(row, 'amount')), mark = get(row, 'drcr');
      if (!a || a.empty) bad = true;
      else {
        var side = mark ? (/^d/i.test(mark) ? 'dr' : /^c/i.test(mark) ? 'cr' : null) : (a.side || (a.neg ? 'dr' : 'cr'));
        if (!side) bad = true; else if (side === 'dr') debit = a.minor; else credit = a.minor;
      }
    }
    if (bad) { warnings.push('row ' + no + ': unreadable amount — row skipped'); continue; }
    var line = { date: date, narration: get(row, 'narration'), debit_minor: debit, credit_minor: credit };
    var vd = cols.value_date != null ? dateOf_(get(row, 'value_date')) : null; if (vd) line.value_date = vd;
    var ref = get(row, 'ref'), chq = get(row, 'cheque_no'); if (ref) line.ref = ref; if (chq) line.cheque_no = chq;
    if (cols.balance != null && get(row, 'balance') !== '') {
      var b = amountOf_(get(row, 'balance'));
      if (b && !b.empty) line.balance_minor = (b.neg || b.side === 'dr') ? -b.minor : b.minor; else warnings.push('row ' + no + ': unreadable balance — ignored');
    }
    line.row = no;
    lines.push(line);
  }
  return { ok: true, account: account, lines: lines, warnings: warnings };
}

/* ═══ JSON ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
function minorOf_(obj, minorKey, rupeeKey) {
  if (obj[minorKey] != null) { var n = Number(obj[minorKey]); return isFinite(n) && Math.floor(n) === n ? n : null; }
  if (obj[rupeeKey] == null || obj[rupeeKey] === '') return 0;
  var a = amountOf_(obj[rupeeKey]); return a ? a.minor : null;
}
/** the first array in the document that looks like a transaction list */
function findTxns_(node, depth) {
  if (!node || typeof node !== 'object' || depth > 6) return null;
  if (Array.isArray(node)) {
    if (node.length && node.every(function (x) { return x && typeof x === 'object'; }) && node.some(function (x) { return 'narration' in x || 'debit_minor' in x || 'credit_minor' in x || 'amount' in x; })) return node;
    for (var i = 0; i < node.length; i++) { var f = findTxns_(node[i], depth + 1); if (f) return f; }
    return null;
  }
  var ks = Object.keys(node);
  for (var j = 0; j < ks.length; j++) { var g = findTxns_(node[ks[j]], depth + 1); if (g) return g; }
  return null;
}
function findKey_(node, key, depth) {
  if (!node || typeof node !== 'object' || depth > 6) return undefined;
  if (!Array.isArray(node) && node[key] != null && typeof node[key] !== 'object') return node[key];
  var ks = Object.keys(node);
  for (var i = 0; i < ks.length; i++) { var v = findKey_(node[ks[i]], key, depth + 1); if (v !== undefined) return v; }
  return undefined;
}
function parseJson_(data) {
  var warnings = [], list = Array.isArray(data) ? data : findTxns_(data, 0);
  if (!list) return fail_('No transaction list found in the JSON (an array of lines, { lines | transactions }, or Account Aggregator Account.Transactions.Transaction).');
  var lines = [], i;
  for (i = 0; i < list.length; i++) {
    var x = list[i] || {}, date = dateOf_(x.date || x.transactionTimestamp || x.txnDate || x.valueDate), debit, credit;
    if (!date) { warnings.push('item ' + (i + 1) + ': unreadable date — skipped'); continue; }
    if (x.type != null && x.amount != null && x.debit == null && x.credit == null && x.debit_minor == null && x.credit_minor == null) {   /* AA: type + amount */
      var a = amountOf_(x.amount), ty = String(x.type).toUpperCase();
      if (!a || !/^(CREDIT|DEBIT)$/.test(ty)) { warnings.push('item ' + (i + 1) + ': unreadable AA amount or type — skipped'); continue; }
      debit = ty === 'DEBIT' ? a.minor : 0; credit = ty === 'CREDIT' ? a.minor : 0;
    } else if (x.amount != null && x.debit == null && x.credit == null && x.debit_minor == null && x.credit_minor == null) {
      var s = amountOf_(x.amount), sd = String(x.drcr || x.dr_cr || '').toLowerCase();
      if (!s) { warnings.push('item ' + (i + 1) + ': unreadable amount — skipped'); continue; }
      var dr = sd ? sd[0] === 'd' : (s.side ? s.side === 'dr' : s.neg); debit = dr ? s.minor : 0; credit = dr ? 0 : s.minor;
    } else { debit = minorOf_(x, 'debit_minor', 'debit'); credit = minorOf_(x, 'credit_minor', 'credit'); }
    if (debit === null || credit === null) { warnings.push('item ' + (i + 1) + ': unreadable amount — skipped'); continue; }
    var ln = { date: date, narration: String(x.narration == null ? (x.description || x.mode || '') : x.narration), debit_minor: debit, credit_minor: credit };
    var vd = dateOf_(x.value_date || x.valueDate); if (vd) ln.value_date = vd;
    var ref = x.ref || x.reference || x.txnId; if (ref) ln.ref = String(ref);
    if (x.cheque_no) ln.cheque_no = String(x.cheque_no);
    var bal = x.balance_minor != null ? Number(x.balance_minor) : (x.currentBalance != null ? (amountOf_(x.currentBalance) || {}).minor : (x.balance != null ? (amountOf_(x.balance) || {}).minor : null));
    if (x.balance_minor == null && bal != null && x.currentBalance != null && amountOf_(x.currentBalance).neg) bal = -bal;
    if (bal != null && isFinite(bal)) ln.balance_minor = bal;
    ln.row = i + 1; lines.push(ln);
  }
  var out = { ok: true, account: null, lines: lines, warnings: warnings };
  if (!Array.isArray(data) && data) {
    var acct = data.account != null && typeof data.account !== 'object' ? data.account : findKey_(data, 'maskedAccNumber', 0) || findKey_(data, 'linkedAccRef', 0);
    if (acct != null) out.account = String(acct);
    if (data.opening_minor != null) out.opening_minor = Number(data.opening_minor);
    if (data.closing_minor != null) out.closing_minor = Number(data.closing_minor);
    else { var cb = findKey_(data, 'currentBalance', 0); if (cb !== undefined && !lines.some(function (l) { return l.balance_minor != null; })) { var cm = amountOf_(cb); if (cm) out.closing_minor = cm.neg ? -cm.minor : cm.minor; } }
  }
  return out;
}

/* ═══ parse ═══════════════════════════════════════════════════════════════════════════════════════════════════════ */
/**
 * ⭐ parse(text, { format?: 'csv' | 'json' | 'auto', preset?: 'sbi'|'hdfc'|'icici'|'axis'|'kotak', mapping?, header?, account? })
 *   → { ok, account, from, to, opening_minor?, closing_minor?, lines: [statement line + row], warnings: [text] }
 * `text` is the file's text (JSON may also be handed already parsed). Lines come out oldest first. A bad row is skipped WITH a
 * warning naming its row; a balance that does not follow from the line before is a warning naming the line. Never throws.
 */
function parse(text, opts) {
  var o = opts || {}, fmt = o.format || 'auto', res, data = null;
  if (text && typeof text === 'object') { data = text; fmt = 'json'; }
  else if (typeof text !== 'string' || !text.trim()) return fail_('Nothing to read: the statement is empty.');
  else if (fmt === 'auto') fmt = /^\s*[\[{]/.test(text) ? 'json' : 'csv';
  try {
    if (fmt === 'json') { if (data === null) { try { data = JSON.parse(text); } catch (e) { return fail_('The JSON could not be read: ' + e.message); } } res = parseJson_(data); }
    else if (fmt === 'csv') res = parseCsv_(text, o);
    else return fail_('Unknown format "' + fmt + '" — csv or json.');
  } catch (e) { return fail_('The statement could not be read: ' + e.message); }
  if (!res.ok) return res;
  var lines = res.lines, w = res.warnings;
  if (lines.length > 1 && lines[0].date > lines[lines.length - 1].date) { lines.reverse(); w.push('the statement was listed newest first — read oldest first'); }
  /* the running-balance check */
  var prev = res.opening_minor != null ? res.opening_minor : null, opening = res.opening_minor;
  lines.forEach(function (l, i) {
    if (l.balance_minor == null) { prev = null; return; }
    if (prev == null) { if (i === 0 && opening == null) opening = l.balance_minor - l.credit_minor + l.debit_minor; }
    else {
      var want = prev + l.credit_minor - l.debit_minor;
      if (want !== l.balance_minor) w.push('line ' + (i + 1) + (l.row ? ' (row ' + l.row + ')' : '') + ' ' + l.date + ': the balance ' + l.balance_minor + ' does not follow from the line before (expected ' + want + ' paise) — a line may be missing or altered');
    }
    prev = l.balance_minor;
  });
  var out = { ok: true, account: res.account || null, lines: lines, warnings: w };
  if (lines.length) { out.from = lines[0].date; out.to = lines[lines.length - 1].date; out.from = lines.reduce(function (a, l) { return l.date < a ? l.date : a; }, lines[0].date); out.to = lines.reduce(function (a, l) { return l.date > a ? l.date : a; }, lines[0].date); }
  if (opening != null) out.opening_minor = opening;
  var last = lines.length ? lines[lines.length - 1] : null;
  if (res.closing_minor != null) out.closing_minor = res.closing_minor; else if (last && last.balance_minor != null) out.closing_minor = last.balance_minor;
  return out;
}

/* ═══ match ═══════════════════════════════════════════════════════════════════════════════════════════════════════ */
var dayNo_ = function (s) { var t = Date.parse(String(s) + 'T00:00:00Z'); return isFinite(t) ? Math.round(t / 86400000) : NaN; };
/** a reference reduced to what both sides can agree on: upper-case alphanumerics, leading zeros off a pure number */
var refKey_ = function (s) { var k = String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, ''); return /^\d+$/.test(k) ? k.replace(/^0+(?=\d)/, '') : k; };
/** the reference keys one side offers: its ref, its cheque no., and any 6+ digit run in its narration (a UTR / UPI ref) */
function keysOf_(ref, chq, narration) {
  var ks = [], add = function (v) { var k = refKey_(v); if (k && k.length >= 3 && ks.indexOf(k) < 0) ks.push(k); };
  add(ref); add(chq);
  String(narration || '').replace(/\d{6,}/g, function (m) { add(m); return m; });
  return ks;
}
var share_ = function (a, b) { for (var i = 0; i < a.length; i++) if (b.indexOf(a[i]) >= 0) return true; return false; };

/** the first subset (in index order, smallest sizes first) of `items` whose minor sum is `target`, 2+ members — or the whole set when it sums */
function subset_(items, target) {
  if (items.length < 2 || items.length > 20) return null;
  var total = items.reduce(function (s, x) { return s + x.m; }, 0);
  if (total === target) return items.slice();
  for (var size = 2; size < items.length; size++) {
    var pick = [], found = null;
    (function rec(from, left, sum) {
      if (found) return;
      if (left === 0) { if (sum === target) found = pick.slice(); return; }
      for (var i = from; i <= items.length - left; i++) { if (sum + items[i].m > target) continue; pick.push(items[i]); rec(i + 1, left - 1, sum + items[i].m); pick.pop(); if (found) return; }
    })(0, size, 0);
    if (found) return found;
  }
  return null;
}

/**
 * ⭐ match(stmtLines, ledgerLines, { window_days = 3 }) → { matched: [{ stmt: [i…], ledger: [id…], how }], unmatched_stmt: [{ i, …line }],
 *   unmatched_ledger: [ledger line], ambiguous: [{ stmt: i, candidates: [id…] }] }
 * Passes, in order: (a) 'ref' — the same reference (ref / cheque no. / a UTR in the narration) and the same amount and side;
 * (b) 'amount+date' — the same amount and side within the window, where the pair is each other's only candidate (repeated until
 * nothing more resolves; what stays tied is listed under `ambiguous` and left unmatched, never guessed); (c) 'one-to-many' — one
 * statement line is the sum of several ledger lines of one day (a deposit of several receipts) and 'many-to-one' the reverse.
 * A ledger line is matched at most once; the same inputs always give the same answer. Nothing is edited: a match is a record
 * of statement line numbers against ledger line ids.
 */
function match(stmtLines, ledgerLines, opts) {
  var win = opts && opts.window_days != null ? Math.max(0, +opts.window_days) : 3;
  var S = (stmtLines || []).map(function (l, i) {
    var dr = +l.debit_minor || 0, cr = +l.credit_minor || 0;
    return { i: i, line: l, side: dr ? 'out' : 'in', m: dr || cr, day: dayNo_(l.date), keys: keysOf_(l.ref, l.cheque_no, l.narration), used: !dr && !cr };
  });
  var L = (ledgerLines || []).map(function (l, k) {
    var dr = +l.dr_minor || 0, cr = +l.cr_minor || 0;
    return { k: k, line: l, side: cr > dr ? 'out' : 'in', m: Math.abs(dr - cr), day: dayNo_(l.date), keys: keysOf_(l.ref, null, ''), used: dr === cr };
  });
  var matched = [], ambiguous = [];
  var take = function (ss, ll, how) { ss.forEach(function (s) { s.used = true; }); ll.forEach(function (x) { x.used = true; }); matched.push({ stmt: ss.map(function (s) { return s.i; }), ledger: ll.map(function (x) { return x.line.id; }), how: how }); };
  var near = function (s, x) { return Math.abs(s.day - x.day); };
  var order = function (s, a, b) { return near(s, a) - near(s, b) || a.k - b.k; };

  /* (a) the same reference and amount */
  S.forEach(function (s) {
    if (s.used || !s.keys.length) return;
    var c = L.filter(function (x) { return !x.used && x.side === s.side && x.m === s.m && share_(s.keys, x.keys); }).sort(function (a, b) { return order(s, a, b); });
    if (c.length) take([s], [c[0]], 'ref');
  });
  /* (b) the same amount inside the window, each the other's only candidate */
  for (var again = true; again;) {
    again = false; ambiguous = [];
    var cand = {}, back = {};
    S.forEach(function (s) {
      if (s.used) return;
      cand[s.i] = L.filter(function (x) { return !x.used && x.side === s.side && x.m === s.m && near(s, x) <= win; });
      cand[s.i].forEach(function (x) { (back[x.k] = back[x.k] || []).push(s); });
    });
    S.forEach(function (s) {
      if (s.used || !cand[s.i] || !cand[s.i].length) return;
      if (cand[s.i].length === 1 && back[cand[s.i][0].k].length === 1) { take([s], [cand[s.i][0]], 'amount+date'); again = true; }
    });
    if (!again) S.forEach(function (s) { if (!s.used && cand[s.i] && cand[s.i].length) ambiguous.push({ stmt: s.i, candidates: cand[s.i].map(function (x) { return x.line.id; }) }); });
  }
  /* (c) one statement line = several ledger lines of one day, and the reverse */
  S.forEach(function (s) {
    if (s.used) return;
    var byDay = {};
    L.forEach(function (x) { if (!x.used && x.side === s.side && near(s, x) <= win) (byDay[x.line.date] = byDay[x.line.date] || []).push(x); });
    var days = Object.keys(byDay).sort(function (a, b) { return Math.abs(dayNo_(a) - s.day) - Math.abs(dayNo_(b) - s.day) || (a < b ? -1 : 1); });
    for (var d = 0; d < days.length; d++) { var sub = subset_(byDay[days[d]], s.m); if (sub) { take([s], sub, 'one-to-many'); return; } }
  });
  L.forEach(function (x) {
    if (x.used) return;
    var byDay = {};
    S.forEach(function (s) { if (!s.used && s.side === x.side && near(s, x) <= win) (byDay[s.line.date] = byDay[s.line.date] || []).push(s); });
    var days = Object.keys(byDay).sort(function (a, b) { return Math.abs(dayNo_(a) - x.day) - Math.abs(dayNo_(b) - x.day) || (a < b ? -1 : 1); });
    for (var d = 0; d < days.length; d++) { var sub = subset_(byDay[days[d]], x.m); if (sub) { take(sub, [x], 'many-to-one'); return; } }
  });
  ambiguous = ambiguous.filter(function (a) { return !S[a.stmt].used; });
  return {
    matched: matched,
    unmatched_stmt: S.filter(function (s) { return !s.used; }).map(function (s) { return Object.assign({ i: s.i }, s.line); }),
    unmatched_ledger: L.filter(function (x) { return !x.used; }).map(function (x) { return x.line; }),
    ambiguous: ambiguous,
  };
}

/* ═══ suggest ═════════════════════════════════════════════════════════════════════════════════════════════════════ */
/* RULES — DATA. Keywords are whole words in the narration (upper-cased); `bank` adds that bank's own words to the defaults. */
var RULES = {
  default: {
    charges: ['CHRG', 'CHRGS', 'CHARGES', 'CHARGE', 'CHG', 'CHGS', 'SMS CHG', 'GST ON CHG', 'GST ON CHARGES', 'SERVICE CHARGE', 'AMC', 'ANNUAL FEE', 'DEBIT CARD FEE', 'MIN BAL', 'MAINTENANCE CHARGES'],
    interest: ['INT', 'INTEREST', 'INTEREST CR', 'INT CR', 'INT.PD', 'INT PD', 'CREDIT INTEREST', 'SB INT', 'INT PAID'],
    atm: ['ATM', 'ATM WDL', 'CASH WDL', 'CASH WITHDRAWAL', 'NFS', 'ATM CASH', 'SELF WITHDRAWAL'],
    cash_deposit: ['CASH DEPOSIT', 'CASH DEP', 'CDM', 'BY CASH'],
    cheque_return: ['RTN', 'RETURN', 'RETURNED', 'CHQ RET', 'CHQ RTN', 'CHEQUE RETURN', 'INWARD RETURN', 'I/W RETURN', 'BOUNCE', 'DISHONOUR', 'DISHONOURED'],
    transfer: ['UPI', 'NEFT', 'IMPS', 'RTGS'],
  },
  sbi: { charges: ['SMS ALERT CHARGES', 'ATM AMC'], interest: ['CREDIT INTEREST'] },
  hdfc: { charges: ['CHQ BOOK ISSUE', 'FUNDS TRANSFER CHARGES'], interest: ['INT.PD'] },
  icici: { charges: ['GST-', 'SMS CHARGES'], interest: ['INT.PD'] },
  axis: { charges: ['SERVICE CHRG'], interest: ['INT.PD'] },
  kotak: { charges: ['CHG'], interest: ['INTEREST CREDITED'] },
};
function rulesFor_(opts) {
  var o = opts || {}, base = JSON.parse(JSON.stringify(RULES.default)), bank = RULES[String(o.bank || '').toLowerCase()];
  [bank, o.rules].forEach(function (r) { if (!r) return; Object.keys(r).forEach(function (k) { base[k] = (base[k] || []).concat(r[k]); }); });
  return base;
}
function hasWord_(text, words) {
  for (var i = 0; i < words.length; i++) {
    var w = String(words[i]).toUpperCase().replace(/[.\-\/]/g, function (c) { return '\\' + c; }).replace(/\s+/g, '\\s+');
    if (new RegExp('(^|[^A-Z0-9])' + w + '([^A-Z0-9]|$)').test(text)) return words[i];
  }
  return null;
}
/** the party a narration names: a VPA or account number (high), or the name (medium); null when none, 'many' when it is not unique */
function partyIn_(text, parties) {
  var low = String(text).toLowerCase(), upper = String(text).toUpperCase(), hits = [];
  (parties || []).forEach(function (p) {
    var ids = [].concat(p.vpa || [], p.vpas || [], p.account || [], p.accounts || []).filter(Boolean);
    var strong = ids.some(function (v) { return low.indexOf(String(v).toLowerCase()) >= 0; });
    var names = [p.name, p.id].concat(p.aliases || []).filter(function (x) { return x && String(x).trim().length >= 3; });
    var weak = names.some(function (n) { return hasWord_(upper, [String(n).trim()]) !== null; });
    if (strong) hits.push({ p: p, how: 'high' }); else if (weak) hits.push({ p: p, how: 'medium' });
  });
  var strongHits = hits.filter(function (h) { return h.how === 'high'; }), use = strongHits.length ? strongHits : hits;
  if (!use.length) return null;
  return use.length === 1 ? use[0] : 'many';
}

/**
 * ⭐ suggest(unmatchedStmtLine, { parties?, receipts?, rules?, bank? }) → { event, confidence, why, rule?, entry?, proposal }
 * A PROPOSAL for a statement line the books lack — never posted. `event` is an EXISTING posting event (expense bank_charges ·
 * other_income interest_received · payment_received / payment_made for a named party · contra bank↔cash · cheque_dishonoured), and
 * `entry` is what posting.post composes from it (its lines, Dr = Cr, its voucher type), so the person confirms what will really be
 * posted; the confirmed entry is owner-made (series MJ). Unknown → { event: null, confidence: 'none', why: 'no rule matched' }.
 *   parties   [{ id | name, kind?: 'customer'|'supplier', vpa?, account?, aliases? }]   rules  { charges: […], interest: […], … } extra keywords
 *   receipts  [{ ref, party, amount_minor, cheque_no? }] the cleared receipts — a returned cheque names the one it reverses
 */
function suggest(line, opts) {
  var o = opts || {}, R = rulesFor_(o), none = function (why) { return { event: null, confidence: 'none', why: why, proposal: false }; };
  if (!line) return none('no statement line');
  var debit = +line.debit_minor || 0, credit = +line.credit_minor || 0;
  if ((debit > 0) === (credit > 0)) return none('a statement line has money going one way — this has ' + (debit && credit ? 'both' : 'neither'));
  var out = debit > 0, m = out ? debit : credit, text = String(line.narration || '').toUpperCase(), date = line.date;
  var ref = line.ref || line.cheque_no || null;
  var base = function (ev, rule, confidence, why, extra) { ev.date = date; ev.amount = m / 100; if (ref) ev.ref = String(ref); ev.narration = 'Bank statement ' + date + ': ' + String(line.narration || '').slice(0, 120); return finish_(ev, rule, confidence, why, m, extra); };
  var w;
  if (out && (w = hasWord_(text, R.charges))) return base({ type: 'expense', class: 'bank_charges', paid_from: 'bank' }, 'charges', 'high', 'narration says "' + w + '" — a bank charge');
  if (out && (w = hasWord_(text, R.cheque_return))) {
    var rc = (o.receipts || []).filter(function (r) { return +r.amount_minor === m; });
    var byNo = (o.receipts || []).filter(function (r) { return +r.amount_minor === m && r.cheque_no && share_(keysOf_(null, r.cheque_no, ''), keysOf_(line.ref, line.cheque_no, line.narration)); });
    var pick = byNo.length === 1 ? byNo[0] : (rc.length === 1 ? rc[0] : null);
    if (pick) return base({ type: 'cheque_dishonoured', party: pick.party, reverses: pick.ref }, 'cheque_return', byNo.length === 1 ? 'high' : 'medium', 'narration says "' + w + '" and the cleared receipt ' + pick.ref + ' is for this amount');
    return base({ type: 'cheque_dishonoured', party: null, reverses: null }, 'cheque_return', 'low', 'narration says "' + w + '" — the receipt it reverses and its party are not known; name them before posting', { needs: ['party', 'reverses'] });
  }
  if (out && (w = hasWord_(text, R.atm))) return base({ type: 'contra', from: 'bank', to: 'cash' }, 'atm', 'high', 'narration says "' + w + '" — cash drawn from the bank');
  if (!out && (w = hasWord_(text, R.cash_deposit))) return base({ type: 'contra', from: 'cash', to: 'bank' }, 'cash_deposit', 'medium', 'narration says "' + w + '" — cash paid into the bank');
  if (!out && (w = hasWord_(text, R.interest))) return base({ type: 'other_income', class: 'interest_received', into: 'bank' }, 'interest', 'high', 'narration says "' + w + '" — interest credited by the bank');
  if (hasWord_(text, R.transfer) || (o.parties || []).length) {
    var hit = partyIn_(line.narration, o.parties);
    if (hit === 'many') return none('the narration names more than one party');
    if (hit) {
      var pid = hit.p.id || hit.p.name, kind = hit.p.kind;
      if (!out && kind !== 'supplier') return base({ type: 'payment_received', mode: 'bank', party: pid }, 'party_credit', hit.how, 'a credit naming ' + pid + (hit.how === 'high' ? ' by VPA / account' : ' by name') + ' — received from the party');
      if (out && kind !== 'customer') return base({ type: 'payment_made', mode: 'bank', party: pid }, 'party_debit', hit.how, 'a debit naming ' + pid + (hit.how === 'high' ? ' by VPA / account' : ' by name') + ' — paid to the party');
    }
  }
  return none('no rule matched');
}
/** the proposal: the event, composed by posting.post so it carries the entry that would be posted */
function finish_(ev, rule, confidence, why, minor, extra) {
  var res = { event: ev, confidence: confidence, why: why, rule: rule, proposal: true, needs_confirm: true, amount_minor: minor };
  if (extra && extra.needs) { res.needs = extra.needs; res.entry = null; return res; }
  var P = posting_();
  if (!P || typeof P.post !== 'function') { res.entry = null; return res; }
  var r = P.post(Object.assign({ currency: 'INR' }, ev));
  if (!r.ok) { res.entry = null; res.confidence = 'low'; res.why += ' — but posting refuses it: ' + r.why; res.refused = r.why; return res; }
  var dr = 0, cr = 0; r.lines.forEach(function (l) { dr += l.dr_minor; cr += l.cr_minor; });
  res.entry = { lines: r.lines.map(function (l) { return { code: l.code, account: l.account, party: l.party || null, dr_minor: l.dr_minor, cr_minor: l.cr_minor }; }), balanced: dr === cr, dr_minor: dr, cr_minor: cr, voucher: r.voucher, series: 'MJ' };
  if (!res.entry.balanced) { res.confidence = 'low'; res.why += ' — but the composed entry does not balance'; }
  return res;
}

/* ═══ brs ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
/**
 * ⭐ brs({ asOf, bookBalance_minor, bankBalance_minor, unmatched_ledger, unmatched_stmt }) → the Bank Reconciliation Statement
 *   Balance as per books (Dr positive)
 *   + cheques issued but not presented      (a ledger Cr the bank has not paid)
 *   − cheques deposited but not credited    (a ledger Dr the bank has not credited)
 *   + bank credits not in the books         (interest, direct credits)
 *   − bank debits not in the books          (charges, ATM, direct debits)
 *   = balance as per bank, and the difference to the bank's own figure — 0 when everything is accounted, otherwise NAMED.
 * Items dated after asOf are left out (they belong to the next statement). All figures are paise.
 */
function brs(x) {
  x = x || {};
  if (!dateOf_(x.asOf)) return { ok: false, why: 'The BRS needs asOf as YYYY-MM-DD.' };
  if (!Number.isInteger(x.bookBalance_minor) || !Number.isInteger(x.bankBalance_minor)) return { ok: false, why: 'The BRS needs bookBalance_minor and bankBalance_minor in whole paise.' };
  var asOf = x.asOf, within = function (l) { return !l.date || l.date <= asOf; };
  var R = rulesFor_({}), kindOf = function (txt, interestWords) { var t = String(txt || '').toUpperCase(); return hasWord_(t, R.charges) ? 'charges' : (interestWords && hasWord_(t, R.interest) ? 'interest' : 'other'); };
  var led = (x.unmatched_ledger || []).filter(within), st = (x.unmatched_stmt || []).filter(within);
  var item = function (l, m, name, extra) { return Object.assign({ date: l.date || null, ref: l.ref || l.cheque_no || null, name: name, amount_minor: m }, extra || {}); };
  var issued = [], deposited = [], bankCr = [], bankDr = [];
  led.forEach(function (l) { var dr = +l.dr_minor || 0, cr = +l.cr_minor || 0, net = dr - cr; if (net < 0) issued.push(item(l, -net, (l.narration || l.entry_no || 'ledger line'), { id: l.id, entry_no: l.entry_no })); else if (net > 0) deposited.push(item(l, net, (l.narration || l.entry_no || 'ledger line'), { id: l.id, entry_no: l.entry_no })); });
  st.forEach(function (l) { var d = +l.debit_minor || 0, c = +l.credit_minor || 0; if (c > d) bankCr.push(item(l, c - d, l.narration || 'bank credit', { kind: kindOf(l.narration, true) })); else if (d > c) bankDr.push(item(l, d - c, l.narration || 'bank debit', { kind: kindOf(l.narration, false) })); });
  var sum = function (a) { return a.reduce(function (s, y) { return s + y.amount_minor; }, 0); };
  var computed = x.bookBalance_minor + sum(issued) - sum(deposited) + sum(bankCr) - sum(bankDr);
  var diff = x.bankBalance_minor - computed;
  var res = {
    ok: true, asOf: asOf, book_balance_minor: x.bookBalance_minor,
    issued_not_presented: issued, deposited_not_credited: deposited, bank_credits_not_in_books: bankCr, bank_debits_not_in_books: bankDr,
    totals: { issued_not_presented_minor: sum(issued), deposited_not_credited_minor: sum(deposited), bank_credits_not_in_books_minor: sum(bankCr), bank_debits_not_in_books_minor: sum(bankDr) },
    computed_bank_minor: computed, bank_balance_minor: x.bankBalance_minor, difference_minor: diff, tied: diff === 0,
  };
  res.rows = [
    { label: 'Balance as per books', minor: x.bookBalance_minor, sign: '' },
    { label: 'Add: cheques issued but not presented', minor: sum(issued), sign: '+' },
    { label: 'Less: cheques deposited but not credited', minor: -sum(deposited), sign: '-' },
    { label: 'Add: credits by the bank not yet in the books', minor: sum(bankCr), sign: '+' },
    { label: 'Less: debits by the bank not yet in the books', minor: -sum(bankDr), sign: '-' },
    { label: 'Balance as per bank (worked)', minor: computed, sign: '=' },
    { label: 'Balance as per bank statement', minor: x.bankBalance_minor, sign: '' },
    { label: 'Difference', minor: diff, sign: '' },
  ];
  res.note = diff === 0 ? 'The books reconcile to the bank: every difference is a named item.'
    : 'Unexplained difference of ' + (Math.abs(diff) / 100).toFixed(2) + ' (' + (diff > 0 ? 'the bank shows more than the books and the listed items explain' : 'the bank shows less than the books and the listed items explain') + ') — a line is missing from one side, or a balance is not as at ' + asOf + '.';
  return res;
}

var EXPORTS = { parse: parse, match: match, suggest: suggest, brs: brs, PRESETS: PRESETS, RULES: RULES };

/* ⭐ ONE FILE, EVERY HOST: node takes module.exports; a page takes window.CBBankRecon. */
if (typeof module !== 'undefined' && module.exports) module.exports = EXPORTS;
if (root && typeof root.window !== 'undefined') root.window.CBBankRecon = EXPORTS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
