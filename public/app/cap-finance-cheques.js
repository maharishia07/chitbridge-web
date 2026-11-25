/* cap-finance-cheques.js — CB Finance · Cheques (round T3-P1-MONEY): the cheques in hand (received, and the ones you wrote), the steps the server
 * offers each, the post-dated ones to deposit said on top, and the owner's reminder — a switch for the shop, and "Remind me" on a cheque (a follow-up on
 * the party, due on the cheque's date — the bell sweeps what is due). Loaded by finance.html after cap-books.js and cap-finance.js. The workshop's
 * Ledger › Cheques keeps working on the very same functions.
 *
 * ⭐ REUSE (CLAUDE.md rule 1, named in the PR): bkChequesLoad · bkChequeKeep · bkChequeCols · bkChequeStepsHTML · bkChequeStep · bkChequeRepaint ·
 * bkPartyBillsHTML (cap-books.js — the workshop's cheque list, its steps and its next level, on CBList; nothing copied) · CBList.mount (the one list;
 * head.notices as the Cash tab) · bkMoney · bkDate · bkCur · bkPartyLabel (the M36 money unit, the M25 words) · CBAction (M64 — Save, Remind me) ·
 * api('booksCheques') (the existing route, widened: asOf · remind) · api('booksTermsSet') (the Terms tab's own write — the switch IS a shop term, one home) ·
 * api('crmFollowAdd') (CB CRM's follow-up — the existing reminder path) · finOff · finDenied · modal / closeModal (finance.html's sheet) · the page's
 * .tabs / .tag / .act (no new look).
 * ⭐ ONE CALCULATION (rule 2): no money or date is worked out here. Each cheque's `next` steps, each reminder's `state` (deposit_today ·
 * overdue_for_deposit · not_yet) and `asOf` are the SERVER's (engines receivables.pdcReminders · itemsOfCheque); a row paints them. A group's figure is
 * its row count — no sum.
 * ⭐ NEW PATHS (rule 4): FQ (this tab's state) · fqReminderSheet / fqSave (the switch: on/off + days ahead — no screen had one; it saves through
 * booksTermsSet) · fqRemindMe (Remind me: the follow-up's body comes from the cheque the server listed — party, day, sum — so there is nothing to type;
 * CRM's sheet lives in cap-crm.js, which this page does not load).
 * ⚠️ Never error.message on a screen: a failure says what happened and offers Try again. Finance SUGGESTS: the steps are the owner's to press.
 * OWNS      the Cheques tab of CB Finance: the cheques in hand and the steps the server offers each (fqLoad · fqMount), the post-dated reminder switch (fqReminderSheet · fqSave) and Remind me (fqRemindMe)
 * CALLED BY public/finance.html (script tag) · public/app/cap-finance.js (fqLoad · fqMount). The workshop's Ledger › Cheques shares the cap-books.js functions, not this file
 * FLOW  finance.html opens Cheques -> api(booksCheques) -> the list and the reminder switch -> a step, Remind me or Save asks the server and repaints
 * CARD 16-finance/cheques
 */
'use strict';

var FQ = { gen: 0, r: null, rows: [], pdc: {}, fu: {}, state: 'loading', api: null };
var FQ_STATE = { deposit_today: 'Deposit today', overdue_for_deposit: 'Overdue for deposit', not_yet: 'Post-dated' }; /* the server's codes, worded */
var FQ_SEE = 'Only the owner may see cheques.';
var FQ_NOT_YET = 'Arrives after the next update.'; /* the server predates the switch: `remind` is absent from its answer */

function fqCur() {
  return bkCur(FQ.r && FQ.r.currency);
}
/** the switch as the server last said it; `known` false until the api answers `remind` (the twin PR) */
function fqRemind() {
  var rm = FQ.r && FQ.r.remind;
  return rm ? Object.assign({ known: true }, rm) : { known: false, on: true, lead_days: 7, from: null, may_set: false, why_not: FQ_NOT_YET };
}

