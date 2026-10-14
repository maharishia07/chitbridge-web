/* app/cap-suppliers.js — SUPPLIERS: the list rules the workshop and CB Operations share, and CB Operations' Suppliers list (T3-OPS, 2026-10-14).
 *
 * ⭐ LIFTED, NOT COPIED (CLAUDE.md rule 1 · the Tier 3 port rule): supName · supKindOf · supReachOf · supReachOptions were app.html's own
 * (suppliersScreen and its CBList declaration, supListOpts). They live here now and app.html loads this file, so the workshop's Trade/Other
 * tabs and "How you order" filter and CB Operations' list answer from ONE copy.
 *
 * CBSuppliers.mount(host) — CB Operations › Suppliers (operations.html): the supplier list (GET /api/relationships/suppliers, the
 * supplier_list route) on CBList (list-ctl.js), grouped Trade · Other, each row's readiness the SERVER's facts — on ChitBridge (lib/istest
 * mayTradeSql → on_rail) and a published catalogue (has_catalogue) — and two writes: Add by name (a local supplier, off the rail) ·
 * Link by their ChitBridge ID (supAdd, CB_PARTY_EP), and Remove (supDel). Every write goes through CBAction; a refusal paints the
 * server's sentence. A row's full record is CB CRM's (one record per party — the link opens it there).
 * ⚠️ NOT HERE (OPS-S2): the certificate check — what you require of a supplier vs what they declare. It stays in the workshop this round.
 * Flow: P2P step 1 · supplier list (docs/process/P2P.md).
 * Needs: api · tx · txf · esc · toast · CBAction · CBList; EP with CB_PARTY_EP.
 */
'use strict';

/** the name a shop reads for a supplier: its own label first, then the name they registered */
function supName(x){ return (x&&(x.nickname||x.display_name))||'—'; }
/** Trade (resale: what arrives is offered to the catalogue) or Other (own_use: never offered) — the supplier's flag, the server's column */
function supKindOf(x){ return (x&&x.supply_kind==='own_use')?'own_use':'resale'; }
/**
 * ⭐ "CAN I ACTUALLY ORDER FROM THEM?" — three states, from the server's two facts: a catalogue to call ('cat'), on the rail with nothing on it
 * ('nocat'), not on ChitBridge at all ('off'). The workshop's "How you order" filter and CB Operations' Readiness column read this one rule.
 */
function supReachOf(x){ return x && x.on_rail===false ? 'off' : (x && x.has_catalogue ? 'cat' : 'nocat'); }
function supReachOptions(){
  return [{v:'cat',label:tx('📕 Has a catalogue')},{v:'nocat',label:tx('On ChitBridge, no catalogue')},{v:'off',label:tx('🧾 Not on ChitBridge')}];
}

