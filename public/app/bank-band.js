/* bank-band.js — THE BAND over a bank statement's lines: the ONE painter shared by the no-login demo, the owner's Bank page and the adviser's seat of the same page (W15-18 to W15-23, W15-27).
 * OWNS      the band's words and shape: the account named large, the statement period and the number of lines, the presentation currency said ONCE ("All amounts in Australian dollars (AUD)", IAS 1 para 51(d)-(e)),
 *           the "Right account?" line, three equal slim tiles (Statement · Your books · Difference), the "n lines to go" line under them and the "n of m in your books" progress bar.
 * CALLED BY public/app/bank-demo.js · public/app/cap-bank.js (bankFinish). Loaded after lab-kit.js (the tiles are CBLabKit.figure CMP060, the bar its .lk-bar).
 * FLOW      a host gathers CARRIED facts (the parse, the statement check, the engine's figures) → rightAccount(facts) → html(band) → the host puts the string in its slot.
 * ⭐ NO MONEY IS COMPUTED HERE. Every figure arrives as text its host made with the ONE money formatter; every "agrees" is a comparison of two carried figures or the engine check's own item. A fact the file or the books
 *   do not carry is said as "not in this file" (never assumed, never defaulted): an unknown stays unknown.
 * ⭐ THE ENGINE'S CHECK IS THE SOURCE where it ran (CBBankStatementCheck: account, opening against the books and against the last closing, overlap, gap); this file only words its items. Without it the host passes the plain facts.
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 * CONTROLS  CMP065 the bank band: D01 the band · D02 the right-account line · D03 the lines-to-go line (CMP060 the tiles, CMP021 the bar)
 */