/** the Cheques page's read: the workshop's cheques kept in FQ with each post-dated one's reminder state; a late answer is dropped, and Ledger-off or not-allowed is said in the page's own words */
async function fqLoad(quiet) {
  var generation = ++FQ.gen;
  if (!quiet) {
    FQ.state = 'loading';
    if (FQ.api) FQ.api.refresh();
  }
  try {
    var loaded = await bkChequesLoad(); /* the workshop's own read: GET /api/books/cheques, each row kept in BK.cheques (the steps read it there) */
    if (generation !== FQ.gen) return;
    FQ.r = loaded || {};
    FQ.pdc = {};
    ((loaded && loaded.pdc_reminders) || []).forEach(function (x) {
      FQ.pdc[x.payment_id] = x;
    });
    /* the server's rows, in its order — never this session's leftovers (bkChequeList keeps a cleared one until the page reloads) */
    FQ.rows = ((loaded && loaded.cheques) || [])
      .map(function (item) {
        return BK.cheques[item.payment_id] || bkChequeKeep(item);
      })
      .filter(Boolean);
    FQ.state = 'ready';
    ftNav();
  } catch (e) {
    if (generation !== FQ.gen) return;
    if (e && e.status === 404) {
      finOff();
      return;
    } /* the Ledger is off for this shop (M212) */
    if (e && e.status === 403) {
      finDenied(FQ_SEE, 'Cheques');
      return;
    } /* the server said who may see it */
    FQ.state = 'error';
  }
  fqPaintTop();
  if (FQ.api) FQ.api.refresh();
}
function fqRetry() {
  fqLoad();
}

/* ── the strip on top: the switch (its state as a chip, the sheet behind one button) and the steps' outcome line ── */
function fqPaintTop() {
  var el = document.getElementById('fq_top');
  if (!el) return;
  var reminder = fqRemind(),
    word = !reminder.known ? tx('Not set') : reminder.on ? txf('On · {n} days ahead', { n: reminder.lead_days }) : tx('Off');
  el.innerHTML =
    '<div class="tabs" role="group" aria-label="' +
    esc(tx('Cheque reminders')) +
    '" style="margin:10px 20px 0;align-items:center">' +
    '<button data-cbsid="FIN006-B01" type="button" class="tab" data-testid="fq-switch" onclick="fqReminderSheet()">' +
    esc(tx('Reminders')) +
    '</button>' +
    '<span class="tag' +
    (reminder.known && reminder.on ? ' on' : '') +
    '" data-testid="fq-remind" data-on="' +
    (reminder.known ? String(!!reminder.on) : 'unknown') +
    '">' +
    esc(word) +
    '</span></div>' +
    '<div id="chq_out" data-testid="chq_out" role="status" style="color:var(--warn-2);font-size:var(--fs-1);margin:6px 20px 0;min-height:0"></div>';
}
/** the switch: on/off and the days ahead — the server's may_set greys Save WITH its sentence; before the twin lands, the same, in words */
function fqReminderSheet() {
  var reminder = fqRemind(),
    switchedOff = !reminder.may_set,
    reason = reminder.may_set ? '' : reminder.why_not || '';
  ui.dialog({
    mount: 'FIN006-U01',
    pop: 'POP108',
    titleText: tx('Cheque reminders'),
    titleTestid: 'fq-sheet-title',
    testid: 'fq-sheet',
    body:
      '<label style="flex-direction:row;align-items:center;gap:8px"><input data-cbsid="FIN006-I01" type="checkbox" id="fq_on" data-testid="fq-on"' +
      (reminder.on ? ' checked' : '') +
      (switchedOff ? ' disabled' : '') +
      '> ' +
      esc(tx('Remind me about post-dated cheques')) +
      '</label>' +
      '<label>' +
      esc(tx('Days ahead')) +
      '<input data-cbsid="FIN006-I02" class="inp" id="fq_days" data-testid="fq-days" inputmode="numeric" autocomplete="off" value="' +
      esc(String(reminder.lead_days)) +
      '"' +
      (switchedOff ? ' disabled' : '') +
      '></label>' +
      '<p class="hint">' +
      esc(tx('Said here, on Home, and as the follow-ups you set.')) +
      '</p>' +
      '<div id="fq_why" class="hint" role="status" data-testid="fq-why">' +
      esc(reason) +
      '</div>',
    footerHtml: fqSheetFoot(switchedOff)
  });
}
/** the sheet's footer: Cancel, and Save (greyed with the server's sentence when the shop may not set it) */
function fqSheetFoot(locked) {
  return (
    '<button data-cbsid="FIN006-B02" type="button" onclick="closeModal()">' +
    esc(tx('Cancel')) +
    '</button>' +
    '<button data-cbsid="FIN006-B03" type="button" class="pri" data-testid="fq-save"' +
    (locked ? ' disabled aria-disabled="true"' : '') +
    ' onclick="fqSave(this)">' +
    esc(tx('Save')) +
    '</button>'
  );
}
/** the reminder setting's Save: the days field must be digits (the range is the server's to say), then it is sent through CBAction */
function fqSave(btn) {
  var on = !!(document.getElementById('fq_on') || {}).checked,
    node = String((document.getElementById('fq_days') || {}).value || '').trim(),
    out = document.getElementById('fq_why');
  if (node !== '' && !/^\d+$/.test(node)) {
    if (out) out.textContent = tx('Numbers only, please');
    return;
  } /* the range is the server's to say */
  return CBAction.run(
    btn,
    function () {
      return api('booksTermsSet', { body: { pdc_remind: { on: on, lead_days: node === '' ? null : Number(node) } } });
    },
    {
      key: 'fq-save',
      out: 'fq_why',
      failed: tx('Could not save'),
      done: tx('Saved'),
      outcome: function () {
        closeModal();
        fqLoad(true);
      }
    }
  );
}

