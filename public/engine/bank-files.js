/* ADOPTED from chitbridge-engines v1.99.0 · bank-files · sha256 898144e459c5cb4a07f0e524c3f98b1b8d690c3beae34af6ac42b9d6100a0dbe — DO NOT EDIT HERE. Change it in chitbridge-engines, release a version, then run tools/adopt.cjs. */
/* chitbridge-engines · bank-files. Edited ONLY in chitbridge-engines/src/bank-files.js; every platform adopts a released version of it. */
/*
 * OWNS      reading an OFX (v1 SGML, v2 XML), QFX or QIF bank statement into statement lines, and telling those files from the others by their first words.
 * CALLED BY bank-recon.js parse (the one caller; it hands in ctx with its own ymd / minorOf / fail and the currency, so the date and amount readers stay written once). Athi, 19 Nov 2026: no bank feed, more statement FILE formats.
 * FLOW      text ──▶ parseOfx | parseQif (text, ctx) ──▶ { ok, lines, warnings, account?, closing_minor? } or a refusal in plain words; a row that cannot be read is skipped and warned by its number. MT940 and CAMT.053 are next.
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 */
(function (root) {
  'use strict';
  // @stage tested
  // @stage-note The OFX / QFX / QIF half of the statement reader. Pure: no I/O, no clock.
  var XML_ENTITIES_ = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
  var unEntity_ = function (value) {
    return String(value).replace(/&(?:amp|lt|gt|quot|apos);/g, function (found) {
      return XML_ENTITIES_[found];
    });
  };
  /** a plain decimal figure with a dot (OFX, QIF: no comma decimals — "12,50" is refused, never read as 1250); QIF may group thousands with commas */
  function plainAmount_(ctx, printed, allowGrouping) {
    var text = String(printed == null ? '' : printed).trim().replace(/^\+/, ''),
      sign = text[0] === '-' ? -1 : 1,
      digits = text.replace(/^-/, '');
    if (!(allowGrouping ? /^(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/ : /^\d+(\.\d+)?$/).test(digits)) return null;
    var minor = ctx.minorOf(digits, ctx.dp === undefined ? 2 : ctx.dp);
    return minor === null ? null : { minor: minor, neg: sign < 0 };
  }
  /** a statement row from a signed amount: money out is a debit, money in a credit */
  function signedLine_(date, narration, amount, no) {
    return { date: date, narration: narration, debit_minor: amount.neg ? amount.minor : 0, credit_minor: amount.neg ? 0 : amount.minor, row: no };
  }
  var joinWords_ = function (first, second) {
    return [first, second && second !== first ? second : ''].filter(Boolean).join(' ');
  };
  /** an OFX date (YYYYMMDD[HHMMSS…]) → 'YYYY-MM-DD', or null */
  function ofxDay_(text, ctx) {
    return /^\d{8}/.test(text || '') ? ctx.ymd(+text.slice(0, 4), +text.slice(4, 6), +text.slice(6, 8)) : null;
  }
  /** OFX v1 (SGML, tags left open) and v2 (XML) read the same way: `<TAG>value` runs to the next `<`; a QFX is an OFX with Intuit's extra tags */
  function parseOfx_(text, ctx) {
    var warnings = [],
      lines = [],
      seen = {},
      accounts = {},
      account = null,
      currency = null,
      closing = null,
      txn = null,
      inBalance = false,
      tokens = /<(\/?)([A-Za-z0-9.]+)>([^<]*)/g,
      token;
    function flush() {
      if (!txn) return;
      var date = ofxDay_(txn.DTPOSTED, ctx),
        amount = plainAmount_(ctx, txn.TRNAMT, false),
        no = lines.length + 1;
      if (!date) warnings.push('transaction ' + no + ': unreadable date — skipped');
      else if (!amount) warnings.push('transaction ' + no + ': unreadable amount "' + (txn.TRNAMT || '') + '" — skipped');
      else addOfxLine_(txn, date, amount, no, lines, seen, warnings, ctx);
      txn = null;
    }
    while ((token = tokens.exec(text))) {
      var closes = token[1] === '/',
        tag = token[2].toUpperCase(),
        value = unEntity_(token[3].trim());
      if (tag === 'STMTTRN') {
        flush();
        if (!closes) txn = {};
      } else if (txn && !closes && value && !/^(BANKACCTTO|CCACCTTO)$/.test(tag)) txn[tag] = value;
      else if (tag === 'LEDGERBAL') inBalance = !closes;
      else if (inBalance && tag === 'BALAMT' && value) closing = plainAmount_(ctx, value, false);
      else if (!txn && tag === 'ACCTID' && value) {
        accounts[value] = true;
        account = account || value;
      } else if (!txn && tag === 'CURDEF' && value) currency = value.toUpperCase();
    }
    flush();
    if (Object.keys(accounts).length > 1) return ctx.fail('This file holds more than one account (' + Object.keys(accounts).join(', ') + '). Download one account at a time.');
    if (currency && ctx.cur && currency !== ctx.cur) return ctx.fail('This statement is in ' + currency + ' but this business keeps its books in ' + ctx.cur + '. It was not read.');
    if (!lines.length && !/<STMTTRN>/i.test(text)) return ctx.fail('No transactions found in the OFX file.');
    var out = { ok: true, account: account, lines: lines, warnings: warnings };
    if (closing) out.closing_minor = closing.neg ? -closing.minor : closing.minor;
    return out;
  }
  /** one OFX transaction → a statement line, the FITID riding as `ref`; a FITID seen again with the same day and amount is the same transaction, kept once */
  function addOfxLine_(txn, date, amount, no, lines, seen, warnings, ctx) {
    var line = signedLine_(date, joinWords_(txn.NAME || txn.PAYEE || '', txn.MEMO || ''), amount, no),
      id = txn.FITID || '',
      sameAs = id && seen[id];
    if (sameAs && sameAs.date === date && sameAs.minor === amount.minor && sameAs.neg === amount.neg) return warnings.push('transaction id ' + id + ' appears twice with the same day and amount — kept once');
    if (sameAs) warnings.push('transaction id ' + id + ' is used by two different transactions — both kept');
    if (id) seen[id] = { date: date, minor: amount.minor, neg: amount.neg };
    if (id || txn.REFNUM) line.ref = id || txn.REFNUM;
    if (txn.CHECKNUM) line.cheque_no = txn.CHECKNUM;
    var valueDay = ofxDay_(txn.DTUSER, ctx);
    if (valueDay) line.value_date = valueDay;
    lines.push(line);
  }
  /** the day-month-year order of a QIF's dates when the file itself shows it (a part above 12), the person's choice, or '' when it cannot be told */
  function qifOrder_(triples, apostrophe, chosen) {
    if (chosen === 'dmy' || chosen === 'mdy') return chosen;
    var firstBig = triples.some(function (parts) {
        return parts[0] > 12;
      }),
      secondBig = triples.some(function (parts) {
        return parts[1] > 12;
      });
    if (firstBig && secondBig) return '';
    if (firstBig) return 'dmy';
    if (secondBig) return 'mdy';
    if (apostrophe) return 'mdy'; /* Quicken's own form, m/d'yy */
    return triples.every(function (parts) {
      return parts[0] === parts[1];
    })
      ? 'dmy'
      : '';
  }
  /** a QIF text → its records (one-letter fields up to a ^) and the account type it names (null when none) */
  function qifRecords_(text) {
    var records = [],
      current = {},
      kind = null;
    text.split(/\r\n|\r|\n/).forEach(function (raw) {
      var row = raw.replace(/\s+$/, '');
      if (!row) return;
      if (row[0] === '!') {
        var header = /^!Type:\s*(.*)$/i.exec(row);
        if (header) kind = header[1].trim().toLowerCase();
      } else if (row[0] === '^') {
        if (Object.keys(current).length && (kind === null || /^(bank|ccard|cash)$/.test(kind))) records.push(current);
        current = {};
      } else if (/^[DTPMNU]$/.test(row[0]) && current[row[0]] === undefined) current[row[0]] = row.slice(1).trim();
    });
    return { records: records, kind: kind };
  }
  /** QIF: the date has no marker for day-first or month-first — a file that cannot be told is refused, never guessed */
  function parseQif_(text, options, ctx) {
    var read = qifRecords_(text),
      records = read.records,
      warnings = [],
      triples = [],
      apostrophe = false;
    if (read.kind !== null && !/^(bank|ccard|cash)$/.test(read.kind)) return ctx.fail('This QIF holds "' + read.kind + '" records, not a bank statement.');
    if (!records.length) return ctx.fail('No transactions found in the QIF file.');
    records.forEach(function (record) {
      var found = /^(\d{1,4})\s*([\/\-.'])\s*(\d{1,2})\s*[\/\-.']\s*(\d{1,4})$/.exec(record.D || '');
      if (found && found[2] === "'") apostrophe = true;
      record.parts = found ? [+found[1], +found[3], +found[4], found[1].length === 4] : null;
      if (record.parts) triples.push(record.parts);
    });
    var isoDates = triples.length > 0 && triples.every(function (parts) { return parts[3]; });
    var order = isoDates ? 'iso' : qifOrder_(triples, apostrophe, options.dateOrder);
    if (triples.length && !order)
      return ctx.fail(
        'The dates in this QIF file could mean day/month or month/day, and the file does not say which. It was not read, so nothing is guessed. Export it as OFX or CSV, or say which order the bank uses.'
      );
    var lines = [];
    records.forEach(function (record, index) {
      var no = index + 1,
        date = qifDay_(record.parts, order, ctx),
        amount = plainAmount_(ctx, record.T, true);
      if (!date) return warnings.push('record ' + no + ': unreadable date "' + (record.D || '') + '" — skipped');
      if (!amount) return warnings.push('record ' + no + ': unreadable amount "' + (record.T || '') + '" — skipped');
      var line = signedLine_(date, joinWords_(record.P || '', record.M || ''), amount, no);
      if (record.N) line.cheque_no = record.N;
      lines.push(line);
    });
    warnings.push('a QIF carries no balance and no bank id, so the running balance cannot be checked');
    return { ok: true, account: null, lines: lines, warnings: warnings };
  }
  /** a QIF date's three numbers read in the file's order → 'YYYY-MM-DD', or null */
  function qifDay_(parts, order, ctx) {
    if (!parts) return null;
    if (order === 'iso') return ctx.ymd(parts[0], parts[1], parts[2]);
    var year = parts[2] < 100 ? 2000 + parts[2] : parts[2];
    return order === 'dmy' ? ctx.ymd(year, parts[1], parts[0]) : ctx.ymd(year, parts[0], parts[1]);
  }

  /** the file's format from its first words: OFX / QFX (header or <OFX>), QIF (!Type), else '' (the caller decides: JSON or CSV) */
  function sniff(text) {
    var head = String(text).replace(/^\uFEFF/, '').trimStart();
    if (/^OFXHEADER:/i.test(head) || /<OFX[\s>]/i.test(head.slice(0, 2000))) return 'ofx';
    if (/^!(Type|Account|Option|Clear)/i.test(head)) return 'qif';
    return '';
  }
  var EXPORTS = { parseOfx: parseOfx_, parseQif: parseQif_, sniff: sniff };
  /* ⭐ ONE FILE, EVERY HOST: node takes module.exports; a page takes window.CBBankFiles. */
  if (typeof module !== 'undefined' && module.exports) module.exports = EXPORTS;
  if (root && typeof root.window !== 'undefined') root.window.CBBankFiles = EXPORTS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
