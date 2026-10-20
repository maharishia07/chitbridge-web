/* cap-finance-pay.js — CB Finance · Payables (round F4): what WE owe each supplier, aged, MSME day 45 and its risk (India), the supplier's early-pay offer,
 * and Pay through the ONE payment path. Loaded by finance.html after cap-finance.js. docs: C:/dev/CB-FINANCE-PLAN.md §4 F4.
 *
 * ⭐ REUSE (CLAUDE.md rule 1, named in the PR): Collections' own shape — the same read (api('booksDues'), asked side=supplier&finance=1), CBList.mount
 * (the one list: grouped, sorted, searched) · CBList.nextRow (a row's bills, the Task table's next level) · payOpen (THE one payment path — widened with the
 * server's offer, never a second pay form) · bkDuesStore / bkPartyLabel / bkMoney / bkOwes / bkDate / bkToday (cap-books.js) · finOff / finDenied (the
 * ledger-off card and the owner-only sentence) · ftNav (the tab switch).
 * ⭐ ONE CALCULATION (rule 2): this file computes NO money and no date. The bills, the ageing buckets, day 45, the risk, the group, pay_by, the offer and its
 * words are the server's (lib/books-payables.view — F3's own outgoing dues, so this tab and Cash agree). A group head adds its rows, as Collections' does.
 * ⭐ NEW PATHS (rule 4): FP (this tab's state) · fpCols / fpNext (what a supplier row shows and opens to) · fpPay (Pay with the row's offer). Nothing else.
 * ⚠️ Never error.message on a screen. Finance SUGGESTS: the only writes are the pay sheet's own (Record, Record discount) — pressed by the owner.
 */
/* OWNS CB Finance, Pay: what the shop owes its suppliers
 * CALLED BY finance.html (after cap-finance.js)
 * FLOW GET the payables -> FP.cur from the reply, else the books money -> bkMoney for every figure
 * CARD 16-finance/payables */
'use strict';

var FP = { gen: 0, rows: [], cur: null, total: null, state: 'loading', api: null };
var FP_OWNER_ONLY = 'Only the owner may see what you owe.';
var FP_BUCKETS = [
  ['0_30', '0–30 days'],
  ['31_45', '31–45 days'],
  ['46_60', '46–60 days'],
  ['60_plus', 'Over 60 days']
];
var FP_GROUPS = { overdue: 'Overdue', msme: 'MSME at risk', week: 'Due this week', later: 'Later' };

async function fpLoad(quiet) {
  var g = ++FP.gen;
  if (!quiet) {
    FP.state = 'loading';
    if (FP.api) FP.api.refresh();
  }
  try {
    var reply = await api('booksDues', { query: { asOf: bkToday(), side: 'supplier', finance: '1' } });
    if (g !== FP.gen) return;
    bkDuesStore(reply);
    FP.cur = (reply && reply.currency) || bkCur();
    if (reply && reply.currency && typeof SESSION !== 'undefined' && SESSION)
      SESSION.currency = reply.currency; /* the ledger's currency reaches Pay (finance.html sets none) */
    FP.rows = ((reply && reply.parties) || []).filter(function (item) {
      return item.payable && item.payable.bills && item.payable.bills.length;
    });
    FP.total = reply && reply.payables ? reply.payables.total_minor : null;
    FP.state = 'ready';
  } catch (e) {
    if (g !== FP.gen) return;
    if (e && e.status === 404) {
      finOff();
      return;
    } /* the Ledger is off for this shop (M212) */
    if (e && e.status === 403) {
      finDenied(FP_OWNER_ONLY, 'Payables');
      return;
    } /* the server said who may see it */
    FP.state = 'error';
  }
  if (FP.api) FP.api.refresh();
}
function fpRetry() {
  fpLoad();
}
function fpRow(pid) {
  return (
    FP.rows.filter(function (item) {
      return item.party_id === pid;
    })[0] || null
  );
}
/** Pay: the one payment path, with the row's best offer (the server's) — the list re-reads after anything is written */
function fpPay(pid) {
  var p = fpRow(pid);
  payOpen('supplier', pid, {
    offer: p && p.payable ? p.payable.early : null,
    after: function () {
      fpLoad(true);
    }
  });
}

