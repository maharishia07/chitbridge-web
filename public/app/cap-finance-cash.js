/* cap-finance-cash.js — CB Finance · Cash (round F3): today's cash and bank, then day by day what comes in and goes out for 7 or 30 days, and the FIRST
 * day it goes below zero — in one sentence on top. Loaded by finance.html after cap-finance.js. docs: C:/dev/CB-FINANCE-PLAN.md §4 F3.
 *
 * ⭐ REUSE (CLAUDE.md rule 1, named in the PR): CBList.mount (the one list — the days ARE the table the chart's numbers live in; a11y) · CBList.nextRow (what
 * a day counts: the dues and cheques behind it) · head.notices (the sentence on top, as the Ledger's To-do strip) · bkMoney / bkDate / bkToday /
 * bkPartyLabel (cap-books.js — the M36 money unit; no Dr/Cr here: a shopkeeper reads "short", W32) · finOff (the ledger-off card with the owner's switch) · finDenied (the owner-only sentence,
 * greyed) · the page's .tabs/.tab pills (the 7/30 toggle) and .card (the chart's frame) — finance.html's own styles, no new look.
 * ⭐ THE DAY (F3b): "Today" is the row whose date is the server's asOf — the day the server counted from — not the browser's clock (bkToday is the fallback
 * when the answer has no asOf). The walk injects one clock for the page and the stand-in, so the tab reads the same on any day and across midnight.
 * ⭐ ONE CALCULATION (rule 2): this file computes NO money. Opening, each day's in · out · running balance, the shortfall and every sentence are the
 * server's (GET /api/books/cashflow); the chart draws the server's balance_minor per day and the table shows the same figures. Nothing is added here.
 * ⭐ NEW PATHS (rule 4): FC (this tab's state) · FC_EP (the one new route) · fcChart (an inline SVG of the running balance — the owner-approved
 * bar/line; theme tokens only, every figure also in the table beneath) — nothing in the app drew a day-by-day balance before.
 * ⚠️ Never error.message on a screen: a failure says what happened and offers Try again. Finance SUGGESTS: there is no button here that posts.
 */
/* OWNS CB Finance, Cash: today's money (cash drawer · UPI and bank), day by day for 7 or 30 days, the first short day
 * CALLED BY cap-finance.js finLoad / finMount on the Cash tab (finance.html loads it after cap-finance.js)
 * FLOW GET /api/books/cashflow -> FC.r -> the chart + CBList rows -> fcBal / bkMoney
 * CARD 16-finance/cb-finance */
'use strict';

var FC = { gen: 0, days: 7, r: null, rows: [], state: 'loading', api: null };
var FC_EP = {
  booksCashflow: { m: 'GET', p: '/api/books/cashflow' } /* owner · ?days=7|30 → the cash position (lib/books-cashflow.project) */
};
Object.assign(EP, FC_EP);
var FC_OWNER_ONLY = 'Only the owner may see the cash position.';
/* `gst` is the server's kind for the tax return; its row's name is the pack's own word (GST · BAS · VAT return) — W1-FIN, never "GST" typed here */
var FC_KIND = {
  due_in: 'Bill due',
  due_out: 'Bill to pay',
  cheque_in: 'Cheque in hand',
  cheque_out: 'Cheque written',
  gst: 'Return to pay',
  recurring_in: 'Comes in every time',
  recurring_out: 'Goes out every time' /* R75: the entries that come round (Accounts › Accruals & recurring), counted on their day */
};

function fcIsIn(it) {
  return /_in$/.test(String(it && it.kind));
}
/** WALK2 W32 (FIN-1): a cash balance in a shopkeeper's words — the money, or "short ₹…" below zero; never Dr/Cr, never a minus (bkOwes' rule) */
function fcBal(minor, currency) {
  var amount = Number(minor || 0);
  return amount < 0 ? tx('short') + ' ' + bkMoney(-amount, currency) : bkMoney(amount, currency);
}
/** the two places today's money sits, both the server's (books-cashflow.project drawer_minor · bank_minor): the cash drawer, and UPI and bank — '' on an older server */
function fcWhere(answer, currency) {
  if (!answer || answer.drawer_minor == null || answer.bank_minor == null) return '';
  return (
    '<div class="sub" data-testid="fc-where" style="display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:2px"><span data-testid="fc-drawer">' +
    esc(tx('Cash drawer') + ' ' + fcBal(answer.drawer_minor, currency)) +
    '</span>' +
    '<span data-testid="fc-bank">' +
    esc(tx('UPI and bank') + ' ' + fcBal(answer.bank_minor, currency)) +
    '</span></div>'
  );
}