/* ── Remind me: a follow-up on the party, due on the cheque's date (overdue: due today), through CB CRM's own route ── */
function fqRemindMe(id, btn) {
  var cheque = BK.cheques[id],
    postDated = FQ.pdc[id];
  if (!cheque || !postDated || !cheque.party_id) return;
  var what =
    tx('Deposit cheque') + ' ' + (cheque.cheque_no || '') + ' · ' + bkMoney(cheque.amount_minor, cheque.currency || fqCur()) + ' · ' + bkPartyLabel(cheque.party_id, cheque.name);
  var dueAt = postDated.state === 'not_yet' ? postDated.cheque_date : (FQ.r && FQ.r.asOf) || postDated.cheque_date;
  return CBAction.run(
    btn,
    function () {
      return api('crmFollowAdd', { body: { party_id: cheque.party_id, what: what.slice(0, 300), due_at: dueAt, source: 'dues' } });
    },
    {
      key: 'fq-remind-' + id,
      out: 'chq_out',
      failed: tx('Could not set the reminder'),
      done: tx('Reminder set'),
      outcome: function (r) {
        FQ.fu[id] = (r && r.followup) || { due_at: dueAt };
        fqRepaint(id);
      }
    }
  );
}
/** flip the ROW's reminder cell — never the view */
function fqRepaint(id) {
  var c = BK.cheques[id];
  if (!c) return;
  var cell = document.querySelector('[data-testid="fq-due-' + id + '"]');
  if (cell) cell.innerHTML = fqDueCell(c);
}