(function (root) {
  'use strict';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var NO_PLURAL = { yen: 1, yuan: 1, won: 1, baht: 1, renminbi: 1 };
  function esc(value) {
    return typeof root.esc === 'function' ? root.esc(value) : String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; });
  }
  function T(text) {
    return typeof root.tx === 'function' ? root.tx(text) : text;
  }
  function many(count, one, other) {
    return count + ' ' + T(count === 1 ? one : other);
  }
  /** '2026-10-02' → '2 Oct 2026' */
  function dayText(iso) {
    var parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return parts ? +parts[3] + ' ' + MONTHS[+parts[2] - 1] + ' ' + parts[1] : String(iso || '');
  }
  /** the period as a person says it: "2 Oct to 31 Oct 2026" (the year once when both ends share it) */
  function periodText(from, to) {
    if (!from || !to) return '';
    var a = dayText(from),
      b = dayText(to);
    return a.slice(-4) === b.slice(-4) ? a.slice(0, -5) + ' ' + T('to') + ' ' + b : a + ' ' + T('to') + ' ' + b;
  }
  /** 'AUD' → "Australian dollars": the reader's own currency name (CBLocale.currencyName / Intl), the last word in lower case and plural */
  function currencyWords(code) {
    var name = code;
    try {
      name = (root.CBLocale && root.CBLocale.currencyName && root.CBLocale.currencyName(code)) || new Intl.DisplayNames(['en-AU'], { type: 'currency' }).of(code) || code;
    } catch (unavailable) {
      name = code;
    }
    if (name === code) return code;
    return String(name).replace(/(\S+)$/, function (last) {
      var low = last.toLowerCase();
      return NO_PLURAL[low] || /s$/.test(low) ? low : low + 's';
    });
  }
  /** the one currency line of the band: "All amounts in Australian dollars (AUD)" */
  function currencyLine(code) {
    return T('All amounts in') + ' ' + currencyWords(code) + ' (' + code + ')';
  }
  /* ── "Right account?": each fact as { id, state: 'ok' | 'bad' | 'none', text } ── */
  function item(id, state, text) {
    return { id: id, state: state, text: text };
  }
  /** the engine check's item of a code, or null */
  function checkItem(check, code) {
    return ((check && check.items) || []).filter(function (one) { return one.code === code; })[0] || null;
  }
  /** the line breaks the reader named while it checked the running balance */
  function balanceBreaks(parsed) {
    return ((parsed && parsed.warnings) || []).filter(function (words) { return /does not follow from the line before/.test(words); }).length;
  }
  /**
   * rightAccount(f) → [item]
   *   f.parsed {opening_minor, from, to, lines[], warnings[]} · f.check the engine's statement check (or null) · f.fmt(minor) the host's money text
   *   f.booksOpening_minor the books' balance the day before the statement starts, as carried (null when not read) · f.currency · f.statementCurrency
   *   f.accountNumber what the account HOLDS, masked ('****1234') or '' · f.previous { to, closing_minor, by } the last statement loaded before this one, or null
   */
  function rightAccount(f) {
    var parsed = f.parsed || {},
      lines = parsed.lines || [],
      out = [],
      check = f.check,
      books = f.booksOpening_minor;
    /* 1 · the opening against the books */
    if (parsed.opening_minor == null) out.push(item('opening', 'none', T('The file does not state its opening balance')));
    else if (checkItem(check, 'opening_not_books') || (!check && books != null && Number(books) !== Number(parsed.opening_minor)))
      out.push(item('opening', 'bad', T('Opening') + ' ' + f.fmt(parsed.opening_minor) + ' ' + T('differs from your books') + (books != null ? ' (' + f.fmt(books) + ')' : '')));
    else out.push(item('opening', 'ok', T('Opening') + ' ' + f.fmt(parsed.opening_minor) + ' ' + (books != null || check ? T('agrees with your books') : T('(worked from the file)'))));
    /* 2 · the running balance adds up line by line: the reader's own break warnings against the lines that carry a balance */
    var carry = lines.filter(function (line) { return line.balance_minor != null; }).length,
      breaks = balanceBreaks(parsed);
    if (!carry) out.push(item('running', 'none', T('The file has no running balance to check')));
    else if (breaks) out.push(item('running', 'bad', T('Balance breaks on') + ' ' + many(breaks, 'line', 'lines') + ' ' + T('of') + ' ' + carry + ' (' + T('a line may be missing') + ')'));
    else out.push(item('running', 'ok', T('Balance adds up on') + ' ' + carry + ' ' + T('of') + ' ' + carry + ' ' + T('lines')));
    /* 3 · the currency */
    var said = f.statementCurrency || parsed.currency || '';
    if (said && f.currency && said !== f.currency) out.push(item('currency', 'bad', T('The file is in') + ' ' + said + ', ' + T('the account in') + ' ' + f.currency));
    else out.push(item('currency', 'ok', T('Currency') + ' ' + (f.currency || said)));
    /* 4 · the account number: the file's tail against the one the account holds */
    var account = check && check.account,
      mismatch = checkItem(check, 'account_mismatch') || checkItem(check, 'account_unknown'),
      masked = (account && account.masked) || '';
    if (mismatch) out.push(item('number', 'bad', mismatch.why));
    else if (masked && f.accountNumber) out.push(item('number', 'ok', T('Account number') + ' ' + masked + ' ' + T('matches the account')));
    else if (masked) out.push(item('number', 'none', T('Account number') + ' ' + masked + ' ' + T('is in the file; the account holds none to compare')));
    else out.push(item('number', 'none', T('Account no.') + ': ' + T('not in this file')));
    /* 5 · the earlier statement: continuity */
    var gap = checkItem(check, 'period_gap'),
      overlap = checkItem(check, 'period_overlap') || checkItem(check, 'period_repeat'),
      lastClose = checkItem(check, 'opening_not_last_closing');
    if (overlap) out.push(item('previous', 'bad', overlap.why));
    else if (lastClose) out.push(item('previous', 'bad', lastClose.why));
    else if (gap) out.push(item('previous', 'bad', gap.why));
    else if (f.previous && f.previous.to) out.push(item('previous', 'ok', T('Follows the statement to') + ' ' + dayText(f.previous.to) + (f.previous.by ? ', ' + T('signed off by') + ' ' + f.previous.by : '')));
    else out.push(item('previous', 'none', T('No earlier statement')));
    return out;
  }
  var MARK = { ok: '✓', bad: '✕', none: '○' };
  /** the one small button that opens the "Right account?" facts (Fiori: the header stays one line; the detail is a press away). Open at once when any fact differs. */
  function toggleHtml(items, tid) {
    if (!items || !items.length) return '';
    var bad = items.some(function (one) { return one.state === 'bad'; }),
      agree = items.filter(function (one) { return one.state === 'ok'; }).length,
      open = items.length - agree;
    return '<button type="button" class="bb-rtoggle' + (bad ? ' bb-bad' : '') + '" data-bb-toggle aria-expanded="' + bad + '" data-testid="' + esc(tid) + '-toggle">' + esc(T('Right account?')) + ' ' + MARK.ok + ' ' + agree + (open ? ' · ' + (bad ? MARK.bad : MARK.none) + ' ' + open : '') + ' <span aria-hidden="true">▾</span></button>';
  }
  function rightHtml(items, tid, act) {
    var agree = items.filter(function (one) { return one.state === 'ok'; }).length,
      open = items.filter(function (one) { return one.state === 'none'; }).length;
    return (
      '<div class="bb-right' + (items.some(function (one) { return one.state === 'bad'; }) ? ' bb-has-bad' : '') + '"' + (items.some(function (one) { return one.state === 'bad'; }) ? '' : ' hidden') + ' data-cbsid="CMP065-D02" data-testid="' + esc(tid) + '" role="group" aria-label="' + esc(T('Right account?')) + '"><b>' + esc(T('Right account?')) + '</b>' +
      (agree ? '<span class="bb-sum bb-ok" data-testid="' + esc(tid) + '-agree">' + MARK.ok + ' ' + agree + ' ' + esc(T('agree')) + '</span>' : '') +
      (open ? '<span class="bb-sum bb-none" data-testid="' + esc(tid) + '-open">' + MARK.none + ' ' + open + ' ' + esc(T('not in the file')) + '</span>' : '') +
      items.map(function (one) {
        return '<span class="bb-chk bb-' + one.state + '" data-check="' + esc(one.id) + '" data-state="' + one.state + '"><span aria-hidden="true">' + MARK[one.state] + '</span> ' + esc(one.text) + '</span>';
      }).join('') + (act || '') + '</div>'
    );
  }
  /**
   * html(f) → the band
   *   f.account name · f.from · f.to · f.count lines · f.currency · f.change (html of the way back, "Wrong account? Change") · f.actions (html at the right of the figures: Add, Sign off, More)
   *   f.right [item] (rightAccount) · f.statement · f.books · f.difference (the host's money text, or '' when the statement's closing was not given)
   *   f.toGo · f.inBooks · f.total lines · f.unexplained (text shown only when it is not nil) · f.nil · f.tid (prefix of the testids)
   */
  function html(f) {
    var tid = f.tid || 'bank-band',
      label = f.labelKit || root.CBLabKit,
      nil = !!f.nil,
      tiles = '';
    if (f.statement != null && label && label.figure) {
      tiles =
        '<div class="bb-tiles" data-testid="' + esc(tid) + '-tiles">' +
        label.figure({ label: T('Statement'), value: f.statement, line: true }) +
        label.figure({ label: T('Your books'), value: f.books, line: true }) +
        label.figure({ label: T('Difference'), value: f.difference, line: true, loud: true, good: nil }) +
        '</div>';
    }
    var go = nil
        ? T('Nothing left to add')
        : many(f.toGo || 0, 'line to go', 'lines to go'),
      progress =
        f.total
          ? '<div class="bb-progress"><div class="lk-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + f.total + '" aria-valuenow="' + (f.inBooks || 0) + '" aria-label="' + esc((f.inBooks || 0) + ' ' + T('of') + ' ' + f.total + ' ' + T('in your books')) + '"><i style="width:' + Math.round(((f.inBooks || 0) / f.total) * 100) + '%"></i></div><span class="bb-pnote" data-testid="' + esc(tid) + '-progress">' + esc((f.inBooks || 0) + ' ' + T('of') + ' ' + f.total + ' ' + T('in your books')) + '</span></div>'
          : '';
    var curHtml = '<span class="bb-cur" data-testid="' + esc(tid) + '-currency">' + esc(currencyLine(f.currency || '')) + '</span>';
    return (
      '<section class="bb' + (nil ? ' bb-nil' : '') + '" data-cbsid="CMP065-D01" data-testid="' + esc(tid) + '" data-tied="' + nil + '" aria-label="' + esc(T('Bank statement')) + '">' +
      '<div class="bb-head"><h2 class="bb-name" data-testid="' + esc(tid) + '-account">' + esc(f.account || '') + '</h2>' +
      '<span class="bb-period" data-testid="' + esc(tid) + '-period">' + esc(periodText(f.from, f.to)) + (f.count != null ? ' · ' + esc(many(f.count, 'line', 'lines')) : '') + '</span>' +
      (f.change || '') + toggleHtml(f.right, tid) +
      (tiles ? '' : curHtml) +
      (f.actions ? '<span class="bb-acts">' + f.actions + '</span>' : '') + '</div>' +
      ((f.right && f.right.length) ? rightHtml(f.right, tid + '-right', f.rightAct) : '') +
      (tiles ? '<div class="bb-row2">' : '') + tiles +
      (tiles ? '<div class="bb-gorow"><span class="bb-go" data-cbsid="CMP065-D03" data-testid="' + esc(tid) + '-togo" aria-live="polite">' + esc(go) + (f.unexplained ? ' · ' + esc(T('Unexplained')) + ' ' + esc(f.unexplained) : '') + '</span>' + progress + '</div>' + curHtml + '</div>' : '') +
      '</section>'
    );
  }
  if (root.document && !root.CBBankBand) root.document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('[data-bb-toggle]');
    if (!button) return;
    var panel = button.closest('.bb').querySelector('.bb-right'),
      open = panel.hidden;
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  });
  root.CBBankBand = { html: html, rightAccount: rightAccount, periodText: periodText, currencyLine: currencyLine, currencyWords: currencyWords, dayText: dayText };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CBBankBand;
})(typeof globalThis !== 'undefined' ? globalThis : this);