/** read the cash-flow answer for the chosen number of days and repaint; an older read that returns late is ignored */
async function fcLoad(quiet) {
  var generation = ++FC.gen;
  if (!quiet) {
    FC.state = 'loading';
    if (FC.api) FC.api.refresh();
  }
  try {
    var reply = await api('booksCashflow', { query: { days: String(FC.days) } });
    if (generation !== FC.gen) return;
    FC.r = reply;
    FC.rows = (reply && reply.series) || [];
    FC.state = 'ready';
  } catch (e) {
    if (generation !== FC.gen) return;
    if (e && e.status === 404) {
      finOff();
      return;
    } /* the Ledger is off for this shop (M212) */
    if (e && e.status === 403) {
      finDenied(FC_OWNER_ONLY);
      return;
    } /* the server said who may see it */
    FC.state = 'error';
  }
  fcPaintTop();
  if (FC.api) FC.api.refresh();
}
function fcRetry() {
  fcLoad();
}
function fcDays(n) {
  if (FC.days === n) return;
  FC.days = n;
  fcPaintTop();
  fcLoad();
}

/* ── the toggle and the chart: the frame is the page's own (.tabs pills · .card) ── */
function fcPaintTop() {
  var el = document.getElementById('fc_top');
  if (!el) return;
  var pill = function (days) {
    return (
      '<button data-cbsid="FIN003-B01" type="button" class="tab" aria-pressed="' +
      (FC.days === days ? 'true' : 'false') +
      '" data-testid="fc-days-' +
      days +
      '" onclick="fcDays(' +
      days +
      ')">' +
      esc(txn('{count} day', '{count} days', days)) +
      '</button>'
    );
  };
  el.innerHTML =
    '<div class="tabs" role="group" aria-label="' +
    esc(tx('How far ahead')) +
    '" style="margin:10px 20px 0">' +
    pill(7) +
    pill(30) +
    '</div>' +
    '<div class="card" id="fc_chart" data-testid="fc-chart" style="margin:10px 20px 6px;max-width:none;padding:12px 16px 10px"></div>';
  fcPaintChart();
}
/** the chart is drawn at the card's own width (one SVG unit = one CSS pixel, so no label is stretched); drawn again when the window changes size */
function fcPaintChart() {
  var box = document.getElementById('fc_chart');
  if (!box) return;
  if (!(FC.state === 'ready' && FC.r)) {
    box.innerHTML = '<p class="hint">' + esc(FC.state === 'error' ? tx('Could not read your cash position.') : tx('Loading…')) + '</p>';
    return;
  }
  var report = FC.r,
    width = Math.max(240, (box.clientWidth || 640) - 32);
  CBChartCap.ready().then(
    function () {
      if (FC.r !== report) return;
      if (!FC.bar || !FC.barScope || !FC.barScope.querySelector('[data-testid="chart-bar"]')) {
        FC.barScope = box.parentNode;
        FC.bar = CBChartBar.mount(FC.barScope, { kind: 'series', types: ['column', 'line'], onChange: fcDraw });
      } else fcDraw(FC.bar.state());
    },
    function () {
      box.innerHTML = '<p class="hint">' + esc(tx('The chart could not load; the table below has the same days.')) + '</p>';
    }
  );
}
/** the running balance in the person's choice (columns or a line; the colours are already on the screen as --ch-* tokens) */
function fcDraw(choice) {
  var box = document.getElementById('fc_chart');
  if (box && FC.state === 'ready' && FC.r) box.innerHTML = fcChart(FC.r, Math.max(240, (box.clientWidth || 640) - 32), choice);
}
window.addEventListener('resize', function () {
  clearTimeout(FC.rs);
  FC.rs = setTimeout(fcPaintChart, 150);
});
/**
 * the running balance as bars, one per day (the server's balance_minor — drawn, never worked out here): the accent above zero, red below (a sale
 * at risk is the one red), a zero line, the day under every bar (every 5th on 30 days) and the lowest day labelled. The same numbers are the table.
 */