/* ── the columns: the workshop's (party · cheque · dated · amount · status with the steps) plus the reminder — every word the server's ── */
function fqDueCell(cheque) {
  var postDated = FQ.pdc[cheque.payment_id],
    dash = '<span style="color:var(--grey)">—</span>';
  if (!postDated) return cheque.direction === 'out' ? '<span class="sub" data-b="written">' + esc(tx('Written by you')) + '</span>' : dash;
  /* the state as WORDS in the page's text colours (.late / .late.red carry AA in every theme — the Collections' Age words); a tinted chip read 3.5:1 in Dark */
  var stateClass = postDated.state === 'overdue_for_deposit' ? 'late red' : postDated.state === 'deposit_today' ? 'due' : 'sub',
    followUp = FQ.fu[cheque.payment_id]; /* today: bold ink (.due), amber read 3.8:1 in Dark */
  return (
    '<span class="' +
    stateClass +
    '" data-b="pdc-' +
    esc(postDated.state) +
    '">' +
    esc(tx(FQ_STATE[postDated.state] || postDated.state)) +
    (postDated.state === 'not_yet' ? ' · ' + esc(bkDate(postDated.cheque_date)) : '') +
    '</span>' +
    (followUp
      ? ' <span class="sub" data-b="fu-set">' + esc(tx('Reminder set')) + '</span>'
      : ' <button data-cbsid="FIN006-B04" type="button" class="cbl-tbtn" data-testid="fq-remind-' +
        esc(cheque.payment_id) +
        '" onclick="event.stopPropagation();fqRemindMe(\'' +
        escJs(cheque.payment_id) +
        '\',this)">' +
        esc(tx('Remind me')) +
        '</button>')
  );
}
/** the page's columns: the workshop's cheque columns with the post-dated state added, narrowed to fit 1366 px */
function fqCols() {
  var cols = bkChequeCols(); /* party · cheque · dated · amount · status (the steps the server offers, as buttons) */
  cols.splice(3, 0, {
    key: 'due',
    label: tx('To deposit'),
    prio: 2,
    sort: 'due',
    w: 200,
    html: true,
    tid: function (c) {
      return 'fq-due-' + c.payment_id;
    },
    cell: fqDueCell
  });
  /* six columns in a 1366 px window: the workshop's widths (1240) scrolled the list sideways (rule 13); the same cells, narrower */
  var widths = { party: 190, cheque: 160, dated: 110, amount: 120, status: 260 };
  cols.forEach(function (item) {
    if (widths[item.key]) item.w = widths[item.key];
  });
  return cols;
}
/** what is said on top: the post-dated cheques past or on their day (the server's states; counted, never summed) */
function fqHead() {
  var notices = [];
  if (FQ.state === 'ready' && FQ.r) {
    var dueRows = (FQ.r.pdc_reminders || []).filter(function (x) {
      return x.state !== 'not_yet';
    });
    if (dueRows.length)
      notices.push({
        cls: 'warn',
        tid: 'fq-pdc',
        text: txn('{count} cheque to deposit', '{count} cheques to deposit', dueRows.length),
        onOpen: function () {
          if (FQ.api) FQ.api.refresh();
        }
      });
  }
  return { title: tx('Cheques'), notices: notices };
}
/** the Cheques screen: its frame, the notices on top and the list over FQ.rows */
function fqMount(frame) {
  var node = document.getElementById('screen');
  if (!node) return;
  ftNav();
  node.className = 'screen flush';
  node.innerHTML = '<div id="fq_top" data-testid="fq-top"></div><div id="fq_list" data-testid="fq-list" style="flex:1 1 auto;min-height:0"></div>';
  fqPaintTop();
  var by = function (g) {
    return function (a, b) {
      return String(g(a)).localeCompare(String(g(b)), undefined, { numeric: true });
    };
  };
  var rank = { overdue_for_deposit: 0, deposit_today: 1, not_yet: 2 };
  FQ.api = CBList.mount(document.getElementById('fq_list'), {
    key: 'fin-cheques',
    t: tx,
    rows: function () {
      return FQ.rows;
    },
    id: function (c) {
      return c.payment_id;
    },
    rowTid: function (c) {
      return 'fq-row-' + c.payment_id;
    },
    columns: fqCols(),
    defaultCols: ['party', 'cheque', 'due', 'dated', 'amount', 'status'],
    cardMax: 4,
    fill: false,
    head: fqHead,
    state: function () {
      return FQ.state;
    },
    error: function () {
      return { title: tx('Could not read the cheques.'), sub: tx('Nothing was lost. Try again.') };
    },
    onRetry: fqRetry,
    empty: { title: tx('No cheques in hand') },
    group: {
      default: 'in',
      order: ['in', 'out'],
      by: function (c) {
        return c.direction === 'out' ? [tx('Written by you'), 'out'] : [tx('Received'), 'in'];
      },
      fig: function (rows) {
        return txn('{count} cheque', '{count} cheques', rows.length);
      },
      headTid: function (k) {
        return 'fq-group-' + k;
      }
    },
    search: function (c) {
      return [c.name, c.cheque_no, c.cheque_bank, c.status, bkMoney(c.amount_minor, c.currency || fqCur())].join(' ');
    },
    sorts: [
      {
        key: 'due',
        label: tx('To deposit'),
        cmp: function (a, b) {
          var pa = FQ.pdc[a.payment_id],
            pb = FQ.pdc[b.payment_id];
          return (pa ? rank[pa.state] : 9) - (pb ? rank[pb.state] : 9) || String(a.cheque_date || '').localeCompare(String(b.cheque_date || ''));
        }
      },
      {
        key: 'dated',
        label: tx('Dated'),
        cmp: by(function (c) {
          return c.cheque_date || '';
        })
      },
      {
        key: 'party',
        label: tx('Party'),
        cmp: by(function (c) {
          return c.name;
        })
      },
      {
        key: 'cheque',
        label: tx('Cheque'),
        cmp: by(function (c) {
          return c.cheque_no;
        })
      },
      {
        key: 'amount',
        label: tx('Amount'),
        cmp: function (a, b) {
          return Number(a.amount_minor || 0) - Number(b.amount_minor || 0);
        }
      },
      {
        key: 'status',
        label: tx('Status'),
        cmp: by(function (c) {
          return c.status;
        })
      }
    ],
    filters: [
      {
        key: 'show',
        label: tx('Show'),
        all: tx('Every cheque'),
        options: [
          { v: 'due', label: tx('To deposit') },
          { v: 'pdc', label: tx('Post-dated') }
        ].concat(
          Object.keys(BK_CHQ_WORD).map(function (item) {
            return { v: item, label: tx(BK_CHQ_WORD[item]) };
          })
        ),
        match: function (c, v) {
          var p = FQ.pdc[c.payment_id];
          return v === 'due' ? !!(p && p.state !== 'not_yet') : v === 'pdc' ? !!(p && p.state === 'not_yet') : c.status === v;
        }
      }
    ],
    /* its next level is the party's bills — the workshop's own (the statement route, read once on the first open) */
    next: function (cheque) {
      return (
        '<div data-testid="fq-next-' +
        esc(cheque.payment_id) +
        '"><div style="color:var(--grey);font-size:var(--fs-1);text-transform:uppercase;padding:2px 0">' +
        esc(tx('Bills')) +
        '</div>' +
        (cheque.party_id ? bkPartyBillsHTML(cheque.party_id, 'cheques', cheque.currency || fqCur()) : '') +
        '</div>'
      );
    }
  });
  if (!frame) fqLoad(FQ.rows.length > 0);
}
