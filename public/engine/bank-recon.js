/* ADOPTED from chitbridge-engines v1.44.1 · bank-recon · sha256 14ed769fee7666cff1b50a4e4687ff66f53109ec7e3036d932e8d1b33f8f60ef — DO NOT EDIT HERE. Change it in chitbridge-engines, release a version, then run tools/adopt.cjs. */
/* chitbridge-engines · bank-recon. Edited ONLY in chitbridge-engines/src/bank-recon.js; every platform adopts a released version of it. */
(function (root) {
'use strict';
// @stage tested
// @stage-note A bank statement (CSV / JSON) read, matched to the Ledger's bank lines AND to the payment chits on the rail (BR1), the missing entries SUGGESTED, the BRS. Pure — no I/O, no clock.
/**
 * bank-recon.js — BANK RECONCILIATION: READ THE STATEMENT, MATCH IT, SUGGEST WHAT THE BOOKS MISS, STATE THE DIFFERENCE. v1.18.0; the rail leg v1.44.0 (v1.44.1: a learned rule's words in any order).
 *
 * Athi, 2026-10-03: *"can u build bank stt reconciliation by reading the csv / json file and add any transaction which is missing?"*
 * Standing rules carried here: (1) PROPOSE, NEVER AUTO-APPLY — suggest() hands back an event a person confirms (an owner-made entry,
 * series MJ); nothing here posts. (2) THE BOOKS ARE INSERT-ONLY — a match is a separate record (statement line ↔ ledger line ids);
 * no journal line is edited. (3) COMPUTE ONCE — amounts are read as written, in minor units (integers), never re-derived; a suggestion's
 * entry is composed by posting.post (the existing events, no new posting rule), so Dr = Cr to the minor unit by that engine's own check.
 *
 *   parse(text, { format?, preset?, mapping?, bank? })  → { ok, account?, from?, to?, opening_minor?, closing_minor?, lines, warnings }
 *   match(stmtLines, ledgerLines, { window_days? })      → { matched, unmatched_stmt, unmatched_ledger, ambiguous }
 *   suggest(stmtLine, { parties?, receipts?, rules?, bank? }) → { event, confidence, why, … }   a PROPOSAL
 *   brs({ asOf, bookBalance_minor, bankBalance_minor, unmatched_ledger, unmatched_stmt })     → the Bank Reconciliation Statement
 *   v1.44.0 (BR1) — THE RAIL ALREADY TOLD US: railPayments(chits) · explain(stmt, ledger, rail, opts) · lineKey · ask(line, opts) ·
 *   learn(line, explanation) · step(state, action) — see "THE RAIL" below.
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
 *   rows above it are a preamble (an "Account No" line there is read as `account`). Amounts: grouping as "1,23,456.78" or "123,456.78", a
 *   currency prefix (the pack's: pack.bank.amountPrefixes), "Dr" / "Cr" suffix, (brackets) or a minus for a debit in a single Amount column, separate Debit and Credit
 *   columns, or an Amount column with a Dr/Cr column. A single signed Amount column reads negative as debit. Dates: dd/mm/yyyy,
 *   dd-mm-yy, dd-MMM-yyyy, dd MMM yyyy, yyyy-mm-dd (and an ISO time after it). A statement listed newest-first is turned round (warned).
 *   PRESETS (the pack's data: pack.bank.presets) — each names its header cells. ⚠️ They are written from the shape of each
 *   bank's usual export and are all marked verify:true — check against a real file before trusting one; a bank changes its headers.
 *   `mapping` { field: 'Header text' | columnIndex } for any other bank; fields: date value_date narration ref cheque_no debit credit
 *   amount drcr balance. With no preset and no mapping the generic header words are tried.
 *   RUNNING BALANCE: when balance_minor is present each line must follow the one before (prev + credit − debit); a break is a
 *   WARNING naming the line number; the check carries on from the stated balance.
 * ── parse: JSON ────────────────────────────────────────────────────────────────────────────────────────────────────
 *   (1) an array of statement lines as above — *_minor integers are read as given; `debit` / `credit` / `amount` (major units, string or
 *       number) are read exactly to the minor unit. (2) { account?, opening_minor?, closing_minor?, lines | transactions: [ … ] }.
 *   (3) Account Aggregator FI data — the ReBIT deposit-account schema: Account.Transactions.Transaction[] of { type CREDIT | DEBIT,
 *       mode, amount "1234.56", currentBalance, transactionTimestamp, valueDate, txnId, narration, reference }, with
 *       Account.Summary.currentBalance and Account.Transactions.startDate / endDate. Found wherever it sits in the document.
 *       ⚠️ Written from the published ReBIT FI-schema field names; check against the schema version a real AA response carries.
 */

var T_ = null, P_ = null, REG_ = null, MONEY_ = null;
function dep_(file, g) {
  var G = (typeof globalThis !== 'undefined' ? globalThis : root);
  if (G[g] && typeof G[g] === 'object' && Object.keys(G[g]).length) return G[g];
  if (typeof require === 'function') { try { return require(file); } catch (_) { return null; } }
  return null;
}
function posting_() { return P_ || (P_ = dep_('./posting', 'CBPosting')); }
function money_() { return MONEY_ || (MONEY_ = dep_('./money', 'CBMoney')); }
/** the currency's minor-unit digits — money.decimals (2, 0 or 3 digits); 2 when money.js is not loaded, as before */
function dp_(cur) { var M = money_(); return M && M.decimals && cur ? M.decimals(cur) : 2; }
function regulation_() { return REG_ || (REG_ = dep_('./regulation', 'CBRegulation')); }
/** the pack a call means (opts.pack, else the registry's for opts.country) and its bank rules; null when the pack has none */
function bankOf_(opts) {
  var R = regulation_(), pk = (opts && opts.pack) || (R ? R.resolve(opts) : null);
  return pk && pk.bank ? { pack: pk, bank: pk.bank } : null;
}
/** the amount prefixes a statement prints before a figure (the pack's), as one pattern: longest alternatives first as listed */
function prefixRe_(list) { return new RegExp('^(' + (list || []).map(function (p) { return String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')\\s*', 'i'); }
var DEFAULT_BANK_ = (function () {
  var R = regulation_(), d = R && R.packFor(R.DEFAULT);
  if (!d) throw new Error('bank-recon.js needs regulation.js (CBRegulation, with the India pack) loaded before it — add the regulation scripts ahead of this one on the page; see the CHANGELOG, v1.28.0.');
  return d.bank || { presets: {}, keywords: { default: {} }, amountPrefixes: [], minorUnit: 'minor units' }; })();
var PRESETS = DEFAULT_BANK_.presets, RULES = DEFAULT_BANK_.keywords;
function fail_(why) { return { ok: false, why: why, lines: [], warnings: [] }; }

/* ═══ PRESETS — DATA, NOT CODE PATHS ═══════════════════════════════════════════════════════════════════════════════
 * field → the header cell(s) the bank prints (compared with case, spaces and punctuation ignored). verify:true = not yet checked
 * against a real file of that bank. */
/* the presets are the PACK'S (pack.bank.presets): a country's banks and the header cells each prints; the export below is the default pack's table */
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
function amountOf_(ctx, raw) {
  var re = ctx.re, dp = ctx.dp === undefined ? 2 : ctx.dp;
  if (typeof raw === 'number') raw = isFinite(raw) ? String(raw) : '';
  var s = String(raw == null ? '' : raw).trim(); if (!s) return { minor: 0, side: null, neg: false, empty: true };
  var side = null, neg = false, m;
  if ((m = /^\((.*)\)$/.exec(s))) { neg = true; s = m[1]; }
  if ((m = /^(.*?)\s*(Dr|Cr|D|C)\.?$/i.exec(s))) { side = m[2].toLowerCase()[0] === 'd' ? 'dr' : 'cr'; s = m[1]; }
  if ((m = /^(Dr|Cr)\.?\s*(.*)$/i.exec(s))) { side = m[1].toLowerCase() === 'dr' ? 'dr' : 'cr'; s = m[2]; }
  s = s.replace(re, '').replace(/\s/g, '');
  if (s[0] === '-') { neg = true; s = s.slice(1); } else if (s[0] === '+') s = s.slice(1);
  s = s.replace(/,/g, '');
  if (!/^\d*\.?\d*$/.test(s) || !/\d/.test(s)) return null;
  var parts = s.split('.'), whole = parts[0] || '0', frac = (parts[1] || '').padEnd(dp, '0');
  if (frac.length > dp) { if (/[1-9]/.test(frac.slice(dp))) return null; frac = frac.slice(0, dp); }   /* a decimal past the currency's minor unit that is not zero is not a minor unit */
  var minor = parseInt(whole, 10) * Math.pow(10, dp) + (dp ? parseInt(frac, 10) : 0);
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

function parseCsv_(text, o, ctx) {
  var warnings = [], lines = [], preset = o.preset ? ctx.presets[String(o.preset).toLowerCase()] : null;
  if (o.preset && !preset) return fail_('Unknown bank preset "' + o.preset + '" — presets: ' + Object.keys(ctx.presets).join(', ') + '; or pass a mapping.');
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
      var d = amountOf_(ctx, get(row, 'debit')), c = amountOf_(ctx, get(row, 'credit'));
      if (!d || !c) bad = true; else { debit = d.minor; credit = c.minor; }
    } else {
      var a = amountOf_(ctx, get(row, 'amount')), mark = get(row, 'drcr');
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
      var b = amountOf_(ctx, get(row, 'balance'));
      if (b && !b.empty) line.balance_minor = (b.neg || b.side === 'dr') ? -b.minor : b.minor; else warnings.push('row ' + no + ': unreadable balance — ignored');
    }
    line.row = no;
    lines.push(line);
  }
  return { ok: true, account: account, lines: lines, warnings: warnings };
}

/* ═══ JSON ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
function minorOf_(obj, minorKey, majorKey, ctx) {
  if (obj[minorKey] != null) { var n = Number(obj[minorKey]); return isFinite(n) && Math.floor(n) === n ? n : null; }
  if (obj[majorKey] == null || obj[majorKey] === '') return 0;
  var a = amountOf_(ctx, obj[majorKey]); return a ? a.minor : null;
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
function parseJson_(data, ctx) {
  var warnings = [], list = Array.isArray(data) ? data : findTxns_(data, 0);
  if (!list) return fail_('No transaction list found in the JSON (an array of lines, { lines | transactions }, or Account Aggregator Account.Transactions.Transaction).');
  var lines = [], i;
  for (i = 0; i < list.length; i++) {
    var x = list[i] || {}, date = dateOf_(x.date || x.transactionTimestamp || x.txnDate || x.valueDate), debit, credit;
    if (!date) { warnings.push('item ' + (i + 1) + ': unreadable date — skipped'); continue; }
    if (x.type != null && x.amount != null && x.debit == null && x.credit == null && x.debit_minor == null && x.credit_minor == null) {   /* AA: type + amount */
      var a = amountOf_(ctx, x.amount), ty = String(x.type).toUpperCase();
      if (!a || !/^(CREDIT|DEBIT)$/.test(ty)) { warnings.push('item ' + (i + 1) + ': unreadable AA amount or type — skipped'); continue; }
      debit = ty === 'DEBIT' ? a.minor : 0; credit = ty === 'CREDIT' ? a.minor : 0;
    } else if (x.amount != null && x.debit == null && x.credit == null && x.debit_minor == null && x.credit_minor == null) {
      var s = amountOf_(ctx, x.amount), sd = String(x.drcr || x.dr_cr || '').toLowerCase();
      if (!s) { warnings.push('item ' + (i + 1) + ': unreadable amount — skipped'); continue; }
      var dr = sd ? sd[0] === 'd' : (s.side ? s.side === 'dr' : s.neg); debit = dr ? s.minor : 0; credit = dr ? 0 : s.minor;
    } else { debit = minorOf_(x, 'debit_minor', 'debit', ctx); credit = minorOf_(x, 'credit_minor', 'credit', ctx); }
    if (debit === null || credit === null) { warnings.push('item ' + (i + 1) + ': unreadable amount — skipped'); continue; }
    var ln = { date: date, narration: String(x.narration == null ? (x.description || x.mode || '') : x.narration), debit_minor: debit, credit_minor: credit };
    var vd = dateOf_(x.value_date || x.valueDate); if (vd) ln.value_date = vd;
    var ref = x.ref || x.reference || x.txnId; if (ref) ln.ref = String(ref);
    if (x.cheque_no) ln.cheque_no = String(x.cheque_no);
    var bal = x.balance_minor != null ? Number(x.balance_minor) : (x.currentBalance != null ? (amountOf_(ctx, x.currentBalance) || {}).minor : (x.balance != null ? (amountOf_(ctx, x.balance) || {}).minor : null));
    if (x.balance_minor == null && bal != null && x.currentBalance != null && amountOf_(ctx, x.currentBalance).neg) bal = -bal;
    if (bal != null && isFinite(bal)) ln.balance_minor = bal;
    ln.row = i + 1; lines.push(ln);
  }
  var out = { ok: true, account: null, lines: lines, warnings: warnings };
  if (!Array.isArray(data) && data) {
    var acct = data.account != null && typeof data.account !== 'object' ? data.account : findKey_(data, 'maskedAccNumber', 0) || findKey_(data, 'linkedAccRef', 0);
    if (acct != null) out.account = String(acct);
    if (data.opening_minor != null) out.opening_minor = Number(data.opening_minor);
    if (data.closing_minor != null) out.closing_minor = Number(data.closing_minor);
    else { var cb = findKey_(data, 'currentBalance', 0); if (cb !== undefined && !lines.some(function (l) { return l.balance_minor != null; })) { var cm = amountOf_(ctx, cb); if (cm) out.closing_minor = cm.neg ? -cm.minor : cm.minor; } }
  }
  return out;
}

