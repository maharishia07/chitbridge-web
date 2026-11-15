/* ADOPTED from chitbridge-engines v1.97.0 · bank-statement-check · sha256 04006dac3c80e836e50f14189d8e5bfe886d2c314ee0488144a39ce36fec3f8f — DO NOT EDIT HERE. Change it in chitbridge-engines, release a version, then run tools/adopt.cjs. */
/**
 * bank-statement-check.js: "IS THIS THE RIGHT STATEMENT?" — the questions asked BEFORE any line of a bank statement is worked. PURE: no I/O, no clock (today is an argument), nothing saved.
 * OWNS check (account · continuity · overlap and gap · date sanity · what is already done) · maskAccount.
 * CALLED BY the web preview (public/app/bank-preview.js): the no-login demo page and the in-app bank screen call the SAME function, then bank-project.project().
 * FLOW bank statement → books: parse → CHECK (here: the right statement?) → match → suggest → project → confirm → post. CARD 16-finance/bank-reconciliation-and-bank-rail.
 * ONE calculation: it computes NO balance. Opening, closing and the books' balance arrive as carried figures (the ledger read, the bank_rec_log rows, the demo's sample state) and are only COMPARED
 * with money.js (minusMoney, which refuses a currency mismatch). Every figure it returns is a money value { amount_minor, currency }.
 * ⭐ An account number leaves this module MASKED (last 4), in `account` and in every sentence; the full number is never returned.
 * Levels: refuse (stop; `override` true = the owner may confirm it by its code) · confirm (the owner ticks its code) · warn (shown) · info (shown). verdict 'refuse' | 'confirm' | 'go'.
 */
