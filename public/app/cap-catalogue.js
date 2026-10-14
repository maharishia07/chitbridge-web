/**
 * cap-catalogue.js — CB CATALOGUE: what the shop sells, as a small app (T3-CATALOGUE, 14 Oct). catalogue.html is the gate and the frame; this is the screen.
 *
 * Three jobs, one section each: ITEMS (the list, server-paged, and one sheet per item to edit it) · CATEGORIES (the shelf: add · rename · retire ·
 * bring back) · IMPORT (a .csv or .xlsx, checked by the server before anything is written). Nothing here decides who may do what: a co-assist
 * without "Sees costs" may change availability only — the SERVER refuses the rest (routes/products.js PATCH, OFFR-04) and this page greys the
 * fields from the server's own codes (GET /api/entities/me/can-see-costs → can_see_costs · is_owner), never from a sentence.
 *
 * REUSE (named in the PR): CBList (list-ctl.js; `remote` = the server pages, searches and filters) · CBSteps (step-flow.js, the import's two steps) ·
 * CBAction (accounts-shell.js, M64) · api() + CB_CAT_EP (core.js · accounts-shell.js — the workshop's own transport and endpoint names) ·
 * catgIdsOf / catgSetOn / cbCatgLive / cbCatgCreate (core.js — a product's categories, one reader and one writer) · cbImportVerdict ·
 * cbItemDiff (catalogue-lines.js, LIFTED from app.html's _cfRun / prodDiff) · fmtMoney (helpers.js, M36) · the cost slot item_data.cost
 * { value, source, updated_at } that Offer Lab writes (lib/item-cost.js). Every write is an existing route: PATCH /products/:id { merge:true }
 * (RFC 7386), POST /products, POST /products/import(/preflight), POST·PUT·DELETE /definitions.
 * Flow steps (docs/process/flows.json): Catalogue · item edit · categories · import (CAT-1..4).
 *
 *   CBCatalogueApp.mount(el, { section: 'items' | 'categories' | 'import' }) → { show(section) }
 */