function fcChart(report, width, choice) {
  var rows = report.series || [],
    count = rows.length;
  if (!count || typeof CBDraw === 'undefined') return '';
  var currency = report.currency,
    vals = rows.map(function (item) {
      return Number(item.balance_minor || 0);
    });
  var lowest = vals.indexOf(Math.min.apply(null, vals));
  /* the server's balance_minor, drawn: the accent above zero, red below, today solid; the day under every 5th bar and the lowest day worded */
  var points = rows.map(function (item, index) {
    return {
      key: item.date,
      label: String(item.date).slice(8, 10),
      value: vals[index],
      neg: vals[index] < 0,
      fill: vals[index] < 0 ? 'var(--red,#C4562F)' : 'var(--ch-act,var(--accent,#1f5f5b))',
      opacity: index === 0 ? 0 : 0.82,
      title: bkDate(item.date) + ' · ' + fcBal(vals[index], currency)
    };
  });
  return (
    '<div class="sec" style="display:flex;justify-content:space-between;gap:8px"><span>' +
    esc(tx('Running balance')) +
    '</span><span class="mono" data-testid="fc-opening">' +
    esc(tx('Today') + ' ' + fcBal(report.opening_minor, currency)) +
    '</span></div>' +
    fcWhere(report, currency) +
    CBDraw.bars(points, {
      width: width || 640,
      height: 150,
      padTop: 14,
      padBottom: 22,
      gap: 2,
      id: 'fc',
      tid: 'fc',
      svgTid: 'fc-svg',
      type: choice && choice.type,
      read: choice && choice.read,
      aria: report.words || '',
      labelOn: function (index, total) {
        return total <= 7 || index % 5 === 0 || index === total - 1;
      },
      mark: { index: lowest, text: fcBal(vals[lowest], currency), tid: 'fc-low-label' }
    })
  );
}

