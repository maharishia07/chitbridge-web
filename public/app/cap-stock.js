/* app/cap-stock.js — CB Operations › Stock (T3-OPS, 2026-10-14): what is on the shelf, per item, from THE ONE STOCK READER.
 *
 * ⚠️ NEW, AND WHY (CLAUDE.md rule 4): the workshop has no stock-on-hand screen to move (grep `till/stock|onHand|stock_balance` in app.html and
 * app/*.js: none — the critique, docs/critique/T3-OPS.md). The reader is the server's: chitbridge-api lib/stock-store.onHand (T1-INV), served by
 * GET /api/till/stock?lots=1 (widened in T3-OPS) → shelf[{ item_id, name, unit, qty, below_zero, lots[{ lot, expires_at, qty }] }] · below_zero.
 * ⭐ THIS FILE COMPUTES NOTHING (rule 2): the quantities, the batch split, "below zero" and the order (fewest on hand first, below zero on top)
 * are the server's. No reorder level is kept anywhere, so "low" is the server's own fact — below zero — and never a threshold made up here.
 * ⚠️ NO VALUE, NO COST on this list: what the shelf is worth is the books' answer (closing stock), and cost is gated on the server.
 * The list is CBList (list-ctl.js): search · filter · sort · count · lazy rows; a row opens to its batches.
 * Flow: INV step 1 · on hand (docs/process/INV.md).
 * Needs: api · tx · txf · esc · CBList · CBLocale (dates); EP with CB_OPS_EP.
 */
'use strict';

/* ── the one read this screen makes (registered once; operations.html assigns it into EP) ── */
var CB_OPS_EP = {
  stockShelf: { m: 'GET', p: '/api/till/stock', ok: 'y' },   // ?lots=1 → { balances, shelf[], below_zero, at } (`shelf`, not `items`: api()'s unwrap would collapse an `items` answer and drop below_zero) · 503 STOCK_NOT_READY before b214
};