var CBSuppliers = (function () {
  var S = { rows: [], state: 'loading', err: null, list: null, host: null };
  var READY = { cat: 'Ready to order', nocat: 'No catalogue yet', off: 'Not on ChitBridge' };
  function kindWord(x) { return supKindOf(x) === 'own_use' ? tx('Other') : tx('Trade'); }
  function readyCell(x) {
    var r = supReachOf(x), tone = r === 'cat' ? 'ok' : 'dim';
    return '<span class="ops-chip ' + tone + '" data-testid="ops-sup-ready-' + esc(x.supplier_list_id) + '">' + esc(tx(READY[r])) + '</span>';
  }
  function cols() {
    return [
      { key: 'name', label: tx('Supplier'), prio: 1, w: 220, html: true, value: function (x) { return supName(x); },
        cell: function (x) { return '<b>' + esc(supName(x)) + '</b>' + (x.preferred ? ' <span title="' + esc(tx('Preferred')) + '">★</span>' : ''); } },
      { key: 'ready', label: tx('Readiness'), prio: 2, w: 170, html: true, cell: readyCell, value: function (x) { return supReachOf(x); } },
      { key: 'kind', label: tx('Kind'), prio: 3, w: 90, cell: kindWord },
      { key: 'category', label: tx('Category'), prio: 4, w: 130, cell: function (x) { return x.category || '—'; } },
      { key: 'id', label: tx('ChitBridge ID'), prio: 5, w: 160, mono: true, cell: function (x) { return x.on_rail === false ? '—' : (x.user_id || x.bridge_id || '—'); } },
    ];
  }
  async function load() {
    S.state = 'loading'; if (S.list) S.list.refresh();
    try {
      var r = await api('supList');
      S.rows = Array.isArray(r) ? r : ((r && r.suppliers) || []);   /* api()'s unwrap hands a `suppliers` answer back as the bare array (core.js) — as the workshop reads it */ S.state = 'ready'; S.err = null;
    } catch (e) {
      S.err = e; S.state = 'error';
      if (typeof cblog === 'function') cblog('error', 'operations: the supplier list did not load — ' + ((e && e.message) || e));
    }
    if (S.list) S.list.refresh();
  }
  /** Add by name (off the rail) or Link by their ChitBridge ID — the existing POST /api/relationships/suppliers; the server's sentence on a refusal */
  function add(btn, how) {
    var inp = document.getElementById('ops_sup_new'), out = document.getElementById('ops_sup_err'), v = String((inp && inp.value) || '').trim();
    out.textContent = '';
    if (!v) { out.textContent = how === 'link' ? tx('Type their ChitBridge ID or e-mail first.') : tx('Type the supplier\'s name first.'); return; }
    var body = how === 'link' ? { supplier_bridge_id: v } : { name: v };
    CBAction.run(btn, function () { return api('supAdd', { body: body }); }, {
      key: 'ops-sup-' + how, out: out,
      /* a refused link is the server's 404 WITH its sentence ("No business with that User ID…") — by the status and the body's own message,
         never by matching words; CBAction's general words keep a bare 404 (a route that is not there) as "did not go through" */
      onFail: function (w, e) { out.textContent = (e && e.status === 404 && e.data && e.data.message) ? e.data.message : w; },
      outcome: function () { inp.value = ''; toast(how === 'link' ? tx('Supplier linked') : tx('Supplier added')); load(); },
    });
  }
  function remove(x) {
    var btn = document.querySelector('[data-testid="ops-sup-remove"][data-actrow="' + (window.CSS && CSS.escape ? CSS.escape(x.supplier_list_id) : x.supplier_list_id) + '"]');
    CBAction.run(btn, function () { return api('supDel', { params: { id: x.supplier_list_id } }); }, {
      key: 'ops-sup-remove-' + x.supplier_list_id,
      confirm: { title: txf('Remove {name}?', { name: supName(x) }), body: esc(tx('Your bills and purchases with them stay. They leave this list only.')), yes: tx('Remove') },
      outcome: function () { toast(tx('Removed from your suppliers')); load(); },
    });
  }
  function mount(host) {
    S.host = host;
    host.innerHTML = '<div class="ops-bar" data-testid="ops-sup-bar">'
      + '<input class="inp" id="ops_sup_new" data-testid="ops-sup-new" autocomplete="off" placeholder="' + esc(tx('Name, or their ChitBridge ID')) + '" aria-label="' + esc(tx('Name, or their ChitBridge ID')) + '">'
      + '<button type="button" class="act" data-testid="ops-sup-add">' + esc(tx('Add by name')) + '</button>'
      + '<button type="button" class="act ghost" data-testid="ops-sup-link">' + esc(tx('Link by ID')) + '</button></div>'
      + '<div class="err" id="ops_sup_err" data-testid="ops-sup-err" role="status"></div>'
      + '<div class="ops-list" id="ops_sup_list" data-testid="ops-sup-list"></div>';
    host.querySelector('[data-testid="ops-sup-add"]').onclick = function () { add(this, 'name'); };
    host.querySelector('[data-testid="ops-sup-link"]').onclick = function () { add(this, 'link'); };
    if (S.list && S.list.destroy) { try { S.list.destroy(); } catch (e) { if (typeof cblog === 'function') cblog('warn', 'operations: suppliers list teardown — ' + e.message); } }
    S.list = CBList.mount(document.getElementById('ops_sup_list'), {
      key: 'ops-suppliers', t: tx, rows: function () { return S.rows; }, id: function (x) { return x.supplier_list_id; },
      rowTid: function (x) { return 'ops-sup-row-' + x.supplier_list_id; },
      columns: cols, defaultCols: ['name', 'ready', 'kind', 'category'], cardMax: 3, fill: true,
      head: function () {
        var n = S.rows.filter(function (x) { return supReachOf(x) !== 'cat'; }).length;
        return { title: tx('Suppliers'), notices: S.state === 'ready' && n ? [{ text: txf('{n} not ready to order', { n: n }), tid: 'ops-sup-notready' }] : [] };
      },
      state: function () { return S.state; }, onRetry: load,
      error: function () { return { title: tx('Could not read your suppliers.'), sub: tx('Nothing was changed. Try again.') }; },
      empty: { title: tx('No suppliers yet'), sub: tx('Add one by name, or link them by their ChitBridge ID.') },
      search: function (x) { return [x.nickname, x.display_name, x.category, x.user_id, x.bridge_id, x.party_no].filter(Boolean).join(' '); },
      searchHint: tx('Name, ID, category'),
      group: { options: [['kind', tx('Kind')], ['none', tx('None')]], default: 'kind', tid: 'ops-sup', as: 'select',
        fig: function (rows) { return txf('{n} suppliers', { n: rows.length }); },
        by: function (x, mode) { return mode === 'kind' ? [kindWord(x), supKindOf(x)] : null; } },
      filters: [
        { key: 'reach', label: tx('How you order'), all: tx('However you order'), options: supReachOptions(), match: function (x, v) { return supReachOf(x) === v; } },
        { key: 'pref', label: tx('Preferred'), all: tx('Preferred or not'), options: [{ v: 'yes', label: tx('★ Preferred only') }, { v: 'no', label: tx('Not preferred') }],
          match: function (x, v) { return v === 'yes' ? !!x.preferred : !x.preferred; } },
      ],
      sorts: [
        { key: 'pref', label: tx('★ Preferred first'), cmp: function (a, b) { return (b.preferred ? 1 : 0) - (a.preferred ? 1 : 0) || String(supName(a)).localeCompare(String(supName(b))); } },
        { key: 'az', label: tx('A–Z'), cmp: function (a, b) { return String(supName(a)).localeCompare(String(supName(b))); } },
      ],
      next: function (x) {
        return '<div class="ops-next"><span>' + esc(x.on_rail === false ? tx('Not on ChitBridge — you record what you buy from them yourself.')
          : x.has_catalogue ? tx('On ChitBridge with a catalogue — you can order from it.') : tx('On ChitBridge, but nothing published to order from yet.')) + '</span></div>';
      },
      actions: [
        { id: 'record', label: tx('Open record'), icon: '↗', tid: 'ops-sup-record', run: function (x) { location.href = '/crm.html#/party/' + encodeURIComponent(x.party_no || x.supplier_entity_id); } },
        { id: 'remove', label: tx('Remove'), tid: 'ops-sup-remove', run: remove },
      ],
    });
    load();
  }
  return { mount: mount, load: load };
})();