/* ── the columns: every figure is the server's ── */
function fpCols() {
  var c = function () {
      return FP.cur;
    },
    dash = '<span style="color:var(--grey)">—</span>';
  var bucket = function (k, label, prio) {
    return {
      key: 'b' + k,
      label: tx(label),
      prio: prio,
      num: true,
      w: 120,
      html: true,
      cell: function (p) {
        var v = Number(p.payable.buckets[k] || 0);
        return v ? '<span data-b="' + k + '">' + esc(bkMoney(v, c())) + '</span>' : dash;
      }
    };
  };
  return [
    {
      key: 'party',
      label: tx('Supplier'),
      prio: 1,
      sort: 'name',
      w: 220,
      html: true,
      cell: function (p) {
        return esc(bkPartyLabel(p.party_id, p.name)) + (p.payable.msme ? ' <span class="tag" data-b="msme">' + esc(tx('MSME')) + '</span>' : '');
      }
    },
    {
      key: 'due',
      label: tx('To pay'),
      prio: 2,
      sort: 'due',
      num: true,
      w: 140,
      html: true,
      cell: function (p) {
        return '<b data-b="topay">' + esc(bkMoney(Number(p.payable.total_minor), c())) + '</b>';
      }
    },
    {
      key: 'payby',
      label: tx('Pay by'),
      prio: 3,
      sort: 'risk',
      w: 150,
      html: true,
      cell: function (p) {
        var x = p.payable;
        return x.pay_by
          ? '<span data-b="payby">' +
              esc(bkDate(x.pay_by)) +
              '</span>' +
              (x.msme_risk ? ' <span class="tag amber" data-b="risk">⚠ ' + esc(tx('Day 45')) + '</span>' : '')
          : dash;
      }
    },
    {
      key: 'offer',
      label: tx('Early pay'),
      prio: 4,
      w: 230,
      html: true,
      cell: function (p) {
        var f = p.payable.early;
        return f ? '<span data-b="offer">' + esc(f.words) + '</span>' : dash;
      }
    },
    bucket('0_30', '0–30 days', 5),
    bucket('31_45', '31–45 days', 6),
    bucket('46_60', '46–60 days', 7),
    bucket('60_plus', 'Over 60 days', 8),
    {
      key: 'act',
      label: ' ',
      prio: 1,
      pin: 'end',
      w: 100,
      html: true,
      cell: function (p) {
        return (
          '<button type="button" class="cbl-tbtn" data-testid="fp-pay-' +
          esc(p.party_id) +
          '" onclick="event.stopPropagation();fpPay(\'' +
          esc(p.party_id) +
          '\')">' +
          esc(tx('Pay')) +
          '</button>'
        );
      }
    }
  ];
}
/** what a supplier row opens to: its ages (the server's buckets), then its bills as the server listed them — the MSME sentence and the offer under the bill they belong to */
function fpNext(p) {
  var c = FP.cur,
    bills = (p.payable && p.payable.bills) || [],
    b0 = (p.payable && p.payable.buckets) || {};
  var ages = FP_BUCKETS.filter(function (item) {
    return Number(b0[item[0]]) > 0;
  })
    .map(function (item) {
      return CBList.nextRow(['<span data-b="age-' + item[0] + '">' + esc(tx(item[1])) + '</span>', esc(bkMoney(Number(b0[item[0]]), c))]);
    })
    .join('');
  /* the bill's line is a nextRow (its date | amount — short, so a phone card stays inside the screen); its age, due day and sentences sit UNDER it on their own
     lines — a nextRow cell is one line, and a sentence must wrap, never clip */
  var line = function (tid, t, red) {
    return (
      '<div data-b="' + tid + '" style="font-size:var(--fs-1);padding:0 0 2px;color:' + (red ? 'var(--ink,#2a2418)' : 'var(--grey)') + '">' + esc(t) + '</div>'
    );
  };
  var rows = bills
    .map(function (item) {
      var lab = (FP_BUCKETS.filter(function (k) {
        return k[0] === item.bucket;
      })[0] || [0, ''])[1];
      return (
        CBList.nextRow([
          '<span data-b="bill">' + esc(bkDate(item.date)) + '</span>',
          '<span class="due give">' + esc(bkMoney(item.open_minor, c)) + '</span>'
        ]) +
        line('due', tx(lab) + ' · ' + (item.overdue ? tx('overdue since') : tx('due')) + ' ' + bkDate(item.due_date)) +
        (item.msme_words ? line('msme', item.msme_words, item.msme_risk) : '') +
        (item.early ? line('early', item.early.words) : '')
      );
    })
    .join('');
  var sec = function (t) {
    return '<div style="color:var(--grey);font-size:var(--fs-1);padding:4px 0 2px">' + esc(tx(t)) + '</div>';
  };
  return (
    '<div data-testid="fp-next-' +
    esc(p.party_id) +
    '">' +
    (ages ? sec('Age') + '<div data-testid="fp-ages-' + esc(p.party_id) + '">' + ages + '</div>' + sec('Bills') : '') +
    (rows || '<div style="color:var(--grey);font-size:var(--fs-1)">' + esc(tx('Nothing to pay')) + '</div>') +
    '</div>'
  );
}
function fpHead() {
  var chips = [];
  if (FP.state === 'ready' && FP.total != null) chips.push({ tid: 'fp-total', text: tx('To pay') + ' ' + bkMoney(FP.total, FP.cur) });
  return { title: tx('Payables'), chips: chips };
}
function fpMount(frame) {
  var node = document.getElementById('screen');
  if (!node) return;
  ftNav();
  node.className = 'screen flush';
  node.innerHTML = '<div id="fp_list" data-testid="fp-list" style="flex:1 1 auto;min-height:0"></div>';
  var num = function (g) {
    return function (a, b) {
      return Number(g(a) || 0) - Number(g(b) || 0);
    };
  };
  FP.api = CBList.mount(document.getElementById('fp_list'), {
    key: 'fin-pay',
    t: tx,
    rows: function () {
      return FP.rows;
    },
    id: function (p) {
      return p.party_id;
    },
    rowTid: function (p) {
      return 'fp-row-' + p.party_id;
    },
    columns: fpCols(),
    defaultCols: ['party', 'due', 'payby', 'offer'],
    cardMax: 4,
    fill: false /* the four age columns are in the ⚙ chooser; a row opens to its ages and bills */,
    head: fpHead,
    state: function () {
      return FP.state;
    },
    error: function () {
      return { title: tx('Could not read what you owe.'), sub: tx('Nothing was lost. Try again.') };
    },
    onRetry: fpRetry,
    empty: { title: tx('You owe no supplier') },
    group: {
      default: 'risk',
      order: ['overdue', 'msme', 'week', 'later'],
      by: function (p) {
        return [tx(FP_GROUPS[p.payable.group] || 'Later'), p.payable.group];
      },
      fig: function (rows) {
        return (
          txn('{count} supplier', '{count} suppliers', rows.length) +
          ' · ' +
          bkMoney(
            rows.reduce(function (total, item) {
              return total + Number(item.payable.total_minor || 0);
            }, 0),
            FP.cur
          )
        );
      },
      headTid: function (k) {
        return 'fp-group-' + k;
      }
    },
    search: function (p) {
      return [p.party_no, p.name, bkPartyLabel(p.party_id, p.name)].join(' ');
    },
    sorts: [
      {
        key: 'risk',
        label: tx('Pay by'),
        cmp: function (a, b) {
          return String(a.payable.pay_by || '9999').localeCompare(String(b.payable.pay_by || '9999'));
        }
      },
      {
        key: 'name',
        label: tx('Name'),
        cmp: function (a, b) {
          return String(a.name || '').localeCompare(String(b.name || ''));
        }
      },
      {
        key: 'due',
        label: tx('To pay'),
        cmp: num(function (p) {
          return p.payable.total_minor;
        })
      }
    ],
    filters: [
      {
        key: 'flag',
        label: tx('Show'),
        all: tx('Every supplier'),
        options: [
          { v: 'msme', label: tx('MSME') },
          { v: 'early', label: tx('Early pay') }
        ],
        match: function (p, v) {
          return v === 'msme' ? !!p.payable.msme : !!p.payable.early;
        }
      }
    ],
    next: fpNext
  });
  if (!frame) fpLoad(FP.rows.length > 0);
}