(function (root) {
  'use strict';
  var DEPS_ = {};
  /** a sibling engine, from node or from the page's global; null when it would not load */
  function dep_(file, globalName) {
    if (DEPS_[file]) return DEPS_[file];
    var scope = typeof globalThis !== 'undefined' ? globalThis : root;
    if (scope[globalName] && typeof scope[globalName] === 'object' && Object.keys(scope[globalName]).length) return (DEPS_[file] = scope[globalName]);
    if (typeof require === 'function') {
      try {
        return (DEPS_[file] = require(file));
      } catch (loadFailure) {
        return null;
      }
    }
    return null;
  }
  var MONTHS_ = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAY_ = 86400000;

  /* ═══ the account ═══════════════════════════════════════════════════════════════════════════════════════════════ */
  /** an account number as letters and digits only (a mask character kept), upper case */
  function clean_(number) {
    return String(number == null ? '' : number).replace(/[^A-Za-z0-9*•]/g, '').toUpperCase();
  }
  /** a number whose front is hidden by the bank (****1234, XXXX1234) */
  function isMasked_(number) {
    return /[*•]|^X{2,}/.test(clean_(number));
  }
  /** the last four letters and digits */
  function tail_(number) {
    return clean_(number).replace(/[*•]/g, '').slice(-4);
  }
  /** maskAccount(number) → '****1234': the last four only; '' when there is no number */
  function maskAccount(number) {
    var tail = tail_(number);
    return tail ? '****' + tail : '';
  }
  /** two numbers name the same account: equal, or, when either is masked, the same last four */
  function sameAccount_(a, b) {
    if (!clean_(a) || !clean_(b)) return false;
    if (isMasked_(a) || isMasked_(b)) return tail_(a) === tail_(b);
    return clean_(a) === clean_(b);
  }
  function item_(code, level, why, extra) {
    return Object.assign({ code: code, level: level, why: why, confirmed: false }, extra || {});
  }
  function labelOf_(one) {
    return one.name ? one.name + ' ' + maskAccount(one.number) : maskAccount(one.number);
  }
  /** the account question: which of the shop's bank accounts is this statement for. → { account, items, key } (key = what the line fingerprint uses) */
  function accountPart_(input, statement) {
    var accounts = input.accounts || [],
      items = [],
      mask = maskAccount(statement.account),
      listed = accounts.map(labelOf_).join(', ');
    var out = { id: null, name: null, masked: mask || null, how: 'unknown', remember: false };
    if (!accounts.length) {
      items.push(item_('no_bank_account', 'refuse', 'Your books have no bank account yet, so a statement cannot be checked. Add the bank account first.', { override: false }));
      return { account: out, items: items, key: statement.account || '' };
    }
    var asked = String(input.chosen_account_id || input.saved_account_id || '');
    var chosen = accounts.filter(function (one) {
      return asked && String(one.id) === asked;
    })[0];
    var matched = clean_(statement.account)
      ? accounts.filter(function (one) {
          return sameAccount_(statement.account, one.number);
        })
      : [];
    var allNumbered = accounts.every(function (one) {
      return clean_(one.number);
    });
    if (matched.length === 1 || (matched.length > 1 && chosen && matched.indexOf(chosen) >= 0)) {
      var one = matched.length === 1 ? matched[0] : chosen;
      Object.assign(out, { id: one.id, name: one.name || null, how: 'matched' });
    } else if (clean_(statement.account) && allNumbered && !matched.length) {
      items.push(
        item_('account_mismatch', 'refuse', 'This statement is for account ' + mask + '; your bank account is ' + listed + '.', {
          override: false,
          statement_account: mask,
          your_accounts: accounts.map(function (each) {
            return maskAccount(each.number);
          })
        })
      );
    } else if (chosen) {
      Object.assign(out, { id: chosen.id, name: chosen.name || null, how: 'chosen', remember: !!input.chosen_account_id && String(input.chosen_account_id) !== String(input.saved_account_id || '') });
    } else {
      items.push(
        item_('account_unknown', 'confirm', (mask ? 'This statement is for account ' + mask + ', which is not on file. ' : 'This statement does not say which account it is. ') + 'Pick which bank account it is: ' + listed + '.', {
          choose_from: accounts.map(function (each) {
            return { id: each.id, name: each.name || null, masked: maskAccount(each.number) || null };
          })
        })
      );
    }
    return { account: out, items: items, key: statement.account || (out.id != null ? String(out.id) : '') };
  }

  /* ═══ dates ═════════════════════════════════════════════════════════════════════════════════════════════════════ */
  function dayNo_(iso) {
    var parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return parts ? Date.UTC(+parts[1], +parts[2] - 1, +parts[3]) / DAY_ : null;
  }
  /** '2026-10-19' → '19 Oct 2026' */
  function dayText_(iso) {
    var parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return parts ? +parts[3] + ' ' + MONTHS_[+parts[2] - 1] + ' ' + parts[1] : String(iso || '');
  }
  function periodText_(from, to) {
    return dayText_(from) + ' to ' + dayText_(to);
  }
  function madeText_(row) {
    return (row.made_at ? ' on ' + dayText_(String(row.made_at).slice(0, 10)) : '') + (row.made_by ? ' by ' + row.made_by : '');
  }
  function reconciledOf_(row) {
    return { from: row.period_from, to: row.period_to, at: row.made_at || null, by: row.made_by || null };
  }
  /** the newest reconciled period that ended before `from` */
  function lastBefore_(rows, from) {
    return rows
      .filter(function (row) {
        return row.period_to && from && row.period_to < from;
      })
      .sort(function (a, b) {
        return a.period_to < b.period_to ? 1 : -1;
      })[0];
  }

  /* ═══ the checks ════════════════════════════════════════════════════════════════════════════════════════════════ */
  /** the statement's currency against the account's, in the one wording bank-project uses, else null */
  function currencyItem_(input, statement) {
    var project = dep_('./bank-project', 'CBBankProject');
    if (!project || !project.currencyRefusal) return null;
    var no = project.currencyRefusal({ currency: input.currency, statement: { currency: statement.currency } });
    return no ? item_(no.code, 'refuse', no.why, { override: false }) : null;
  }
  /** the log rows (bank_rec_log kind 'statement') in the account's currency; a row in another currency is named as an info item, never silently left out */
  function logRows_(input, items) {
    var rows = (input.log && input.log.statements) || [],
      same = [];
    rows.forEach(function (row) {
      if (row.currency && row.currency !== input.currency)
        items.push(item_('log_currency_mismatch', 'info', 'A reconciled statement of ' + periodText_(row.period_from, row.period_to) + ' is in ' + row.currency + ', not ' + input.currency + ', so it is not compared. Nothing is converted.'));
      else same.push(row);
    });
    return same;
  }
  function difference_(M, statementMinor, otherMinor, currency) {
    return M.minusMoney(M.makeMinor(statementMinor, currency), M.makeMinor(otherMinor, currency));
  }
  /** the opening against the last reconciled closing (before `from`) and against the books' balance the day before `from`; a difference is a confirm item that names it */
  function continuityItems_(M, input, statement, rows) {
    var items = [],
      currency = input.currency;
    if (statement.opening_minor == null) return [item_('opening_missing', 'info', 'The statement does not state its opening balance, so it cannot be compared with your books.')];
    var before = lastBefore_(rows, statement.from);
    if (before && before.closing_bank_minor != null && +before.closing_bank_minor !== +statement.opening_minor)
      items.push(
        item_('opening_not_last_closing', 'confirm', 'This statement opens at a different balance than the last reconciled statement closed (' + periodText_(before.period_from, before.period_to) + '). Say why before going on.', {
          difference: difference_(M, +statement.opening_minor, +before.closing_bank_minor, currency),
          last_closing: M.makeMinor(+before.closing_bank_minor, currency),
          opening: M.makeMinor(+statement.opening_minor, currency)
        })
      );
    var books = input.books || {};
    if (books.opening_minor != null && +books.opening_minor !== +statement.opening_minor)
      items.push(
        item_('opening_not_books', 'confirm', 'This statement opens at a different balance than your books show the day before it starts. Say why before going on.', {
          difference: difference_(M, +statement.opening_minor, +books.opening_minor, currency),
          books_balance: M.makeMinor(+books.opening_minor, currency),
          opening: M.makeMinor(+statement.opening_minor, currency)
        })
      );
    return items;
  }
  /** this period against the periods already reconciled: the same period or file again (a stop the owner may confirm), a partial overlap (confirm), a gap (shown) */
  function periodItems_(input, statement, rows) {
    var items = [],
      from = statement.from,
      to = statement.to;
    if (!from || !to) return items;
    rows.forEach(function (row) {
      var same = (row.period_from === from && row.period_to === to) || (input.file_hash && row.file_hash && row.file_hash === input.file_hash);
      if (same)
        items.push(item_('period_repeat', 'refuse', 'This statement (' + periodText_(row.period_from, row.period_to) + ') was already reconciled' + madeText_(row) + '. Loading it again does nothing new.', { override: true, reconciled: reconciledOf_(row) }));
      else if (row.period_from <= to && row.period_to >= from)
        items.push(item_('period_overlap', 'confirm', periodText_(row.period_from, row.period_to) + ' already reconciled' + madeText_(row) + '; this statement covers ' + periodText_(from, to) + '.', { reconciled: reconciledOf_(row) }));
    });
    var last = lastBefore_(rows, from),
      gap = last ? dayNo_(from) - dayNo_(last.period_to) - 1 : 0;
    if (last && gap > 0)
      items.push(
        item_('period_gap', 'warn', gap + (gap === 1 ? ' day' : ' days') + ' between the last reconciled statement (to ' + dayText_(last.period_to) + ') and this one (from ' + dayText_(from) + ') are not reconciled.', { gap_days: gap, from: last.period_to, to: from })
      );
    return items;
  }
  /** lines dated after today, or before the books start, named */
  function dateItems_(input, lines) {
    var items = [],
      today = input.today,
      start = input.books && input.books.start_date;
    var named = function (test) {
      return lines
        .map(function (line, at) {
          return { i: at, date: line.date };
        })
        .filter(function (one) {
          return one.date && test(one.date);
        });
    };
    var future = today
        ? named(function (date) {
            return date > today;
          })
        : [],
      early = start
        ? named(function (date) {
            return date < start;
          })
        : [];
    if (future.length) items.push(item_('future_dated_lines', 'confirm', future.length + (future.length === 1 ? ' line is' : ' lines are') + ' dated after today (' + dayText_(today) + '), the first on ' + dayText_(future[0].date) + '.', { lines: future }));
    if (early.length) items.push(item_('before_books_start', 'confirm', early.length + (early.length === 1 ? ' line is' : ' lines are') + ' dated before your books start (' + dayText_(start) + '), the first on ' + dayText_(early[0].date) + '.', { lines: early }));
    return items;
  }
  /** a stored ref without the api's 'manual:' prefix, so 'manual:bank:<fp>-<n>' and 'bank:<fp>-<n>' are one */
  function plainRef_(ref) {
    return String(ref || '').replace(/^manual:/, '');
  }
  /** per line: 'posted' (came from a bank statement, with when and by whom when known) · 'typed' (matched an entry typed in the books) · 'new'; and the whole-file answer */
  function alreadyPart_(input, lines, key) {
    var project = dep_('./bank-project', 'CBBankProject'),
      refs = project ? project.refsOf(lines, key, input.period_lines) : [],
      posted = {},
      matched = input.matched || [];
    Object.keys(input.posted || {}).forEach(function (ref) {
      posted[plainRef_(ref)] = input.posted[ref] || {};
    });
    var per = lines.map(function (line, at) {
      var hit = Object.prototype.hasOwnProperty.call(posted, refs[at]) ? posted[refs[at]] : null;
      if (hit) {
        var when = hit.at || hit.made_at,
          by = hit.by || hit.made_by;
        return {
          i: at,
          kind: 'posted',
          ref: refs[at],
          at: when || null,
          by: by || null,
          entry_no: hit.entry_no || null,
          why: 'posted from bank statement' + (when ? ' on ' + dayText_(String(when).slice(0, 10)) : '') + (by ? ' by ' + by : '') + ' (ref ' + refs[at] + ')'
        };
      }
      if (matched[at]) return { i: at, kind: 'typed', ref: refs[at], why: 'matched an entry typed in your books' };
      return { i: at, kind: 'new', ref: refs[at], why: null };
    });
    var done = per.filter(function (one) {
        return one.kind !== 'new';
      }).length,
      all = lines.length > 0 && done === lines.length;
    return { lines: lines.length, done: done, all: all, summary: all ? 'All ' + lines.length + (lines.length === 1 ? ' line is' : ' lines are') + ' already in your books. Nothing to do.' : null, per_line: per };
  }

  /**
   * ⭐ check(input) → { ok: true, verdict: 'refuse'|'confirm'|'go', account: { id, name, masked, how: 'matched'|'chosen'|'unknown', remember }, fingerprint_account, items: [{ code, level, why, confirmed, … }], pending: [code], already: { lines, done, all, summary, per_line } }
   *   input { currency, today, file_hash?, statement: { account?, from?, to?, opening_minor?, closing_minor?, currency }, lines, matched?: boolean[] (match() found it), period_lines?,
   *     accounts: [{ id, name?, number? }] (the shop's bank accounts), chosen_account_id? (this time), saved_account_id? (remembered), books: { opening_minor?, start_date? },
   *     log: { statements: [{ period_from, period_to, closing_bank_minor?, currency?, file_hash?, made_by?, made_at? }] } (GET /bank/log), posted?: { <client_ref>: { at, by, entry_no? } },
   *     confirmed?: [code] }
   *   confirmed clears a 'confirm' item and an overridable 'refuse' item (period_repeat); account_mismatch and a currency refusal cannot be confirmed.
   *   account.remember = the owner chose an account this time that is not the saved one: the page saves chosen_account_id (a setting) so the next file is not asked again.
   *   fingerprint_account = the chosen account's id when the statement has no number of its own (it feeds the fingerprint then); null when the statement's own number is the key (refs posted before stay the same; the number is never returned, the page already holds it). already.per_line[i].ref is each line's key either way.
   */
  function check(input) {
    var M = dep_('./money', 'CBMoney');
    if (!M || !M.makeMinor) return { ok: false, code: 'no_money_engine', why: 'The money engine is not loaded, so no amount can carry its currency.' };
    var given = input || {},
      statement = given.statement || {},
      lines = given.lines || [],
      confirmed = given.confirmed || [],
      money = currencyItem_(given, statement),
      part = accountPart_(given, statement),
      items = (money ? [money] : []).concat(part.items),
      rows = logRows_(given, items);
    if (!money) items = items.concat(continuityItems_(M, given, statement, rows));
    items = items.concat(periodItems_(given, statement, rows), dateItems_(given, lines));
    items.forEach(function (one) {
      if ((one.level === 'confirm' || (one.level === 'refuse' && one.override)) && confirmed.indexOf(one.code) >= 0) one.confirmed = true;
    });
    var open = items.filter(function (one) {
      return (one.level === 'confirm' || one.level === 'refuse') && !one.confirmed;
    });
    return {
      ok: true,
      verdict: open.some(function (one) {
        return one.level === 'refuse';
      })
        ? 'refuse'
        : open.length
          ? 'confirm'
          : 'go',
      account: part.account,
      fingerprint_account: statement.account ? null : part.key || null,
      items: items,
      pending: open.map(function (one) {
        return one.code;
      }),
      already: alreadyPart_(given, lines, part.key)
    };
  }

  var EXPORTS = { check: check, maskAccount: maskAccount };
  /* ⭐ ONE FILE, EVERY HOST: node takes module.exports; a page takes window.CBBankStatementCheck. */
  if (typeof module !== 'undefined' && module.exports) module.exports = EXPORTS;
  if (root && typeof root.window !== 'undefined') root.window.CBBankStatementCheck = EXPORTS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
