/*
 * cap-attention.js — THE "NEEDS ATTENTION" STRIP (W15-102): one line, always at the top of the Day book, the Ledgers and the BAS page —
 * "⚠ n no tax invoice · ○ n no file · ○ n no source · ? n open queries" — each count a button that opens the entries behind it, newest first, a page at a time.
 * OWNER     cb-finance
 * OWNS      CBAttention.mount(host, { from, to }) · the list under the strip (CBList.nextTable + the pager pair)
 * CALLED BY cap-books.js (bkDaybook, bkLedgers) · cap-period.js (the BAS page) — the same strip, the same counts
 * FLOW      GET /api/books/attention?from&to (the SERVER counts, over the range, by the Day book's own rules — api lib/books-evidence attentionIn) → four counts → a press → the same route with kind= and a page
 * ⭐ NOTHING IS COUNTED IN THE BROWSER (growth5y: a year of entries is never fetched to be counted). At 0 the strip says "✓ all evidence in place".
 * IDS       CMP033-B01 (a count that opens its list) · CMP037-B06/B07 (the pager pair) · CMP039-B01 (a header sort, from CBList.nextTable)
 */
(function (root) {
  'use strict';
  var W = {
    title: 'Needs attention',
    ok: '✓ all evidence in place',
    flag: 'no tax invoice',
    none: 'no file',
    nodoc: 'no source',
    query: 'open queries',
    reading: 'Reading…',
    failed: 'The evidence counts could not be read',
    date: 'Date',
    entry: 'Entry',
    what: 'What',
    amount: 'Amount',
    prev: 'Previous',
    next: 'Next',
    empty: 'Nothing here'
  };
  var KINDS = [
    ['flag', '⚠', 'no_tax_invoice', 'flag'],
    ['none', '○', 'no_file', 'none'],
    ['nodoc', '○', 'no_source', 'nodoc'],
    ['query', '?', 'open_queries', 'query']
  ];
  var LIMIT = 25;
  var STATE = {};
  var tx = function (k) {
    return typeof root.tx === 'function' ? root.tx(W[k] || k) : W[k] || k;
  };
  var esc = function (v) {
    return typeof root.esc === 'function' ? root.esc(v) : String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };
  function key(id) {
    return STATE[id] || (STATE[id] = { counts: null, kind: '', page: 1, list: null, failed: false });
  }
  function range(host) {
    return { from: host.getAttribute('data-from'), to: host.getAttribute('data-to') };
  }
  function read(host, query) {
    var r = range(host);
    return root.api('booksAttention', { query: Object.assign({ from: r.from, to: r.to }, query || {}) });
  }
  function draw(host) {
    var s = key(host.id),
      c = s.counts;
    if (s.failed) {
      host.innerHTML = '<div class="attn-strip" data-b="attn-failed">' + esc(tx('failed')) + '</div>';
      return;
    }
    if (!c) {
      host.innerHTML = '<div class="attn-strip" data-b="attn-reading">' + esc(tx('reading')) + '</div>';
      return;
    }
    var total = 0;
    var chips = KINDS.map(function (item) {
      var n = c[item[2]];
      if (n == null) return ''; /* marking is not switched on: no query count to show */
      total += n;
      if (!n) return '';
      return (
        '<button type="button" class="attn-chip" data-cbsid="CMP033-B01" data-b="attn-' + item[0] + '" data-testid="attn-' + item[0] + '" aria-pressed="' + (s.kind === item[0]) + '" onclick="CBAttention.open(\'' + esc(host.id) + '\',\'' + item[0] + '\')">' +
        '<span aria-hidden="true">' + item[1] + '</span> <b>' + esc(String(n)) + '</b> ' + esc(tx(item[3] === 'flag' ? 'flag' : item[3] === 'none' ? 'none' : item[3] === 'nodoc' ? 'nodoc' : 'query')) + '</button>'
      );
    }).filter(Boolean).join(' · ');
    var body = total === 0 ? '<span class="attn-ok" data-b="attn-ok" data-testid="attn-ok">' + esc(tx('ok')) + '</span>' : chips;
    host.innerHTML = '<div class="attn-strip" role="status" data-testid="attn-strip"><b class="attn-t">' + esc(tx('title')) + '</b> ' + body + '</div>' + (s.list ? listHTML(host, s) : '');
  }
  function listHTML(host, s) {
    var l = s.list,
      rows = (l.entries || []).map(function (e) {
        return [
          esc(typeof root.bkDate === 'function' ? root.bkDate(e.posting_date) : e.posting_date),
          '<span class="mono">' + esc(e.entry_no) + '</span>',
          esc(e.narration || e.event_type || ''),
          e.total_minor == null ? '—' : esc(typeof root.bkMoney === 'function' ? root.bkMoney(e.total_minor) : e.total_minor)
        ];
      });
    var table = root.CBList.nextTable({
      id: 'attn-list',
      act: 'void',
      empty: tx('empty'),
      cols: [
        { k: 'date', label: tx('date'), w: 96 },
        { k: 'entry', label: tx('entry'), w: 120 },
        { k: 'what', label: tx('what') },
        { k: 'amount', label: tx('amount'), w: 120, r: true }
      ],
      rows: rows
    });
    var pages = Math.max(1, Math.ceil(Number(l.count || 0) / LIMIT)),
      press = function (side, off, step) {
        return '<button type="button" data-cbsid="CMP037-' + (side === 'prev' ? 'B06' : 'B07') + '" class="act quiet cbl-pgbtn" data-testid="attn-' + side + '"' + (off ? ' disabled' : '') + ' onclick="CBAttention.page(\'' + esc(host.id) + '\',' + step + ')">' + (side === 'prev' ? '‹ ' + esc(tx('prev')) : esc(tx('next')) + ' ›') + '</button>';
      };
    return (
      '<div class="attn-list" data-testid="attn-list"><div class="cbl" style="overflow-x:auto">' + table + '</div>' +
      (pages > 1 ? '<div class="attn-pager">' + press('prev', s.page <= 1, -1) + press('next', s.page >= pages, 1) + ' <span>' + s.page + ' / ' + pages + '</span></div>' : '') + '</div>'
    );
  }
  function css() {
    if (!root.document || root.document.getElementById('attn-css')) return;
    var st = root.document.createElement('style');
    st.id = 'attn-css';
    st.textContent =
      '.attn-strip{display:flex;flex-wrap:wrap;gap:2px 6px;align-items:center;padding:4px 12px;margin:0 0 6px;min-height:32px;border:1px solid var(--line,#d9d9d9);border-radius:10px;background:var(--card,#fff);font-size:var(--fs-1,13px)}' +
      '.attn-t{text-transform:uppercase;letter-spacing:.04em;font-size:11px;color:var(--grey,#666)}' +
      '.attn-strip button.attn-chip{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;gap:4px;align-items:center;min-height:24px;padding:0 8px;border-radius:6px;font:inherit}.attn-strip button.attn-chip:hover{background:var(--hov,#f1f1f1)}.attn-strip button.attn-chip:focus-visible{outline:2px solid var(--blue,#2563eb)}' +
      '.attn-chip[aria-pressed="true"]{background:var(--blue-t,#e0e9ff);font-weight:700}.attn-ok{color:var(--ok-3,#1a7f3c);font-weight:600}' +
      '.attn-col{display:block}.attn-flex{display:flex;flex-direction:column;height:100%;min-height:0}.attn-flex>#bk_lt{flex:1 1 0;min-height:0;height:auto}' +
      '.attn-list{margin:0 0 10px}.attn-pager{display:flex;gap:8px;align-items:center;padding:6px 0}';
    root.document.head.appendChild(st);
  }
  /** mount the strip in `host` (an element with an id) for the range { from, to }; reads the counts once, again when the range changes */
  function mount(host, r, onCounts) {
    if (!host) return;
    css();
    host.setAttribute('data-from', r.from);
    host.setAttribute('data-to', r.to);
    var s = key(host.id);
    s.counts = null;
    s.list = null;
    s.kind = '';
    s.failed = false;
    draw(host);
    read(host).then(
      function (reply) {
        s.counts = reply;
        draw(host);
        if (typeof onCounts === 'function') onCounts(reply);
      },
      function () {
        s.failed = true;
        draw(host);
      }
    );
  }
  function load(id, kind, page) {
    var host = root.document.getElementById(id),
      s = key(id);
    if (!host) return;
    s.kind = kind;
    s.page = page;
    read(host, { kind: kind, page: page, limit: LIMIT }).then(
      function (reply) {
        s.list = reply;
        draw(host);
      },
      function () {
        s.failed = true;
        draw(host);
      }
    );
  }
  /** a count pressed: its entries, newest first; the same count pressed again closes the list */
  function open(id, kind) {
    var s = key(id);
    if (s.kind === kind) {
      s.kind = '';
      s.list = null;
      draw(root.document.getElementById(id));
      return;
    }
    load(id, kind, 1);
  }
  function page(id, step) {
    var s = key(id);
    load(id, s.kind, Math.max(1, s.page + step));
  }
  /** the server's count of what wants the owner over the range (no tax invoice, or an open query) — the ⚑ Needs you toggle of the Day book says it; 0 until the strip has read */
  function needs(id) {
    var c = key(id).counts;
    return c && c.needs > 0 ? Number(c.needs) : 0;
  }
  root.CBAttention = { mount: mount, open: open, page: page, needs: needs, words: W };
})(typeof window !== 'undefined' ? window : this);
