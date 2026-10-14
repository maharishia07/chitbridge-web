/**
 * screen-id.js — CBScreenId: EVERY SMALL-APP SCREEN AND SHEET NUMBERED, AND THE ONE CHIP THAT SHOWS IT (round SCREEN-ID, 2026-10-14).
 *
 * Athi, 2026-10-14: *"if we have not numbered each screen it has to be numbered … if we are calling the task details from accounts, task
 * screen name should be visible in the task screen. so we know that we are calling the same function."*
 *
 * ── ONE REGISTER ── the workshop's screens are `public/app/screens.js` (CBSCREENS, generated from C:/dev/SCREENS.json by screens.cjs).
 * The small apps and the sheets were never in it. Their rows are DECLARED here (as screens.cjs declares the `_fineScreen` sub-views) and
 * MERGED into window.CBSCREENS (rows · byApp · bySheet) wherever a page loaded it, so the browser holds ONE register; screens.cjs should read DECLARED
 * below as an input; until it does, e2e/screen-id-guard.cjs keeps the two apart (no shared code, no shared prefix).
 * Codes are AAA### like every other (screens-register.cjs): assigned once, never reused. A new section or sheet kind = a new row here.
 *
 * ── ONE CHIP ── "Ledgers · BKS003": the screen's name and code, quiet, in the header; on a sheet, in the sheet's own title row — the code of
 * the screen ITSELF, never of the page that opened it: Task details shows TSK005 from CB Accounts, CB Finance and CB CRM alike. A tap copies
 * the code (for a bug report). On a phone the code alone: the name is the screen's own heading there (and the chip's aria-label).
 *
 *   CBScreenId.here(app, key)   the screen now on show (key: a section; absent → read from location.hash, else the app's first screen)
 *   CBScreenId.chip()           THE page chip — one element, moved into each repaint of a header (the bell's pattern)
 *   CBScreenId.sheetHTML(kind)  the chip for a sheet's title row (kind: task · bill · supplierbill)
 *   CBScreenId.row(app, key) · .sheet(kind) · .current() · .DECLARED · .rows · .byApp · .bySheet
 * Read by: app/shell.js (the CBShell bar) · app/page-frame.js (the skeleton's section) · app/chit-sheet.js (the sheet) ·
 * accounts.html · finance.html · crm.html (their own headers) · tools/screen-list.cjs (docs/SCREEN-LIST.md) · tools/graph (KG1 `opens`).
 */