/* ═══ parse ═══════════════════════════════════════════════════════════════════════════════════════════════════════ */
/**
 * ⭐ parse(text, { format?: 'csv' | 'json' | 'auto', preset?: <a bank the pack knows>, mapping?, header?, account?, pack? })
 *   → { ok, account, from, to, opening_minor?, closing_minor?, lines: [statement line + row], warnings: [text] }
 * `text` is the file's text (JSON may also be handed already parsed). Lines come out oldest first. A bad row is skipped WITH a
 * warning naming its row; a balance that does not follow from the line before is a warning naming the line. Never throws.
 */
function parse(text, opts) {
  var o = opts || {}, fmt = o.format || 'auto', res, data = null, bk = bankOf_(o);
  if (!bk) return fail_('The regulation pack has no bank-statement rules (pack.bank), so a statement cannot be read.');
  var ctx = { re: prefixRe_(bk.bank.amountPrefixes), dp: dp_(o.currency || bk.pack.currency), presets: bk.bank.presets, minorUnit: bk.bank.minorUnit };
  if (text && typeof text === 'object') { data = text; fmt = 'json'; }
  else if (typeof text !== 'string' || !text.trim()) return fail_('Nothing to read: the statement is empty.');
  else if (fmt === 'auto') fmt = /^\s*[\[{]/.test(text) ? 'json' : 'csv';
  try {
    if (fmt === 'json') { if (data === null) { try { data = JSON.parse(text); } catch (e) { return fail_('The JSON could not be read: ' + e.message); } } res = parseJson_(data, ctx); }
    else if (fmt === 'csv') res = parseCsv_(text, o, ctx);
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
      if (want !== l.balance_minor) w.push('line ' + (i + 1) + (l.row ? ' (row ' + l.row + ')' : '') + ' ' + l.date + ': the balance ' + l.balance_minor + ' does not follow from the line before (expected ' + want + ' ' + ctx.minorUnit + ') — a line may be missing or altered');
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
/** the side of money a line moves, in one word: out of the bank, or into it (one place, so the core names the direction once) */
var SIDE_ = function (out) { return out ? 'out' : 'in'; };
var dayNo_ = function (s) { var t = Date.parse(String(s) + 'T00:00:00Z'); return isFinite(t) ? Math.round(t / 86400000) : NaN; };
/** a reference reduced to what both sides can agree on: upper-case alphanumerics, leading zeros off a pure number */
var refKey_ = function (s) { var k = String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, ''); return /^\d+$/.test(k) ? k.replace(/^0+(?=\d)/, '') : k; };
/** the reference keys one side offers: its ref, its cheque no., and any 6+ digit run in its narration (a transaction reference) */
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
    return { i: i, line: l, side: SIDE_(dr), m: dr || cr, day: dayNo_(l.date), keys: keysOf_(l.ref, l.cheque_no, l.narration), used: !dr && !cr };
  });
  var L = (ledgerLines || []).map(function (l, k) {
    var dr = +l.dr_minor || 0, cr = +l.cr_minor || 0;
    return { k: k, line: l, side: SIDE_(cr > dr), m: Math.abs(dr - cr), day: dayNo_(l.date), keys: keysOf_(l.ref, null, ''), used: dr === cr };
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
/* RULES — the pack's keywords (pack.bank.keywords). Keywords are whole words in the narration (upper-cased); `bank` adds that bank's own words to the defaults. */
function rulesFor_(opts, kw) {
  var o = opts || {}, base = JSON.parse(JSON.stringify(kw.default)), bank = kw[String(o.bank || '').toLowerCase()];
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
 *   learned   (v1.44.0, BR1) the rules learn() made from a person's confirmed explanations — tried FIRST; the answer is still a proposal
 *             (rule 'learned', confidence 'medium') and carries `source` (the line and the day it was taught) and `learned_id`
 */
function suggest(line, opts) {
  var o = opts || {}, bk = bankOf_(o), none = function (why) { return { event: null, confidence: 'none', why: why, proposal: false }; };
  if (!line) return none('no statement line');
  if (!bk) return none('the regulation pack has no bank-statement rules (pack.bank)');
  var R = rulesFor_(o, bk.bank.keywords), cur = bk.pack.currency, dp = dp_(cur);
  var debit = +line.debit_minor || 0, credit = +line.credit_minor || 0;
  if ((debit > 0) === (credit > 0)) return none('a statement line has money going one way — this has ' + (debit && credit ? 'both' : 'neither'));
  var out = debit > 0, m = out ? debit : credit, text = String(line.narration || '').toUpperCase(), date = line.date;
  var ref = line.ref || line.cheque_no || null;
  var base = function (ev, rule, confidence, why, extra) { ev.date = date; ev.amount = m / Math.pow(10, dp); if (ref) ev.ref = String(ref); ev.narration = 'Bank statement ' + date + ': ' + String(line.narration || '').slice(0, 120); return finish_(ev, rule, confidence, why, m, extra, cur, bk.pack); };
  var w;
  /* BR1: a rule a person taught (learn()) is tried first — still only a PROPOSAL, shown with where it came from */
  var lr = learnedFor_(line, o.learned, out);
  if (lr) {
    var lev = lr.event ? JSON.parse(JSON.stringify(lr.event)) : { type: out ? 'payment_made' : 'payment_received', mode: 'bank', party: lr.party };
    return base(lev, 'learned', 'medium', 'you said a line with "' + lr.has + '" was ' + (lr.party_name || lr.party || lr.label || 'this') + (lr.source && lr.source.date ? ' (' + lr.source.date + ')' : ''), { source: lr.source || null, learned_id: lr.id || null });
  }
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
function finish_(ev, rule, confidence, why, minor, extra, cur, pk) {
  var res = { event: ev, confidence: confidence, why: why, rule: rule, proposal: true, needs_confirm: true, amount_minor: minor };
  if (extra && extra.source !== undefined) { res.source = extra.source; res.learned_id = extra.learned_id; }
  if (extra && extra.needs) { res.needs = extra.needs; res.entry = null; return res; }
  var P = posting_();
  if (!P || typeof P.post !== 'function') { res.entry = null; return res; }
  var r = P.post(Object.assign({ currency: cur }, ev), { pack: pk });
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
 * Items dated after asOf are left out (they belong to the next statement). All figures are minor units.
 */
function brs(x) {
  x = x || {};
  if (!dateOf_(x.asOf)) return { ok: false, why: 'The BRS needs asOf as YYYY-MM-DD.' };
  if (!Number.isInteger(x.bookBalance_minor) || !Number.isInteger(x.bankBalance_minor)) return { ok: false, why: 'The BRS needs bookBalance_minor and bankBalance_minor in whole ' + ((bankOf_(x) || { bank: {} }).bank.minorUnit || 'minor units') + '.' };
  var asOf = x.asOf, within = function (l) { return !l.date || l.date <= asOf; };
  var bk = bankOf_(x); if (!bk) return { ok: false, why: 'The regulation pack has no bank-statement rules (pack.bank), so the statement cannot be read.' };
  var dp = dp_(x.currency || bk.pack.currency);
  var R = rulesFor_({}, bk.bank.keywords), kindOf = function (txt, interestWords) { var t = String(txt || '').toUpperCase(); return hasWord_(t, R.charges) ? 'charges' : (interestWords && hasWord_(t, R.interest) ? 'interest' : 'other'); };
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
    : 'Unexplained difference of ' + (Math.abs(diff) / Math.pow(10, dp)).toFixed(dp) + ' (' + (diff > 0 ? 'the bank shows more than the books and the listed items explain' : 'the bank shows less than the books and the listed items explain') + ') — a line is missing from one side, or a balance is not as at ' + asOf + '.';
  return res;
}

/* ═══ THE RAIL ALREADY TOLD US (v1.44.0, BR1) ══════════════════════════════════════════════════════════════════════
 * Athi's brief, 2026-10-13: an incumbent GUESSES a bank line from amount and narration; on the rail most money movements are
 * ALREADY KNOWN — the other party's payment advice (api lib/books.js adviceBody, M30: "paid ₹X for bills A, B by ref R") is a sealed
 * chit both sides hold. So a statement line is put against THREE things: the line ↔ the payment chit(s) ↔ the ledger entry.
 *   railPayments(chits)                         the payment advices on MY copies → rail payments (my side: money in / out)
 *   explain(stmt, ledger, rail, opts)           every statement line with its state and what a person may do next
 *   lineKey(line, n?)                           a line's stable key — the date, the side, the amount and the reference (never the narration)
 *   ask(line, { party, currency, me, key })     the message chit that ASKS the other party which bill a line is ("₹4,200 on 12 Oct ref R")
 *   learn(line, { party?, party_name?, event?, label? }, { at?, by? })  a confirmed explanation → a SUGGESTION rule (suggest opts.learned)
 *   step(state, action)                         the device's reconciliation marks: accept · undo · note · attach (undo keeps notes and files)
 * Still pure and still PROPOSE-ONLY: nothing here posts, sends or stores; a host does each of those after a person presses.
 */
var ADVICE_KIND = 'payment_advice', QUERY_KIND = 'bank_query';
/**
 * ⭐ railPayments(chits) → [{ chit_id, side (my money: out of the bank or into it), amount_minor, currency, ref, date, party: { id, name }, bills: [{ ref_chit_id, bill_no, applied_minor }],
 *   payment_id, mine, words }]
 *   chits: my copies, as a host reads them — { chit_id, direction: 'sent' | 'received', party?: { id, name }, status?, business_json, line_items? }.
 *   The side is MY money: an advice I SENT that says 'paid' is money out; one I RECEIVED that says 'paid' is money in; 'received' the reverse.
 *   A reversal advice (payment_advice.reverses_advice_chit_id) takes the advice it reverses off the list. Anything not an advice is left out.
 */
function railPayments(chits) {
  var out = [], gone = {};
  (chits || []).forEach(function (c) {
    var bj = (c && c.business_json) || {}, pa = bj.payment_advice;
    if (!c || bj.kind !== ADVICE_KIND || !pa) return;
    if (pa.reverses_advice_chit_id) { gone[String(pa.reverses_advice_chit_id)] = true; return; }
    var m = Number(pa.amount_minor);
    if (!Number.isInteger(m) || m <= 0) return;
    var sent = c.direction === 'sent', paid = pa.action !== 'received';
    out.push({
      chit_id: String(c.chit_id), side: SIDE_(sent === paid), amount_minor: m, currency: String(pa.currency || bj.currency || '').toUpperCase() || null,
      ref: pa.reference || null, date: dateOf_(pa.paid_on) || null, party: c.party || null, mine: sent, payment_id: sent ? (pa.adviser_payment_id || null) : null,
      bills: (c.line_items || []).filter(function (li) { return li && li.ref_chit_id; }).map(function (li) {
        return { ref_chit_id: String(li.ref_chit_id), bill_no: li.bill_no || null, applied_minor: Number.isInteger(li.applied_minor) ? li.applied_minor : null }; }),
      words: pa.words || null, status: c.status || null,
    });
  });
  return out.filter(function (r) { return !gone[r.chit_id]; });
}
/** ⭐ lineKey(line, n) → 'YYYY-MM-DD|in|420000|REF' — the facts that may travel (date · side · amount · reference); `n` (the n-th line with the
 *  same facts in one statement, from 0) keeps two equal lines apart. The narration is NEVER in a key: a key may ride on an ask chit. */
function lineKey(line, n) {
  var l = line || {}, d = +l.debit_minor || 0, c = +l.credit_minor || 0;
  return [l.date || '', SIDE_(d), d || c, refKey_(l.ref || l.cheque_no || '')].join('|') + (n ? '#' + n : '');
}
/**
 * ⭐ explain(stmtLines, ledgerLines, railPays, { window_days = 3, asks?, learned?, parties?, bank?, pack?, country? })
 *   → { rows: [{ i, key, state, how, chits: [chit_id], ledger: [ledger id], bills, asked, suggestion, next }], rail_only: [rail payment],
 *       unmatched_ledger, ambiguous, counts: { settled, told, matched, check, asked, suggested, unexplained, needs_you } }
 *   The ledger side is match() unchanged. The rail side is matched the same way, in the same order: (a) 'ref' — the advice's reference is
 *   one of the line's references, same amount, same side (any day: the reference is the proof); (b) 'amount+date' — same amount and side in the
 *   window, each the other's only candidate (a tie is never guessed); (c) 'one-to-many' — one deposit = several advices; (d) 'many-to-one' —
 *   one advice paid in several lines. A ledger line carrying the advice's chit (`chit_id` / `source_chit_id`) or its payment (`payment_id`) is
 *   the third leg even when it was not matched by date.
 *   STATES — settled: an advice AND a ledger entry (three-way; one tap to accept) · told: an advice, not yet in the books (record it from the
 *   advice) · matched: in the books, no advice · check: more than one entry fits · asked: nobody explained it and the other party was asked ·
 *   suggested: a rule's proposal · unexplained: nothing — the only lines a person must look at, with `suggested` and `check` (needs_you).
 *   asks: [{ key, chit_id, party, at }] — the ask chits already sent (their business_json.bank_query.key).
 */
function explain(stmtLines, ledgerLines, railPays, opts) {
  var o = opts || {}, win = o.window_days != null ? Math.max(0, +o.window_days) : 3;
  var lines = stmtLines || [], led = ledgerLines || [], M = match(lines, led, { window_days: win });
  var seen = {}, keys = lines.map(function (l) { var k = lineKey(l); var n = seen[k] || 0; seen[k] = n + 1; return lineKey(l, n); });
  var S = lines.map(function (l, i) { var d = +l.debit_minor || 0, c = +l.credit_minor || 0; return { i: i, side: SIDE_(d), m: d || c, day: dayNo_(l.date), keys: keysOf_(l.ref, l.cheque_no, l.narration), used: !d && !c }; });
  var R = (railPays || []).map(function (r, k) { return { k: k, r: r, side: r.side, m: r.amount_minor, day: dayNo_(r.date), keys: keysOf_(r.ref, null, ''), used: false }; });
  var link = {}, how = {};
  var take = function (ss, rr, h) { ss.forEach(function (s) { s.used = true; link[s.i] = rr.map(function (x) { return x.r; }); how[s.i] = h; }); rr.forEach(function (x) { x.used = true; }); };
  var near = function (a, b) { return Math.abs(a.day - b.day); };
  /* (a) the reference */
  S.forEach(function (s) {
    if (s.used || !s.keys.length) return;
    var c = R.filter(function (x) { return !x.used && x.side === s.side && x.m === s.m && share_(s.keys, x.keys); }).sort(function (a, b) { return near(s, a) - near(s, b) || a.k - b.k; });
    if (c.length) take([s], [c[0]], 'ref');
  });
  /* (b) amount + date, each the other's only candidate */
  for (var again = true; again;) {
    again = false; var cand = {}, back = {};
    S.forEach(function (s) { if (s.used) return; cand[s.i] = R.filter(function (x) { return !x.used && x.side === s.side && x.m === s.m && near(s, x) <= win; }); cand[s.i].forEach(function (x) { (back[x.k] = back[x.k] || []).push(s); }); });
    S.forEach(function (s) { if (!s.used && cand[s.i] && cand[s.i].length === 1 && back[cand[s.i][0].k].length === 1 && !cand[s.i][0].used) { take([s], [cand[s.i][0]], 'amount+date'); again = true; } });
  }
  /* (c) one line = several advices · (d) one advice = several lines */
  S.forEach(function (s) {
    if (s.used) return;
    var pool = R.filter(function (x) { return !x.used && x.side === s.side && near(s, x) <= win; });
    var sub = subset_(pool, s.m); if (sub) take([s], sub, 'one-to-many');
  });
  R.forEach(function (x) {
    if (x.used) return;
    var pool = S.filter(function (s) { return !s.used && s.side === x.side && near(s, x) <= win; });
    var sub = subset_(pool, x.m); if (sub) take(sub, [x], 'many-to-one');
  });
  /* the ledger leg: match()'s pairs, and any ledger line that names the advice's chit or payment */
  var ledOf = {}, amb = {};
  (M.matched || []).forEach(function (g) { g.stmt.forEach(function (i) { ledOf[i] = { ids: g.ledger.slice(), how: g.how }; }); });
  (M.ambiguous || []).forEach(function (a) { amb[a.stmt] = a.candidates; });
  var byChit = {}; led.forEach(function (l) { [l.chit_id, l.source_chit_id, l.payment_id ? 'pay:' + l.payment_id : null].forEach(function (k) { if (k) (byChit[String(k)] = byChit[String(k)] || []).push(l.id); }); });
  var asks = {}; (o.asks || []).forEach(function (a) { if (a && a.key) asks[a.key] = a; });
  var counts = { settled: 0, told: 0, matched: 0, check: 0, asked: 0, suggested: 0, unexplained: 0, needs_you: 0 };
  var rows = lines.map(function (l, i) {
    var chits = link[i] || [], ids = ledOf[i] ? ledOf[i].ids.slice() : [];
    chits.forEach(function (r) { [r.chit_id, r.payment_id ? 'pay:' + r.payment_id : null].forEach(function (k) { (k && byChit[k] || []).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); }); }); });
    var row = { i: i, key: keys[i], chits: chits.map(function (r) { return r.chit_id; }), ledger: ids, how: how[i] || (ledOf[i] && ledOf[i].how) || null,
      bills: [].concat.apply([], chits.map(function (r) { return r.bills || []; })), party: chits.length ? chits[0].party : null, asked: asks[keys[i]] || null, suggestion: null };
    if (chits.length && ids.length) { row.state = 'settled'; row.next = 'accept'; }
    else if (chits.length) { row.state = 'told'; row.next = 'record'; }
    else if (ids.length) { row.state = 'matched'; row.next = 'accept'; }
    else if (amb[i]) { row.state = 'check'; row.next = 'choose'; row.candidates = amb[i]; }
    else {
      var sg = suggest(l, { parties: o.parties, learned: o.learned, bank: o.bank, rules: o.rules, pack: o.pack, country: o.country });
      row.suggestion = sg && sg.event ? sg : null;
      if (row.asked) { row.state = 'asked'; row.next = 'wait'; }
      else if (row.suggestion) { row.state = 'suggested'; row.next = 'accept'; }
      else { row.state = 'unexplained'; row.next = 'ask'; }
    }
    counts[row.state]++;
    return row;
  });
  counts.needs_you = counts.check + counts.suggested + counts.unexplained;
  var from = lines.reduce(function (a, l) { return !a || l.date < a ? l.date : a; }, null), to = lines.reduce(function (a, l) { return !a || l.date > a ? l.date : a; }, null);
  var inside = function (r) { var d = dayNo_(r.date); return !from || (d >= dayNo_(from) - win && d <= dayNo_(to) + win); };
  return { rows: rows, rail_only: R.filter(function (x) { return !x.used && inside(x.r); }).map(function (x) { return x.r; }),
    unmatched_ledger: M.unmatched_ledger, ambiguous: M.ambiguous, counts: counts };
}
var MON3_ = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function dayWords_(d) { var s = dateOf_(d); return s ? (+s.slice(8, 10)) + ' ' + MON3_[+s.slice(5, 7) - 1] + ' ' + s.slice(0, 4) : ''; }
/** an amount for words: the currency CODE and the figure in the pack's number format (money.format's rule: the code, never a guessed symbol) */
function amountWords_(minor, cur, pk) {
  var dp = dp_(cur), loc = (pk && pk.locale && pk.locale.format) || 'en-US';
  var v = (minor / Math.pow(10, dp));
  var txt; try { txt = v.toLocaleString(loc, { minimumFractionDigits: dp, maximumFractionDigits: dp }); } catch (_) { txt = v.toFixed(dp); }
  return (cur ? cur + ' ' : '') + txt;
}
/**
 * ⭐ ask(line, { party: { id, name }, currency, me?, key?, pack?, country? }) → { ok, words, body } | { ok: false, why }
 *   The question a line nobody explained puts to the other party ON THE RAIL: "<CUR> 4,200.00 came into our bank on 12 Oct 2026, ref R —
 *   which bill is it for?" `body` is the chit send body (POST /api/chits/send): purpose 'general', client_ref 'bankask:<key>' (a retry answers
 *   the first chit), business_json { kind: 'bank_query', currency, bank_query: { key, side, amount_minor, currency, date, ref, words } }.
 *   ⭐ ONLY THREE FACTS TRAVEL — the date, the amount and the reference. The narration (and the rest of the statement) never leaves the device.
 *   Their answer is the payment advice they already send (M30), carrying the reference: explain() then settles the line by 'ref' — in both books.
 */
function ask(line, opts) {
  var o = opts || {}, l = line || {}, d = +l.debit_minor || 0, c = +l.credit_minor || 0;
  if ((d > 0) === (c > 0)) return { ok: false, why: 'a statement line has money going one way' };
  if (!o.party || !o.party.id) return { ok: false, why: 'choose who to ask' };
  var bk = bankOf_(o), pk = bk ? bk.pack : null, cur = String(o.currency || (pk && pk.currency) || '').toUpperCase() || null;
  var key = o.key || lineKey(l), ref = l.ref || l.cheque_no || null, m = d || c, side = SIDE_(d);
  var amt = amountWords_(m, cur, pk), day = dayWords_(l.date);
  var words = !d
    ? amt + ' came into ' + (o.me ? o.me + "'s" : 'our') + ' bank on ' + day + (ref ? ', ref ' + ref : '') + ' — which bill is it for? Send the payment advice and both books settle.'
    : amt + ' went from ' + (o.me ? o.me + "'s" : 'our') + ' bank to you on ' + day + (ref ? ', ref ' + ref : '') + ' — which bill was it for? Send the receipt advice and both books settle.';
  return { ok: true, words: words, key: key, body: {
    recipients: [{ entity_id: o.party.id, role: 'to' }], purpose: 'general', manual_subject: 'Bank line ' + day + ' — which bill?', client_ref: 'bankask:' + key,
    message: words, business_json: { kind: QUERY_KIND, currency: cur, bank_query: { key: key, side: side, amount_minor: m, currency: cur, date: l.date || null, ref: ref, words: words } } } };
}
/* the words a bank prints around a name — never what identifies a payer: these neutral ones, and every word of the PACK's own bank keywords
   (its transfer rails, charges, …) and amount prefixes, so a country's rails stay in its pack */
var GENERIC_ = ['TO', 'BY', 'FROM', 'CR', 'DR', 'PAYMENT', 'PAID', 'REF', 'TRANSFER', 'TRF', 'DEPOSIT', 'DEP', 'CREDIT', 'DEBIT', 'POS', 'TXN', 'BANK',
  'THE', 'AND', 'FOR', 'CHQ', 'CHEQUE', 'CLG', 'ACH', 'ECS', 'MB', 'IB', 'INB', 'INF', 'BIL', 'ONL', 'CMS', 'PART'];
function bankWords_(pk) {
  var b = (pk && pk.bank) || {}, kw = b.keywords || {}, out = GENERIC_.slice();
  var add = function (w) { String(w).toUpperCase().split(/[^A-Z0-9&]+/).forEach(function (x) { if (x && out.indexOf(x) < 0) out.push(x); }); };
  Object.keys(kw).forEach(function (bank) { Object.keys(kw[bank] || {}).forEach(function (k) { (kw[bank][k] || []).forEach(add); }); });
  (b.amountPrefixes || []).forEach(add); if (pk && pk.currency) add(pk.currency);
  return out;
}
/** what identifies the payer in a narration: a VPA-style handle (lower-case) when there is one, else the first two words that are not the bank's own */
function tokenOf_(narration, pk) {
  var t = String(narration || ''), v = /[a-z0-9._]{2,}@[a-z][a-z0-9.]{1,}/i.exec(t);
  if (v) return v[0].toLowerCase();
  var gen = bankWords_(pk);
  var ws = t.toUpperCase().split(/[^A-Z0-9&]+/).filter(function (w) { return w.length >= 3 && !/\d/.test(w) && gen.indexOf(w) < 0; });
  return ws.length ? ws.slice(0, 2).join(' ') : null;
}
function learnedFor_(line, rules, out) {
  if (!rules || !rules.length) return null;
  var low = String(line.narration || '').toLowerCase(), up = String(line.narration || '').toUpperCase(), best = null;
  rules.forEach(function (r) {
    if (!r || !r.has || (r.side && r.side !== SIDE_(out))) return;
    /* every word of the rule, each a whole word, in any order: "KUMAR SONS" (the bank's "AND" left out when it was learned) finds "KUMAR AND SONS" */
    var hit = r.has.indexOf('@') >= 0 ? low.indexOf(r.has) >= 0 : String(r.has).split(/\s+/).every(function (w) { return hasWord_(up, [w]) !== null; });
    if (!hit) return;
    if (!best || r.has.length > best.has.length || (r.has.length === best.has.length && String((r.source || {}).at || '') > String((best.source || {}).at || ''))) best = r;
  });
  return best;
}
/**
 * ⭐ learn(line, { party?, party_name?, event?, label? }, { at?, by? }) → { ok, rule } | { ok: false, why }
 *   A person's confirmed explanation of a line becomes a rule: "a narration with <has> → party P (or the event / ledger given)". It is used ONLY
 *   as a suggestion (suggest opts.learned) and always shown with `source` — the line's date, the first 60 characters of its narration, when and
 *   by whom it was taught. `has` is a handle (name@bank) in the narration, else its first two words that are not the bank's own (the pack's keywords).
 *   meta = { at?, by?, pack?, country? } — the pack whose bank words are left out (the default pack when none).
 */
function learn(line, x, meta) {
  var l = line || {}, e = x || {}, mt = meta || {}, d = +l.debit_minor || 0, c = +l.credit_minor || 0;
  if ((d > 0) === (c > 0)) return { ok: false, why: 'a statement line has money going one way' };
  if (!e.party && !e.event) return { ok: false, why: 'nothing to learn — no party and no entry were confirmed' };
  var bk = bankOf_(mt), has = tokenOf_(l.narration, bk ? bk.pack : null);
  if (!has) return { ok: false, why: 'the narration has no word that names who paid' };
  var side = SIDE_(d);
  return { ok: true, rule: { id: side + ':' + has.replace(/\s+/g, '_'), has: has, side: side, party: e.party || null, party_name: e.party_name || null, label: e.label || null,
    event: e.event ? JSON.parse(JSON.stringify(e.event)) : null, source: { date: l.date || null, narration: String(l.narration || '').slice(0, 60), at: mt.at || null, by: mt.by || null } } };
}
/**
 * ⭐ step(state, action) → the next state (a new object; the one given is not touched). The device's marks for a statement:
 *   { accepted: { key: { how, chits, ledger, at, by } }, notes: { key: [{ text, at, by }] }, files: { key: [{ name, ref, at }] }, log: [{ act, key, at }] }
 *   accept {key, how?, chits?, ledger?, at?, by?} — a note NEVER blocks it · undo {key} — takes the accept back and KEEPS the notes and files ·
 *   note {key, text} · attach {key, name, ref}. An unknown action or a missing key leaves the state as it was (and says why).
 */
function step(state, action) {
  var s = JSON.parse(JSON.stringify(state || {})), a = action || {};
  s.accepted = s.accepted || {}; s.notes = s.notes || {}; s.files = s.files || {}; s.log = s.log || [];
  delete s.why;
  if (!a.key) { s.why = 'no line key'; return s; }
  var k = String(a.key);
  if (a.act === 'accept') s.accepted[k] = { how: a.how || null, chits: a.chits || [], ledger: a.ledger || [], at: a.at || null, by: a.by || null };
  else if (a.act === 'undo') { if (!s.accepted[k]) { s.why = 'that line was not accepted'; return s; } delete s.accepted[k]; }
  else if (a.act === 'note') { var t = String(a.text || '').trim(); if (!t) { s.why = 'an empty note'; return s; } (s.notes[k] = s.notes[k] || []).push({ text: t.slice(0, 500), at: a.at || null, by: a.by || null }); }
  else if (a.act === 'attach') { if (!a.name) { s.why = 'a file needs a name'; return s; } (s.files[k] = s.files[k] || []).push({ name: String(a.name), ref: a.ref || null, at: a.at || null }); }
  else { s.why = 'unknown action'; return s; }
  s.log.push({ act: a.act, key: k, at: a.at || null });
  return s;
}

var EXPORTS = { parse: parse, match: match, suggest: suggest, brs: brs, PRESETS: PRESETS, RULES: RULES,
  railPayments: railPayments, explain: explain, lineKey: lineKey, ask: ask, learn: learn, step: step };   /* the last two are the default pack's tables, unchanged */

/* ⭐ ONE FILE, EVERY HOST: node takes module.exports; a page takes window.CBBankRecon. */
if (typeof module !== 'undefined' && module.exports) module.exports = EXPORTS;
if (root && typeof root.window !== 'undefined') root.window.CBBankRecon = EXPORTS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