var CBStock = (function () {
  var S = { rows: [], below: 0, state: 'loading', err: null, notReady: false, at: null, list: null };
  function qty(x) { return String(x.qty) + (x.unit ? ' ' + x.unit : ''); }
  function day(d) {
    if (!d) return '';
    try { return window.CBLocale && CBLocale.date ? CBLocale.date(d) : String(d); }
    catch (e) { if (typeof cblog === 'function') cblog('warn', 'operations: a batch date did not format — ' + e.message); return String(d); }
  }
  function lotsWord(x) {
    var l = x.lots || [];
    if (!l.length) return '—';
    var first = l[0];
    return txn('{count} batch', '{count} batches', l.length) + (first.expires_at ? ' · ' + txf('first expires {date}', { date: day(first.expires_at) }) : '');
  }
  function cols() {
    return [
      { key: 'name', label: tx('Item'), prio: 1, w: 220, cell: function (x) { return x.name || tx('An item no longer in your catalogue'); } },
      { key: 'qty', label: tx('On hand'), prio: 2, w: 120, num: true, html: true, value: function (x) { return x.qty; },
        cell: function (x) { return x.below_zero ? '<span class="ops-chip bad" data-testid="ops-stock-below-' + esc(x.item_id) + '">' + esc(qty(x)) + '</span>' : esc(qty(x)); } },
      { key: 'lots', label: tx('Batches'), prio: 3, w: 220, cell: lotsWord },
    ];
  }
  async function load() {
    S.state = 'loading'; S.notReady = false; if (S.list) S.list.refresh();
    try {
      var r = await api('stockShelf', { query: { lots: 1 } });
      /* a server from before T3-OPS ignores ?lots and answers without `shelf`: that is "not switched on yet", never an empty shelf */
      if (!r || !Array.isArray(r.shelf)) { S.rows = []; S.state = 'error'; S.notReady = true; if (typeof cblog === 'function') cblog('warn', 'operations: the stock read has no shelf list (an older server)'); if (S.list) S.list.refresh(); return; }
      S.rows = r.shelf; S.below = r.below_zero || 0; S.at = r.at; S.state = 'ready'; S.err = null;
    } catch (e) {
      S.err = e; S.state = 'error';
      S.notReady = !!(e && e.data && e.data.code === 'STOCK_NOT_READY');   /* the server's code, never its sentence */
      if (typeof cblog === 'function') cblog(S.notReady ? 'warn' : 'error', 'operations: the stock read did not answer — ' + ((e && e.message) || e));
    }
    if (S.list) S.list.refresh();
  }
  function mount(host) {
    host.innerHTML = '<div class="ops-list" id="ops_stock_list" data-testid="ops-stock-list"></div>';
    if (S.list && S.list.destroy) { try { S.list.destroy(); } catch (e) { if (typeof cblog === 'function') cblog('warn', 'operations: stock list teardown — ' + e.message); } }
    S.list = CBList.mount(document.getElementById('ops_stock_list'), {
      key: 'ops-stock', t: tx, rows: function () { return S.rows; }, id: function (x) { return x.item_id; },
      rowTid: function (x) { return 'ops-stock-row-' + x.item_id; },
      columns: cols, defaultCols: ['name', 'qty', 'lots'], cardMax: 3, fill: true,
      head: function () {
        return { title: tx('Stock'), notices: S.state === 'ready' && S.below ? [{ text: txf('{n} below zero', { n: S.below }), cls: 'bad', tid: 'ops-stock-below' }] : [] };
      },
      state: function () { return S.state; }, onRetry: load,
      error: function () {
        return S.notReady ? { title: tx('Stock is not switched on yet.'), sub: tx('Your counts start once the server is updated. Nothing is lost.') }
          : { title: tx('Could not read your stock.'), sub: tx('Nothing was changed. Try again.') };
      },
      empty: { title: tx('No stock has moved yet'), sub: tx('Counts start with your first receipt or sale.') },
      search: function (x) { return [x.name, x.unit].concat((x.lots || []).map(function (l) { return l.lot; })).filter(Boolean).join(' '); },
      searchHint: tx('Item or batch'),
      filters: [
        { key: 'state', label: tx('On hand'), all: tx('Every item'), options: [{ v: 'below', label: tx('Below zero') }, { v: 'none', label: tx('None left') }, { v: 'some', label: tx('Some on hand') }],
          match: function (x, v) { return v === 'below' ? !!x.below_zero : v === 'none' ? Number(x.qty) === 0 : Number(x.qty) > 0; } },
        { key: 'lots', label: tx('Batches'), all: tx('With or without'), options: [{ v: 'yes', label: tx('Kept by batch') }, { v: 'no', label: tx('No batches') }],
          match: function (x, v) { return v === 'yes' ? (x.lots || []).length > 0 : !(x.lots || []).length; } },
      ],
      sorts: [
        /* the server's order IS the default: fewest on hand first, below zero on top */
        { key: 'low', label: tx('Fewest first'), cmp: function (a, b) { return S.rows.indexOf(a) - S.rows.indexOf(b); } },
        { key: 'az', label: tx('A–Z'), cmp: function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); } },
      ],
      next: function (x) {
        var l = x.lots || [];
        if (!l.length) return '<div class="ops-next">' + esc(tx('Not kept by batch.')) + '</div>';
        return '<div class="ops-next" data-testid="ops-stock-lots-' + esc(x.item_id) + '">' + l.map(function (b) {
          return '<div class="ops-lot"><b>' + esc(b.lot || tx('No batch')) + '</b><span>' + esc(String(b.qty) + (x.unit ? ' ' + x.unit : '')) + '</span><span>'
            + esc(b.expires_at ? txf('expires {date}', { date: day(b.expires_at) }) : tx('no expiry kept')) + '</span></div>';
        }).join('') + '</div>';
      },
    });
    load();
  }
  return { mount: mount, load: load };
})();