(function (root) {
  'use strict';
  /* page: where the screen lives · key: its section (null = the page has one screen) · reach: how a person gets there */
  var DECLARED = {
    edition: 1, since: '2026-10-14',
    apps: [
      { app: 'home', name: 'Home', page: '/', rows: [['HOM001', null, 'Home', 'the address bar: /']] },
      { app: 'accounts', name: 'CB Accounts', page: '/accounts.html', hash: true, rows: [
        ['BKS001', 'todo', 'To do'], ['BKS002', 'daybook', 'Day book'], ['BKS003', 'ledgers', 'Ledgers'], ['BKS004', 'tb', 'Trial balance'],
        ['BKS005', 'pl', 'P&L'], ['BKS006', 'bs', 'Balance sheet'], ['BKS007', 'compare', 'Parallel run'], ['BKS008', 'receivables', 'Receivables'],
        ['BKS009', 'payables', 'Payables'], ['BKS010', 'dues', 'Dues', 'To do › a dues item'], ['BKS011', 'bills', 'Unpaid bills'], ['BKS012', 'cheques', 'Cheques'],
        ['BKS013', 'waiting', 'Waiting', 'To do › a posting that failed'], ['BKS014', 'bank', 'Bank'], ['BKS015', 'lock', 'Month lock'],
        ['BKS016', 'closingstock', 'Closing stock'], ['BKS017', 'assets', 'Assets & depreciation'], ['BKS018', 'accruals', 'Accruals & recurring'],
        ['BKS019', 'gstclose', 'GST close & pay'], ['BKS020', 'yearclose', 'Year close'], ['BKS021', 'packs', 'Packs'], ['BKS022', 'opening', 'Opening balances'],
        ['BKS023', 'accounts', 'Shop ledgers'], ['BKS024', 'movein', 'Move in'], ['BKS025', 'rates', 'Rates']] },
      { app: 'finance', name: 'CB Finance', page: '/finance.html', hash: true, rows: [
        ['FIN001', 'collections', 'Collections'], ['FIN002', 'payables', 'Payables'], ['FIN003', 'cash', 'Cash'], ['FIN004', 'terms', 'Terms'], ['FIN005', 'repeat', 'Repeat supply']] },
      { app: 'crm', name: 'CB CRM', page: '/crm.html', hash: true, rows: [
        ['CRM001', 'parties', 'Parties'], ['CRM002', 'chits', 'Chits'], ['CRM003', 'followups', 'Follow-ups'], ['CRM004', 'leads', 'Leads', 'Parties › Leads'],
        ['CRM005', 'calls', 'Calls', 'Parties › Calls'], ['CRM006', 'party', 'Party', 'Parties › a party'], ['CRM007', 'chit', 'Chit page', 'a sheet › Open page']] },
      { app: 'tasks', name: 'CB Tasks & Orders', page: '/tasks.html', rows: [
        ['TSK001', 'orders_in', 'Orders in'], ['TSK002', 'orders_out', 'Orders out'], ['TSK003', 'tasks', 'Tasks'], ['TSK004', 'done', 'Done']] },
      { app: 'settings', name: 'Settings', page: '/settings.html', hash: true, rows: [
        ['SET001', 'shop', 'Your shop'], ['SET002', 'country', 'Country'], ['SET003', 'new', 'New shop', 'the sign-in window › New shop? Register']] },
      { app: 'employees', name: 'CB Employees', page: '/employees.html', rows: [['EMP001', 'people', 'People']] },
      { app: 'network', name: 'Network', page: '/network.html', rows: [['NET001', 'mine', 'My network'], ['NET002', 'offers', 'Offers'], ['NET003', 'design', 'Design']] },
      { app: 'country-lab', name: 'Country lab', page: '/country-lab.html', rows: [['CLB001', 'compare', 'Side by side'], ['CLB002', 'ready', 'Where we are']] },
      { app: 'kyb', name: 'Know your business', page: '/know-your-business.html', rows: [['KYB001', null, 'Know your business']] },
      { app: 'documents', name: 'Documents', page: '/authority-forms.html', rows: [['DOC001', null, 'Documents']] }
    ],
    /* the chit sheet (app/chit-sheet.js CBSheet) — one painter, three kinds (its sheetKind()); opened from every page that loads it */
    sheets: [
      ['TSK005', 'task', 'Task details', 'app/chit-sheet.js', 'a task, order or invoice row'],
      ['BIL001', 'bill', 'Bill', 'app/chit-sheet.js', 'a counter bill row'],
      ['BIL002', 'supplierbill', 'Supplier bill', 'app/chit-sheet.js', 'a bill received']
    ]
  };

  /* ── the merge: one register in the browser ── */
  var ROWS = [], BYAPP = {}, BYSHEET = {}, BYCODE = {};
  DECLARED.apps.forEach(function (a) {
    BYAPP[a.app] = {};
    a.rows.forEach(function (r) {
      var row = { code: r[0], key: r[1], screen: r[2], app: a.app, appName: a.name, page: a.page, kind: r[1] ? 'tab' : 'page',
        group: a.name, path: a.name + ' › ' + r[2], reach: r[3] || (r[1] ? a.page + (a.hash ? '#' + (a.app === 'accounts' ? '' : '/') + r[1] : '') + ' · ' + a.name + ' › ' + r[2] : a.page),
        nav: null, since: DECLARED.since, declared: true };
      ROWS.push(row); BYCODE[row.code] = row; BYAPP[a.app][r[1] || ''] = row.code;
    });
  });
  DECLARED.sheets.forEach(function (s) {
    var row = { code: s[0], key: s[1], screen: s[2], app: null, page: null, kind: 'sheet', file: s[3], group: 'Sheet', path: 'Sheet › ' + s[2],
      reach: s[4] + ' › its sheet', nav: null, since: DECLARED.since, declared: true };
    ROWS.push(row); BYCODE[row.code] = row; BYSHEET[s[1]] = row.code;
  });
  /* the workshop's register (screens.js) is its own file's global: where a page loaded it, these rows join it; this file never creates it */
  var WS = root.CBSCREENS;
  if (WS && !WS.byApp) { WS.rows = (WS.rows || []).concat(ROWS); WS.byApp = BYAPP; WS.bySheet = BYSHEET; }

  function T(s) { return typeof root.tx === 'function' ? root.tx(s) : s; }
  /* escaping: the ONE esc (app/helpers.js, loaded first by every page) */
  function hashKey() { try { return (root.location.hash || '').replace(/^#\/?/, '').split(/[/?&]/)[0]; } catch (_) { return ''; } }
  function row(app, key) {
    var m = BYAPP[app]; if (!m) return null;
    var c = (key != null && m[key]) || (m[hashKey()]) || m[''] || null;
    if (!c) { var first = DECLARED.apps.filter(function (a) { return a.app === app; })[0]; c = first && first.rows[0][0]; }
    return c ? BYCODE[c] : null;
  }
  function sheet(kind) { var c = BYSHEET[kind]; return c ? BYCODE[c] : null; }

  /* ── the chip: tokens only (var(--token,#fallback)); the page's own ink, so it reads at AA in every theme the page reads in ── */
  var CSS = '.cbsid{display:inline-flex;align-items:center;gap:5px;flex:0 0 auto;min-height:24px;padding:2px 8px;border:1px solid var(--line,#d8ccb0);border-radius:999px;'
    + 'background:transparent;color:var(--ink,#2a2418);font:600 var(--fs-1,11px)/1.2 var(--sans,system-ui,sans-serif);white-space:nowrap;cursor:pointer}'
    + '.cbsid:hover{background:var(--hover,var(--panel,#f3ead7))}.cbsid:focus-visible{outline:2px solid var(--accent,#1f5f5b);outline-offset:2px}'
    + '.cbsid .cbsid-c{font-family:var(--mono,ui-monospace,monospace);letter-spacing:.02em}.cbsid:empty{display:none}'
    + '@media(max-width:700px){.cbsid .cbsid-n,.cbsid .cbsid-d{display:none}}';
  function ensureCss() {
    var d = root.document; if (!d || d.getElementById('cbsid-css')) return;
    var st = d.createElement('style'); st.id = 'cbsid-css'; st.textContent = CSS; (d.head || d.documentElement).appendChild(st);
  }
  function inner(r) {
    if (!r) return '';
    return '<span class="cbsid-n">' + root.esc(T(r.screen)) + '</span><span class="cbsid-d" aria-hidden="true">·</span><code class="cbsid-c" translate="no">' + root.esc(r.code) + '</code>';
  }
  function label(r) { return T(r.screen) + ' · ' + r.code + ' — ' + T('Tap to copy the screen code'); }
  function sheetHTML(kind) {
    var r = sheet(kind); if (!r) return '';
    ensureCss();
    return '<button type="button" class="cbsid" data-cbsid="' + root.esc(r.code) + '" data-testid="screen-id-sheet" aria-label="' + root.esc(label(r)) + '" title="' + root.esc(label(r)) + '">' + inner(r) + '</button>';
  }

  var S = { app: null, key: null, el: null };
  function chip() {
    if (S.el) return S.el;
    ensureCss();
    var b = root.document.createElement('button'); b.type = 'button'; b.className = 'cbsid'; b.setAttribute('data-testid', 'screen-id');
    S.el = b; paint(); return b;
  }
  function paint() {
    if (!S.el) return;
    var r = S.app ? row(S.app, S.key) : null;
    S.el.innerHTML = inner(r);
    if (r) { S.el.setAttribute('data-cbsid', r.code); S.el.setAttribute('aria-label', label(r)); S.el.title = label(r); }
    else S.el.removeAttribute('data-cbsid');
  }
  function here(app, key) { S.app = app; S.key = key == null ? null : String(key); paint(); }
  function current() { var r = S.app ? row(S.app, S.key) : null; return r ? r.code : null; }

  /* a tap copies the code; the chip says so for a moment. A browser that refuses the clipboard: the code stays on screen to read. */
  function copied(b, ok) {
    var n = b.querySelector('.cbsid-n'); if (!n) return;
    var was = n.textContent; n.textContent = T(ok ? 'Copied' : 'Not copied'); b.setAttribute('data-copied', ok ? '1' : '0');
    setTimeout(function () { n.textContent = was; b.removeAttribute('data-copied'); }, 1400);
  }
  function onTap(e) {
    var b = e.target && e.target.closest ? e.target.closest('.cbsid[data-cbsid]') : null; if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var code = b.getAttribute('data-cbsid');
    var nav = root.navigator;
    if (!nav || !nav.clipboard || !nav.clipboard.writeText) { console.warn('screen id: no clipboard in this browser - the code ' + code + ' stays on the chip to read'); copied(b, false); return; }
    nav.clipboard.writeText(code).then(function () { copied(b, true); }, function (err) {
      console.warn('screen id: the browser refused the clipboard - the code ' + code + ' stays on the chip to read', (err && err.message) || err);
      copied(b, false);
    });
  }
  if (root.document && root.addEventListener) {
    root.document.addEventListener('click', onTap, true);
    /* a language pack lands after the chip was painted (app/locale.js pack(): a script, no event of its own): its load repaints the name */
    root.document.addEventListener('load', function (e) { var t = e.target; if (t && t.id && String(t.id).indexOf('cb-strings-') === 0) paint(); }, true);
    /* a hash-routed page (Finance, CRM, Settings, Accounts) moves between sections by its address: the chip follows it */
    root.addEventListener('hashchange', function () { if (S.app && BYAPP[S.app] && BYAPP[S.app][hashKey()]) { S.key = hashKey(); paint(); } });
  }

  root.CBScreenId = { here: here, chip: chip, sheetHTML: sheetHTML, row: row, sheet: sheet, current: current, DECLARED: DECLARED,
    rows: ROWS, byApp: BYAPP, bySheet: BYSHEET };
})(typeof window !== 'undefined' ? window : globalThis);