/* ── the table: the days — every figure is the server's ── */
function fcCols() {
  var currencyOf = function () {
      return bkCur(FC.r && FC.r.currency);
    },
    dash = '<span style="color:var(--grey)">—</span>';
  return [
    {
      key: 'date',
      label: tx('Day'),
      prio: 1,
      sort: 'date',
      w: 170,
      html: true,
      cell: function (d) {
        return (
          '<span data-b="date">' +
          esc(bkDate(d.date)) +
          '</span>' +
          (d.date === ((FC.r && FC.r.asOf) || bkToday()) ? ' <span class="tag">' + esc(tx('Today')) + '</span>' : '') +
          (d.items.length ? '' : ' <span class="sub">' + esc(tx('quiet')) + '</span>')
        );
      }
    },
    {
      key: 'in',
      label: tx('Coming in'),
      prio: 3,
      num: true,
      w: 150,
      html: true,
      cell: function (d) {
        return Number(d.in_minor) ? '<span class="due get" data-b="in">' + esc(bkMoney(d.in_minor, currencyOf())) + '</span>' : dash;
      }
    },
    {
      key: 'out',
      label: tx('Going out'),
      prio: 4,
      num: true,
      w: 150,
      html: true,
      cell: function (d) {
        return Number(d.out_minor) ? '<span class="due give" data-b="out">' + esc(bkMoney(d.out_minor, currencyOf())) + '</span>' : dash;
      }
    },
    {
      key: 'bal',
      label: tx('Balance'),
      prio: 2,
      sort: 'bal',
      num: true,
      w: 190,
      html: true,
      cell: function (d) {
        var v = Number(d.balance_minor || 0);
        return '<b data-b="balance">' + esc(fcBal(v, currencyOf())) + '</b>' + (v < 0 ? ' <span class="tag red" data-b="short">⚠ ' + esc(tx('Short')) + '</span>' : '');
      }
    },
    {
      key: 'what',
      label: tx('What'),
      prio: 5,
      w: 320,
      html: true,
      cell: function (dayRow) {
        return dayRow.items.length
          ? esc(
              dayRow.items
                .map(function (item) {
                  return item.name;
                })
                .join(' · ')
            )
          : dash;
      }
    }
  ];
}
/** what a day counts: the dues and cheques behind it, as the server listed them (the Task table's next level, CBList.nextRow) */
function fcNext(dayRow) {
  var currency = bkCur(FC.r && FC.r.currency);
  var rows = (dayRow.items || [])
    .map(function (item) {
      var party = item.party_id ? bkPartyLabel(item.party_id, item.name) : esc(item.name || '');
      var what =
        tx(FC_KIND[item.kind] || item.kind) +
        (item.cheque_no ? ' ' + item.cheque_no : '') +
        (item.promised
          ? ' · ' + tx('promised')
          : item.overdue
            ? ' · ' + tx('overdue')
            : item.due_date && item.due_date !== dayRow.date
              ? ' · ' + tx('due') + ' ' + bkDate(item.due_date)
              : '');
      return CBList.nextRow(
        [
          '<span data-b="who">' + esc(party) + '</span> <span class="sub">' + esc(what) + '</span>',
          '<span class="due ' + (fcIsIn(item) ? 'get' : 'give') + '">' + esc((fcIsIn(item) ? '+ ' : '− ') + bkMoney(item.amount_minor, currency)) + '</span>'
        ],
        [140]
      );
    })
    .join('');
  return (
    '<div data-testid="fc-next-' +
    esc(dayRow.date) +
    '">' +
    (rows || '<div style="color:var(--grey);font-size:var(--fs-1)">' + esc(tx('Nothing is due this day')) + '</div>') +
    '</div>'
  );
}
/** the sentence on top (the server's words), what is left out, and GST — as the list's own notices and chips */
function fcHead() {
  var reply = FC.r,
    notices = [],
    chips = [];
  if (reply && FC.state === 'ready') {
    /* R75: a shortfall is a WARNING notice; good news ("You stay above zero…") is a plain chip — never the amber ⚠ */
    if (reply.shortfall)
      notices.push({
        cls: 'warn',
        tid: 'fc-words',
        text: reply.words,
        onOpen: function () {
          if (FC.api) FC.api.refresh();
        }
      });
    else chips.push({ tid: 'fc-words', text: reply.words });
    if (reply.uncounted && reply.uncounted.words) notices.push({ cls: 'warn', tid: 'fc-uncounted', text: reply.uncounted.words });
    if (reply.gst && Number(reply.gst.payable_minor) > 0) chips.push({ tid: 'fc-gst', text: fcReturnChip(reply.gst, reply.currency) });
  }
  return { title: tx('Cash position'), notices: notices, chips: chips };
}
/** the return chip: the pack's word (gst.short) · the figure · its date and whether it is inside the window — or, with no date (the pack would not guess), the server's sentence */
function fcReturnChip(g, cur) {
  var when = g.due_date ? bkDate(g.due_date) + (g.counted ? '' : ' · ' + tx('after this window')) : g.why || tx('due date not known');
  return g.short + ' ' + bkMoney(g.payable_minor, cur) + ' · ' + when;
}
/** mount the Cash tab into the screen */
function fcMount(frame) {
  var node = document.getElementById('screen');
  if (!node) return;
  ftNav();
  node.className = 'screen flush';
  node.innerHTML = '<div id="fc_top" data-testid="fc-top"></div><div id="fc_list" data-testid="fc-list" style="flex:1 1 auto;min-height:0"></div>';
  fcPaintTop();
  FC.api = CBList.mount(document.getElementById('fc_list'), {
    key: 'fin-cash',
    t: tx,
    rows: function () {
      return FC.rows;
    },
    id: function (d) {
      return d.date;
    },
    rowTid: function (d) {
      return 'fc-row-' + d.date;
    },
    columns: fcCols(),
    defaultCols: ['date', 'in', 'out', 'bal', 'what'],
    cardMax: 4,
    fill: false,
    head: fcHead,
    state: function () {
      return FC.state;
    },
    error: function () {
      return { title: tx('Could not read your cash position.'), sub: tx('Nothing was lost. Try again.') };
    },
    onRetry: fcRetry,
    empty: { title: tx('No days to show') },
    search: function (d) {
      return [d.date, bkDate(d.date)]
        .concat(
          (d.items || []).map(function (item) {
            return item.name + ' ' + (item.cheque_no || '');
          })
        )
        .join(' ');
    },
    sorts: [
      {
        key: 'date',
        label: tx('Day'),
        cmp: function (a, b) {
          return String(a.date).localeCompare(String(b.date));
        }
      },
      {
        key: 'bal',
        label: tx('Balance'),
        cmp: function (a, b) {
          return Number(a.balance_minor || 0) - Number(b.balance_minor || 0);
        }
      }
    ],
    filters: [
      {
        key: 'show',
        label: tx('Show'),
        all: tx('Every day'),
        options: [
          { v: 'busy', label: tx('Money moving') },
          { v: 'short', label: tx('Short') }
        ],
        match: function (d, v) {
          return v === 'busy' ? d.items.length > 0 : Number(d.balance_minor) < 0;
        }
      }
    ],
    next: fcNext
  });
  if (!frame) fcLoad(FC.rows.length > 0);
}