(function (root) {
  'use strict';
  var C = { el: null, sec: 'items', items: [], total: null, counts: null, q: '', status: '', loading: false, err: null, gen: 0,
    cost: { can_see_costs: false, is_owner: false, loaded: false }, cur: '', list: null, cats: null, catErr: null, catCounts: null, catList: null };
  var PAGE = 50;
  var STATUS = [['available', 'Available'], ['unavailable', 'Not available for now'], ['redundant', 'Redundant'], ['retired', 'Retired']];
  var SETTABLE = ['available', 'unavailable', 'retired'];   /* redundant needs the item that replaces it — set in the workshop for now */

  function T(s) { return typeof root.tx === 'function' ? root.tx(s) : s; }
  function $(id) { return root.document.getElementById(id); }
  function say(msg) { if (typeof root.toast === 'function') root.toast(msg); }
  function log(m) { if (typeof root.cblog === 'function') root.cblog('warn', 'catalogue: ' + m); }

  /* ── words and figures ── */
  function dataOf(p) { return (p && (p.item_data || p.data)) || {}; }
  function idOf(p) { return p && (p.item_id || p.id); }
  function statusOf(d) { var s = String((d && d.status) || '').toLowerCase().trim(); return STATUS.some(function (x) { return x[0] === s; }) ? s : 'available'; }
  function statusWord(s) { var w = STATUS.filter(function (x) { return x[0] === s; })[0]; return T(w ? w[1] : 'Available'); }
  function amountOf(v) { var n = root.CBMoney && root.CBMoney.amountOfLoose ? root.CBMoney.amountOfLoose(v) : (v && typeof v === 'object' ? Number(v.amount) : Number(v)); return isFinite(n) ? n : null; }
  function hasPrice(v) { return v != null && v !== '' && amountOf(v) != null; }
  /** the price as the currency writes it (M36). The CODE comes from the stamped price (or the shop's other items); none known → the bare figure, never a guessed currency */
  function figure(v) {
    var n = amountOf(v); if (n == null) return '—';
    var code = (v && typeof v === 'object' && v.currency) || C.cur;
    return code ? root.fmtMoney(n, code) : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  function costOf(d) { var c = d && d.cost; return c && typeof c === 'object' && c.value != null && isFinite(Number(c.value)) ? Number(c.value) : null; }
  /** a co-assist the owner has not given "Sees costs": availability only (the server's codes; the server still refuses on its own) */
  function blind() { return C.cost.loaded && !C.cost.is_owner && !C.cost.can_see_costs; }
  var BLIND_WHY = 'Your sign-in can change availability only. The owner can give you "Sees costs" in CB Employees.';
  function catNames(d) {
    var ids = root.catgIdsOf ? root.catgIdsOf(d) : [], live = C.cats || [];
    var names = ids.map(function (id) { var c = live.filter(function (x) { return x.id === id; })[0]; return c ? c.name : null; }).filter(Boolean);
    if (!names.length && Array.isArray(d.category_names)) names = d.category_names;
    return names.join(', ');
  }

  /* ── reads ── */
  function readCost() {
    return root.api('canSeeCosts').then(function (r) { C.cost = { can_see_costs: !!(r && r.can_see_costs), is_owner: !!(r && r.is_owner), loaded: true }; },
      function (e) { log('can-see-costs: ' + ((e && e.message) || e)); C.cost = { can_see_costs: false, is_owner: false, loaded: false }; });
  }
  function readCats(force) {
    return (root.cbCatgLive ? root.cbCatgLive(!!force) : Promise.resolve([])).then(function (l) { C.cats = l || []; });
  }
  /** one page of items — the server searches (?q), filters (?status) and pages (?limit · ?offset); `more` appends the next page */
  function readItems(more) {
    var gen = ++C.gen, query = { limit: PAGE, offset: more ? C.items.length : 0 };
    if (C.q) query.q = C.q;
    if (C.status) query.status = C.status;
    C.loading = true; if (!more) C.err = null;
    if (C.list && !more) C.list.refresh();
    return root.api('prodList', { query: query }).then(function (r) {
      if (gen !== C.gen) return;
      /* core.js unwrap hands back the ITEMS ARRAY with total · status_counts · category_counts riding on it (SIBS) */
      var rows = Array.isArray(r) ? r : ((r && r.items) || []);
      C.items = more ? C.items.concat(rows) : rows;
      C.total = r && typeof r.total === 'number' ? r.total : C.items.length;
      if (!more) C.counts = r && r.status_counts || null;
      if (!C.cur) { var withCode = C.items.filter(function (p) { var pr = dataOf(p).price; return pr && typeof pr === 'object' && pr.currency; })[0]; if (withCode) C.cur = dataOf(withCode).price.currency; }
    }, function (e) {
      if (gen !== C.gen) return;
      log('list: ' + ((e && e.message) || e));
      C.err = (e && e.status === 403) ? T('This sign-in cannot open the catalogue.') : T("Couldn't read your catalogue.");
      if (!more) { C.items = []; C.total = null; }
    }).then(function () { if (gen !== C.gen) return; C.loading = false; if (C.list) C.list.refresh(); paintBar(); });
  }

  /* ═══ ITEMS ═══ */
  function itemCols() {
    var cols = [
      { key: 'name', label: T('Item'), prio: 1, w: 260, html: true, value: function (p) { return dataOf(p).name || ''; },
        cell: function (p) { var d = dataOf(p), code = d.code || d.hsn || d.sku || ''; return '<b>' + esc(d.name || T('(no name)')) + '</b>' + (code ? ' <span class="sub mono">' + esc(code) + '</span>' : ''); } },
      { key: 'price', label: T('Price'), prio: 2, w: 130, num: true, cell: function (p) { var d = dataOf(p); return hasPrice(d.price) ? figure(d.price) : T('No price'); } },
      { key: 'unit', label: T('Unit'), prio: 4, w: 100, cell: function (p) { return dataOf(p).unit || '—'; } },
      { key: 'status', label: T('Availability'), prio: 3, w: 190, hfilter: 'status', html: true, cell: function (p) { return statusTag(statusOf(dataOf(p))); }, value: function (p) { return statusWord(statusOf(dataOf(p))); } },
      { key: 'cats', label: T('Categories'), prio: 5, w: 200, cell: function (p) { return catNames(dataOf(p)) || '—'; } }
    ];
    /* cost travels only to a caller who may read it (the server strips it otherwise): the column is there only then */
    if (C.cost.loaded && !blind()) cols.push({ key: 'cost', label: T('Cost'), prio: 6, w: 120, num: true, cell: function (p) { var c = costOf(dataOf(p)); return c == null ? T('Not set') : figure(c); } });
    return cols;
  }
  function statusTag(s) {
    var cls = s === 'available' ? 'green' : s === 'unavailable' ? 'amber' : '';
    return '<span class="tag ' + cls + '">' + esc(statusWord(s)) + '</span>';
  }
  function moreFoot() {
    if (C.total == null || C.items.length >= C.total) return C.items.length ? '<div class="sub" data-testid="cat-end">' + esc(T('End of list')) + '</div>' : '';
    return '<button type="button" class="act quiet" data-cat-more data-testid="cat-more">' + esc(T('Show {n} more').replace('{n}', Math.min(PAGE, C.total - C.items.length))) + '</button>';
  }
  function mountItems(host) {
    if (root.CBList.reset) root.CBList.reset('catalogue');
    C.list = root.CBList.mount(host, {
      key: 'catalogue', t: T, rows: function () { return C.items; }, id: idOf, rowTid: function (p) { return 'cat-row-' + idOf(p); },
      columns: itemCols(), defaultCols: ['name', 'price', 'status', 'cats'].concat(C.cost.loaded && !blind() ? ['cost'] : []),
      searchHint: T('Search name, code, anything'), tools: { csv: false },
      filters: [{ key: 'status', label: T('Availability'), all: T('Any'), options: [{ v: 'available', label: T('Available') }, { v: 'not-available', label: T('Not on sale') },
        { v: 'unavailable', label: T('Not available for now') }, { v: 'redundant', label: T('Redundant') }, { v: 'retired', label: T('Retired') }] }],
      state: function () { return C.err && !C.items.length ? 'error' : (C.loading && !C.items.length ? 'loading' : null); },
      error: function () { return { title: C.err, sub: T('Nothing was changed. Try again.') }; }, onRetry: function () { readItems(false); },
      empty: { title: T('No items yet'), sub: T('Add one, or import a file.') },
      remote: { total: function () { return C.total; }, filters: true, foot: moreFoot,
        onQuery: function (q) { C.q = String(q.q || '').trim(); C.status = (q.filt && q.filt.status) || ''; readItems(false); } },
      onOpen: function (p) { openItem(idOf(p)); }
    });
  }
  function paintBar() {
    var b = $('cat_bar'); if (!b || C.sec !== 'items') return;
    var n = C.total, a = C.counts && C.counts.available;
    b.innerHTML = '<span class="cat-count" data-testid="cat-count">' + (n == null ? esc(T(C.err ? 'Not read' : 'Reading…')) : '<b>' + n + '</b> ' + esc(T(n === 1 ? 'item' : 'items'))
        + (a != null && !C.q && !C.status && a !== n ? ' · <b>' + a + '</b> ' + esc(T('available')) : '')) + '</span>'
      + '<button type="button" class="act" id="cat_new" data-testid="cat-new">＋ ' + esc(T('New item')) + '</button>';
    $('cat_new').onclick = function () { openItem(null); };
  }

  /* ── the item sheet: the fields a shop edits every day; the rest stays in the workshop ── */
  function sheet(html) {
    var d = $('cat_sheet');
    d.innerHTML = '<button type="button" class="mx" id="cat_x" aria-label="' + esc(T('Close')) + '" title="' + esc(T('Close')) + '">✕</button>' + html;
    if (!d.open) { try { d.showModal(); } catch (e) { log('sheet: ' + e.message); d.setAttribute('open', ''); } }
    $('cat_x').onclick = closeSheet;
  }
  function closeSheet() { var d = $('cat_sheet'); if (!d) return; try { d.close(); } catch (e) { d.removeAttribute('open'); } d.innerHTML = ''; }
  function byId(id) { return C.items.filter(function (p) { return idOf(p) === id; })[0] || null; }
  function field(id, label, value, attrs, off) {
    return '<label for="' + id + '">' + esc(label) + '</label><input class="inp" id="' + id + '" data-testid="' + id.replace(/_/g, '-') + '" value="' + esc(value == null ? '' : value) + '"' + (attrs || '') + (off ? ' disabled' : '') + '>';
  }
  function openItem(id) {
    var p = id ? byId(id) : null, d = dataOf(p), nb = blind(), off = !!p && nb, ids = root.catgIdsOf ? root.catgIdsOf(d) : [];
    var code = (d.price && typeof d.price === 'object' && d.price.currency) || C.cur, c = costOf(d);
    var opts = SETTABLE.concat(SETTABLE.indexOf(statusOf(d)) < 0 ? [statusOf(d)] : []).map(function (s) { return '<option value="' + s + '"' + (statusOf(d) === s ? ' selected' : '') + '>' + esc(statusWord(s)) + '</option>'; }).join('');
    var chips = (C.cats || []).map(function (k) {
      var on = ids.indexOf(k.id) >= 0;
      return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-cid="' + esc(k.id) + '" aria-pressed="' + on + '"' + (off ? ' disabled' : '') + '>' + esc(k.name) + '</button>';
    }).join('');
    sheet('<h2 data-testid="cat-item-title">' + esc(p ? (d.name || T('(no name)')) : T('New item')) + '</h2>'
      + '<div id="cat_out" class="cat-out" role="status" data-testid="cat-out"></div>'
      + (off ? '<div class="why" data-testid="cat-blind-why">' + esc(T(BLIND_WHY)) + '</div>' : '')
      + '<div class="cat-form">'
      + field('cat_f_name', T('Name'), d.name, ' autocomplete="off"', off)
      + '<div class="cat-two"><div>' + field('cat_f_price', T('Price') + (code ? ' (' + code + ')' : ''), hasPrice(d.price) ? amountOf(d.price) : '', ' inputmode="decimal" autocomplete="off"', off) + '</div>'
      + '<div>' + field('cat_f_unit', T('Unit'), d.unit, ' autocomplete="off" placeholder="' + esc(T('piece, kg, box')) + '"', off) + '</div></div>'
      + field('cat_f_code', T('Code'), d.code || d.hsn || d.sku || '', ' autocomplete="off"', off)
      + '<label for="cat_f_desc">' + esc(T('Description')) + '</label><textarea class="inp" id="cat_f_desc" data-testid="cat-f-desc" rows="2"' + (off ? ' disabled' : '') + '>' + esc(d.desc || d.description || '') + '</textarea>'
      + '<label for="cat_f_status">' + esc(T('Availability')) + '</label><select class="inp" id="cat_f_status" data-testid="cat-f-status">' + opts + '</select>'
      + (chips ? '<span class="lbl">' + esc(T('Categories')) + '</span><div class="chips" id="cat_f_cats" data-testid="cat-f-cats">' + chips + '</div>' : '')
      /* cost: an input for those who may read it; a greyed line WITH its reason for those who may not — shown, never hidden */
      + (nb ? '<div class="cat-act no"><span class="lbl">' + esc(T('Cost')) + '</span><span class="why" data-testid="cat-cost-why">' + esc(T('Hidden for your sign-in.')) + '</span></div>'
            : field('cat_f_cost', T('Cost') + (code ? ' (' + code + ')' : ''), c == null ? '' : c, ' inputmode="decimal" autocomplete="off" placeholder="' + esc(T('Not set')) + '"'))
      + '<button type="button" class="act" id="cat_save" data-testid="cat-save">' + esc(T(p ? 'Save' : 'Add item')) + '</button>'
      + '</div>');
    Array.prototype.forEach.call(root.document.querySelectorAll('#cat_f_cats .chip'), function (b) {
      b.onclick = function () { var on = !b.classList.contains('on'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); };
    });
    $('cat_save').onclick = function () { save(p); };
  }
  /** the form → the item as it would be stored, then only what changed travels (merge:true) */
  function save(p) {
    var cur = dataOf(p), next = JSON.parse(JSON.stringify(cur)), out = $('cat_out'), v = function (k) { var el = $(k); return el ? String(el.value).trim() : null; };
    var bad = function (m) { out.textContent = m; out.setAttribute('data-tone', 'error'); };
    next.status = v('cat_f_status') || 'available';
    if (!(p && blind())) {
      next.name = v('cat_f_name');
      if (!next.name) return bad(T('Give it a name.'));
      var pr = v('cat_f_price');
      if (pr === '') delete next.price;
      else if (!(isFinite(Number(pr)) && Number(pr) >= 0)) return bad(T('The price is a number, like 120 or 12.50.'));
      else if (amountOf(cur.price) !== Number(pr)) next.price = Number(pr);   /* the server stamps the shop's currency (money.stampItem) */
      ['unit', 'code'].forEach(function (k) { var x = v('cat_f_' + k); if (x) next[k] = x; else delete next[k]; });
      var ds = v('cat_f_desc'); if (ds) next.desc = ds; else delete next.desc;
      if ($('cat_f_cats') && root.catgSetOn) root.catgSetOn(next, Array.prototype.map.call(root.document.querySelectorAll('#cat_f_cats .chip.on'), function (b) { return b.getAttribute('data-cid'); }));
      if ($('cat_f_cost')) {
        var cs = v('cat_f_cost');
        if (cs === '') { if (costOf(cur) != null) next.cost = null; }
        else if (!(isFinite(Number(cs)) && Number(cs) >= 0)) return bad(T('The cost is a number, like 80 or 8.50.'));
        else if (costOf(cur) !== Number(cs)) next.cost = { value: Number(cs), source: 'manual', updated_at: new Date().toISOString() };   /* the slot Offer Lab writes (lib/item-cost.js setCost) */
      }
    }
    var btn = $('cat_save');
    if (!p) {
      if (next.cost === null) delete next.cost;
      return root.CBAction.run(btn, function () { return root.api('prodAdd', { body: { item_data: next } }); },
        { key: 'cat-add', failed: T("Couldn't add the item"), out: out, outcome: function (r) { closeSheet(); say(T('Item added.')); readItems(false).then(function () { var nid = r && r.item && r.item.item_id; if (nid && byId(nid)) openItem(nid); }); } });
    }
    var patch = root.cbItemDiff(cur, next, true);
    if (!Object.keys(patch).length) { out.textContent = T('Nothing changed.'); out.setAttribute('data-tone', 'ok'); return; }
    root.CBAction.run(btn, function () { return root.api('prodEdit', { params: { id: idOf(p) }, body: { item_data: patch, merge: true } }); },
      { key: 'cat-save-' + idOf(p), failed: T("Couldn't save"), out: out, outcome: function (r) {
        var fresh = r && r.item; if (fresh) C.items = C.items.map(function (x) { return idOf(x) === idOf(p) ? fresh : x; });
        if (C.list) C.list.refresh();
        openItem(idOf(p)); var o = $('cat_out'); if (o) { o.textContent = T('Saved.'); o.setAttribute('data-tone', 'ok'); }
      } });
  }

  /* ═══ CATEGORIES ═══ */
  function readShelf() {
    C.catErr = null; C.catList = null;
    return Promise.all([root.api('defList', { query: { kind: 'category', all: 1 } }), root.api('prodList', { query: { limit: 1 } }).catch(function (e) { log('category counts: ' + ((e && e.message) || e)); return null; })])
      .then(function (rs) {
        C.catList = ((rs[0] && rs[0].definitions) || []).map(function (d) { return { id: d.definition_id, name: d.name, note: d.note || '', status: d.status || 'draft', rules: d.rules || {}, parent: (d.rules && d.rules.parent) || null }; });
        C.catCounts = rs[1] && rs[1].category_counts ? rs[1].category_counts : null;
      }, function (e) { log('categories: ' + ((e && e.message) || e)); C.catErr = T("Couldn't read your categories."); C.catList = []; });
  }
  function catById(id) { return (C.catList || []).filter(function (c) { return c.id === id; })[0] || null; }
  function mountCats(host) {
    if (root.CBList.reset) root.CBList.reset('categories');
    var shelf = root.CBList.mount(host, {
      key: 'categories', t: T, rows: function () { return C.catList || []; }, id: function (c) { return c.id; }, rowTid: function (c) { return 'cat-cat-' + c.id; },
      columns: [
        { key: 'name', label: T('Category'), prio: 1, w: 240, sort: 'name', html: true, value: function (c) { return c.name; }, cell: function (c) { var pa = c.parent && catById(c.parent); return '<b>' + esc(c.name) + '</b>' + (pa ? ' <span class="sub">' + esc(T('in')) + ' ' + esc(pa.name) + '</span>' : ''); } },
        { key: 'n', label: T('Items'), prio: 2, w: 100, num: true, sort: 'n', value: function (c) { return C.catCounts ? (C.catCounts[c.id] || 0) : -1; }, cell: function (c) { return C.catCounts ? String(C.catCounts[c.id] || 0) : '—'; } },
        { key: 'status', label: T('On the shelf'), prio: 3, w: 150, hfilter: 'status', html: true, value: function (c) { return c.status; }, cell: function (c) { return c.status === 'retired' ? '<span class="tag">' + esc(T('Retired')) + '</span>' : '<span class="tag green">' + esc(T('Live')) + '</span>'; } }
      ],
      filters: [{ key: 'status', label: T('On the shelf'), all: T('Any'), options: [{ v: 'live', label: T('Live') }, { v: 'retired', label: T('Retired') }], match: function (c, v) { return v === 'retired' ? c.status === 'retired' : c.status !== 'retired'; } }],
      sorts: [{ key: 'name', label: T('Name'), cmp: function (a, b) { return String(a.name).localeCompare(String(b.name)); } },
              { key: 'n', label: T('Most items'), cmp: function (a, b) { return ((C.catCounts || {})[b.id] || 0) - ((C.catCounts || {})[a.id] || 0); } }],
      search: function (c) { return c.name + ' ' + c.note; }, tools: { csv: false },
      state: function () { return C.catErr ? 'error' : (C.catList == null ? 'loading' : null); },
      error: function () { return { title: C.catErr, sub: T('Nothing was changed. Try again.') }; }, onRetry: function () { showCats(); },
      empty: { title: T('No categories yet'), sub: T('Add one to group your items.') },
      onOpen: function (c) { openCat(c.id); }
    });
    return shelf;
  }
  function showCats() {
    C.el.innerHTML = '<div class="cat-top" id="cat_cbar" data-testid="cat-cbar"><span class="cat-count" data-testid="cat-ccount"></span><button type="button" class="act" id="cat_cnew" data-testid="cat-cnew">＋ ' + esc(T('New category')) + '</button></div>'
      + '<div class="cat-list" id="cat_clist" data-testid="cat-clist"></div><dialog class="sheet" id="cat_sheet" data-testid="cat-sheet"></dialog>';
    wireSheet();
    $('cat_cnew').onclick = function () { openCat(null); };
    var shelf = mountCats($('cat_clist'));
    return readShelf().then(function () {
      var live = (C.catList || []).filter(function (c) { return c.status !== 'retired'; }).length, el = root.document.querySelector('[data-testid="cat-ccount"]');
      if (el) el.innerHTML = C.catErr ? esc(T('Not read')) : '<b>' + live + '</b> ' + esc(T(live === 1 ? 'live category' : 'live categories'));
      shelf.refresh();
    });
  }
  function openCat(id) {
    var c = id ? catById(id) : null, retired = c && c.status === 'retired', n = c && C.catCounts ? (C.catCounts[c.id] || 0) : null;
    sheet('<h2 data-testid="cat-cat-title">' + esc(c ? c.name : T('New category')) + '</h2>'
      + '<div id="cat_out" class="cat-out" role="status" data-testid="cat-out"></div>'
      + (c ? '<div class="sub" data-testid="cat-cat-n">' + (n == null ? '' : esc(n + ' ' + T(n === 1 ? 'item' : 'items'))) + (retired ? ' · ' + esc(T('Retired')) : '') + '</div>' : '')
      + '<div class="cat-form">' + field('cat_c_name', T('Name'), c ? c.name : '', ' autocomplete="off" maxlength="60"')
      + '<label for="cat_c_note">' + esc(T('Note')) + '</label><textarea class="inp" id="cat_c_note" data-testid="cat-c-note" rows="2">' + esc(c ? c.note : '') + '</textarea>'
      + '<button type="button" class="act" id="cat_c_save" data-testid="cat-c-save">' + esc(T(c ? 'Save' : 'Add category')) + '</button>'
      + (c ? '<button type="button" class="act quiet" id="cat_c_life" data-testid="cat-c-life">' + esc(T(retired ? 'Bring back' : 'Retire')) + '</button>' : '')
      + '</div>');
    $('cat_c_save').onclick = function () { saveCat(c); };
    if (c) $('cat_c_life').onclick = function () { lifeCat(c, n); };
  }
  function afterCat(msg) { return function () { closeSheet(); say(msg); readCats(true).then(showCats); }; }
  function saveCat(c) {
    var name = String($('cat_c_name').value || '').trim(), note = String($('cat_c_note').value || '').trim(), out = $('cat_out');
    if (name.length < 2) { out.textContent = T('A name of at least 2 letters.'); out.setAttribute('data-tone', 'error'); return; }
    /* the database holds one live name per shop (definition UNIQUE (entity_id, kind, name), b160) — said here before the server says it */
    var clash = (C.catList || []).filter(function (x) { return (!c || x.id !== c.id) && x.status !== 'retired' && x.name.toLowerCase() === name.toLowerCase(); })[0];
    if (clash) { out.textContent = T('You already have a live category with that name.'); out.setAttribute('data-tone', 'error'); return; }
    root.CBAction.run($('cat_c_save'), function () {
      /* PUT replaces `rules` whole (a new version): every rule key is re-sent, or a rename would drop the parent and the default tax slab (cap-categories.js cbcatSave) */
      return c ? root.api('defSave', { params: { id: c.id }, body: { name: name, note: note, rules: c.rules || {} } })
               : root.cbCatgCreate(name).then(function (k) { return note ? root.api('defSave', { params: { id: k.id }, body: { name: k.name, note: note, rules: {} } }) : k; });
    }, { key: 'cat-c-save', failed: T("Couldn't save"), out: out, outcome: afterCat(c ? T('Saved. Every item in it follows.') : T('Category added.')) });
  }
  function lifeCat(c, n) {
    var back = c.status === 'retired', btn = $('cat_c_life');
    var run = function () { return back ? root.api('defSave', { params: { id: c.id }, body: { status: 'live' } }) : root.api('defRetire', { params: { id: c.id } }); };
    var o = { key: 'cat-c-life', failed: T("Couldn't change that"), out: $('cat_out'), outcome: afterCat(back ? T('Back on the shelf.') : T('Retired.')) };
    if (back) return root.CBAction.run(btn, run, o);
    o.confirm = { title: T('Retire this category?'), body: esc(n ? T('Its items keep it, marked retired. Nothing is deleted.') : T('Nothing uses it. Nothing is deleted.')), yes: T('Retire'), danger: true };
    root.CBAction.run(btn, run, o);
  }

  /* ═══ IMPORT — File → Check; the server reads the file and plans, this page paints the plan and sends the person's choices ═══ */
  var IMP = { name: '', body: null, res: null, err: null, dec: {}, done: null, flow: null, reading: false };
  function showImport() {
    IMP = { name: '', body: null, res: null, err: null, dec: {}, done: null, flow: null, reading: false };
    C.el.innerHTML = '<div class="cat-imp" data-testid="cat-import"><div id="cat_imp_rail"></div><p class="sub" id="cat_imp_sub"></p><div id="cat_imp_body"></div><div id="cat_imp_foot"></div></div>';
    IMP.flow = root.CBSteps.create({
      steps: [{ k: 'file', n: T('File'), t: T('A .csv or .xlsx, a heading row first.') }, { k: 'check', n: T('Check'), t: T('What each column becomes. Nothing is written yet.') }],
      railEl: 'cat_imp_rail', bodyEl: 'cat_imp_body', footEl: 'cat_imp_foot', subEl: 'cat_imp_sub',
      render: impStep, guard: impGuard, sendLabel: function () { return T('Import'); }, nextLabel: function () { return T('Check →'); },
      onSend: impSend, onStep: function () { impWire(); }, nextTestid: 'cat-imp-next', sendTestid: 'cat-imp-go', backTestid: 'cat-imp-back'
    });
    IMP.flow.paint(); impWire();
  }
  function impStep(k) {
    if (IMP.done) return impDoneHTML();
    if (k === 'file') {
      return '<label class="lbl" for="cat_imp_file">' + esc(T('Your file')) + '</label><input class="inp" type="file" id="cat_imp_file" data-testid="cat-imp-file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">'
        + '<div class="sub" role="status" data-testid="cat-imp-filemsg">' + esc(IMP.reading ? T('Reading…') : IMP.err ? '' : IMP.res ? IMP.name + ' · ' + T('read') : T('Items are added or updated. Nothing is deleted.')) + '</div>'
        + (IMP.err ? '<div class="err" data-testid="cat-imp-err">' + esc(IMP.err) + '</div>' : '');
    }
    var r = (IMP.res && IMP.res.report) || {}, s = r.summary || {}, acc = (IMP.res && IMP.res.accepted) || [];
    var head = '<div class="cat-imp-sum" data-testid="cat-imp-sum"><b>' + (s.rows || 0) + '</b> ' + esc(T('rows read')) + ' · <b>' + (s.importable || 0) + '</b> ' + esc(T('would import'))
      + (s.errors ? ' · <b class="bad">' + s.errors + '</b> ' + esc(T('with problems')) : '') + '</div>';
    var cols = (r.mapping || []).map(function (m, i) {
      var v = root.cbImportVerdict(m), ctl;
      if (v.fixed) ctl = '<span class="sub">' + esc(T('Not importable')) + '</span>';
      else {
        var cur = IMP.dec[i] != null ? IMP.dec[i] : v.start;
        ctl = '<select class="inp" data-imp="' + i + '" data-testid="cat-imp-dec-' + i + '" aria-label="' + esc(m.incoming || T('Column') + ' ' + (i + 1)) + '"><option value="ignore">' + esc(T('Leave it out')) + '</option>'
          + acc.map(function (f) { return '<option value="map:' + esc(f) + '"' + (cur === 'map:' + f ? ' selected' : '') + '>' + esc(T('Use as')) + ' ' + esc(f) + '</option>'; }).join('')
          + (!m.canonical ? '<option value="create"' + (cur === 'create' ? ' selected' : '') + '>' + esc(T('Add as a new column')) + '</option>' : '') + '</select>';
      }
      return '<div class="cat-col" data-testid="cat-imp-col-' + i + '"><div class="cat-col-h"><span class="mark ' + v.tone + '" aria-hidden="true">' + esc(v.mark) + '</span> <b class="mono">' + esc(m.incoming || T('(blank)')) + '</b></div>'
        + ctl + '<div class="sub">' + esc(m.conflict || m.why || T(v.why)) + '</div></div>';
    }).join('');
    var issues = (r.issues || []).slice(0, 25).map(function (x) { return '<li class="' + (x.severity === 'error' ? 'bad' : '') + '">' + esc(T('Row')) + ' ' + x.row + ' · <b>' + esc(x.column) + '</b>: ' + esc(x.message) + '</li>'; }).join('');
    return head + '<div class="cat-cols">' + cols + '</div>' + (issues ? '<ul class="cat-issues" data-testid="cat-imp-issues">' + issues + '</ul>' : '');
  }
  function impGuard(k) {
    if (IMP.done) return T('Imported. Pick another file to import more.');
    if (k === 'file') return IMP.reading ? T('Reading…') : IMP.err ? IMP.err : IMP.res ? null : T('Pick a .csv or .xlsx file first.');
    var s = (IMP.res && IMP.res.report && IMP.res.report.summary) || {};
    if (s.errors) return T('Fix the row problems in the file first.');
    return impDecisions().some(function (d) { return d.action !== 'ignore'; }) ? null : T('Every column is set to be left out.');
  }
  function impDecisions() {
    return (((IMP.res && IMP.res.report) || {}).mapping || []).map(function (m, i) {
      var v = root.cbImportVerdict(m); if (v.fixed) return { incoming: m.incoming, action: 'ignore' };
      var d = IMP.dec[i] != null ? IMP.dec[i] : v.start;
      return d === 'create' ? { incoming: m.incoming, action: 'create' } : d.indexOf('map:') === 0 ? { incoming: m.incoming, action: 'map', field: d.slice(4) } : { incoming: m.incoming, action: 'ignore' };
    });
  }
  function impWire() {
    var f = $('cat_imp_file'); if (f) f.onchange = function () { impPick(f.files && f.files[0]); };
    Array.prototype.forEach.call(root.document.querySelectorAll('[data-imp]'), function (s) { s.onchange = function () { IMP.dec[+s.getAttribute('data-imp')] = s.value; IMP.flow.paintFoot(); }; });
  }
  function impPaint() { IMP.flow.paint(); impWire(); }
  /** read the file in the browser (text for .csv, base64 for .xlsx — what the routes take) and ask the server's preflight; nothing is written */
  function impPick(file) {
    if (!file) return;
    IMP = { name: file.name, body: null, res: null, err: null, dec: {}, done: null, flow: IMP.flow, reading: true }; impPaint();
    var xlsx = /\.xlsx$/i.test(file.name), rd = new root.FileReader();
    rd.onerror = function () { log('file read: ' + (rd.error && rd.error.message)); IMP.reading = false; IMP.err = T("Couldn't open that file. Try saving it again."); impPaint(); };
    rd.onload = function () {
      var raw = String(rd.result || '');
      IMP.body = xlsx ? { xlsx: raw.slice(raw.indexOf(',') + 1) } : { csv: raw.replace(/^﻿/, '') };
      root.api('prodPreflight', { body: IMP.body }).then(function (res) { IMP.res = res; }, function (e) { log('preflight: ' + ((e && e.message) || e)); IMP.err = (e && e.status >= 400 && e.status < 500 && e.message) || T("Couldn't check the file. Nothing was changed."); })
        .then(function () { IMP.reading = false; impPaint(); });
    };
    if (xlsx) rd.readAsDataURL(file); else rd.readAsText(file);
  }
  function impSend() {
    var dec = impDecisions(), using = dec.filter(function (d) { return d.action !== 'ignore'; }).length, creating = dec.filter(function (d) { return d.action === 'create'; }).length;
    var btn = root.document.querySelector('[data-testid="cat-imp-go"]');
    root.CBAction.run(btn, function () { return root.api('prodImport', { body: Object.assign({}, IMP.body, { decisions: dec, confirm: true }) }); }, {
      key: 'cat-import', failed: T("Couldn't import. Nothing was changed."), onFail: function (w) { IMP.err = w; IMP.flow.go(0); impPaint(); },
      confirm: { title: T('Import {n} columns?').replace('{n}', using), body: esc(creating ? T('It also adds {n} new columns. Nothing is deleted.').replace('{n}', creating) : T('Items are added or updated. Nothing is deleted.')), yes: T('Import'), danger: false },
      outcome: function (r) { IMP.done = r || {}; impPaint(); C.items = []; C.total = null; }
    });
  }
  function impDoneHTML() {
    var r = IMP.done, s = r.summary || {}, failed = (r.outcome || []).filter(function (o) { return o.action === 'failed'; });
    return '<div class="cat-done" data-testid="cat-imp-done"><b>' + esc(r.message || T('Imported')) + '</b>' + (s.failed ? ' · <span class="bad">' + s.failed + ' ' + esc(T('not imported')) + '</span>' : '') + '</div>'
      + ((r.created_columns || []).length ? '<div class="sub">' + esc(T('New columns')) + ': ' + r.created_columns.map(esc).join(', ') + '</div>' : '')
      + (failed.length ? '<ul class="cat-issues">' + failed.slice(0, 25).map(function (o) { return '<li class="bad">' + esc(T('Row')) + ' ' + o.line + ' · ' + esc(o.name || '') + ': ' + esc(o.message || '') + '</li>'; }).join('') + '</ul>' : '')
      + '<button type="button" class="act quiet" data-cat-again data-testid="cat-imp-again">' + esc(T('Import another file')) + '</button>';
  }

  /* ═══ the sections ═══ */
  function wireSheet() {
    var d = $('cat_sheet');
    d.addEventListener('cancel', function (e) { e.preventDefault(); closeSheet(); });
    d.addEventListener('click', function (e) { if (e.target === d) closeSheet(); });
  }
  function showItems() {
    C.el.innerHTML = '<div class="cat-top" id="cat_bar" data-testid="cat-bar"></div><div class="cat-list" id="cat_list" data-testid="cat-list"></div><dialog class="sheet" id="cat_sheet" data-testid="cat-sheet"></dialog>';
    wireSheet(); paintBar(); mountItems($('cat_list'));
    if (!C.items.length || C.total == null) readItems(false);
  }
  function show(sec) {
    C.sec = sec === 'categories' || sec === 'import' ? sec : 'items';
    if (C.list) { try { C.list.destroy(); } catch (e) { log('list: ' + e.message); } C.list = null; }
    if (C.sec === 'categories') return showCats();
    if (C.sec === 'import') return showImport();
    showItems();
  }
  function mount(el, o) {
    C.el = el; o = o || {};
    el.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-cat-more],[data-cat-again]') : null; if (!t) return;
      if (t.hasAttribute('data-cat-more')) { t.disabled = true; readItems(true); } else showImport();
    });
    el.innerHTML = '<div class="loadwrap"><span class="spin"></span> ' + esc(T('Loading')) + '</div>';
    /* the cost answer and the shelf come first: the list's columns and the sheet's fields depend on them */
    Promise.all([readCost(), readCats(false)]).then(function () { show(o.section); });
    return { show: show };
  }
  root.CBCatalogueApp = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
