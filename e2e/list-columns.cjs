#!/usr/bin/env node
/**
 * list-columns.cjs - THE COLUMN CHOOSER (list-ctl.js tblCols*), RUN FOR REAL IN A VM.
 *
 * Athi, 2026-10-02 ("Maximum three columns", DECISIONS.md): a list KEEPS every column, SHOWS its top three by the
 * priority it declares, and the chooser shows / hides / orders the rest, remembered per list.
 * Proves: default 3 visible - a 4th ticked shows - the choice survives a reload (a fresh page, the same storage) -
 * storage that THROWS still renders 3 and still honours a tick for the session - the top column cannot be unticked -
 * a tick that does not fit is named "hidden - no room", never silently ignored - on a phone every tick is a card line.
 * The browser side (the button in the bar, the pixels) is e2e/books-web.cjs.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'list-ctl.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  XX   ' + m); } };

const COLS = ['party', 'amount', 'date', 'bill', 'kind'].map((k, i) => ({ key: k, label: k.toUpperCase(), w: '200px', cell: (r) => r[k] }));
const PRIO = ['party', 'amount', 'date', 'bill', 'kind'];

function page(store, o) {
  o = o || {};
  const box = {
    console, esc: (s) => String(s == null ? '' : s), tx: (s) => s, txf: (s) => s, emptyState: () => '', lazyWrap: () => '',
    mvBtn: (g, okk, t, js) => '<button class="mv-btn"' + (okk ? '' : ' disabled') + '>' + g + '</button>',
    document: { getElementById: () => ({ clientWidth: o.width || 1000 }), head: null }, UI: o.mob ? { vp: 'mob' } : {},
    localStorage: store, setTimeout, clearTimeout,
  };
  box.window = box; box.globalThis = box; box.self = box;
  vm.createContext(box);
  vm.runInContext(SRC, box, { filename: 'list-ctl.js' });
  box.listCtl('t', { rows: () => [], text: () => '', tbl: true, repaint() {} });
  return { box, fit: () => box.tblFitBox('t', COLS, PRIO, 'tbox', false).map((c) => c.key), menu: () => box.tblColsMenuHTML('t') };
}
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; };
const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };

console.log('\n== list-columns: the chooser ==');
const store = mem();
let p = page(store);
ok(p.fit().join() === 'party,amount,date', 'default: the top three by priority are shown (party, amount, date) - declaration order');
ok(/data-testid="cols-btn-t"/.test(p.box.listCtlToolbarHTML('t')), 'the bar of a table list carries the columns button');
ok(/Shown/.test(p.menu()) && /Available/.test(p.menu()) && (p.menu().match(/type="checkbox"/g) || []).length === 5, 'the chooser lists ALL five columns: Shown and Available');
ok(/data-testid="cols-t-party" checked disabled/.test(p.menu()), 'the top-priority column is ticked and disabled');
p.box.tblColsToggle('t', 'party');
ok(p.fit().join() === 'party,amount,date', 'the top column cannot be unticked (toggle ignored)');
p.box.tblColsToggle('t', 'bill');
ok(p.fit().join() === 'party,amount,date,bill', 'ticking a 4th column shows it');
ok(!/data-testid="cols-t-bill" [^>]*disabled/.test(p.menu()) && /data-testid="cols-t-bill" checked/.test(p.menu()), 'the ticked one is checked and can be unticked again');
p.box.tblColsMove('t', 'bill', -1);
ok(p.fit().join() === 'party,amount,bill,date', 'its order can be moved, and the order is the remembered choice');

p = page(store);   /* a reload: a new page over the same storage */
ok(p.fit().join() === 'party,amount,bill,date', 'reload keeps the choice and the order (remembered per list)');
const other = page(store);
other.box.listCtl('u', { rows: () => [], text: () => '', tbl: true, repaint() {} });
ok(other.box.tblFitBox('u', COLS, PRIO, 'tbox', false).map((c) => c.key).join() === 'party,amount,date', 'another list key is not touched by it');

p = page(throwing);
ok(p.fit().join() === 'party,amount,date', 'storage that throws: the page still renders the top three');
p.box.tblColsToggle('t', 'kind');
ok(p.fit().join() === 'party,amount,date,kind', 'storage that throws: a tick still applies for the session');

/* fit: 4 ticked, room for 2 - the lowest priority are dropped AND named */
p = page(mem(), { width: 700 }); p.fit();
p.box.tblColsToggle('t', 'bill');
const f = p.fit();
ok(f.join() === 'party,amount,date', 'a narrow pane drops the lowest-priority ticked columns (' + f.join() + ')');
ok(/cols-noroom-bill/.test(p.menu()) && /hidden - no room|hidden — no room/.test(p.menu()), 'the dropped tick is named "hidden - no room" in the chooser, not silently ignored');
ok(!/cols-noroom-party/.test(p.menu()), 'the top column is never the one that is dropped');

/* phone: every ticked column fits (card), labelled */
p = page(mem(), { width: 400, mob: true }); p.fit();
p.box.tblColsToggle('t', 'bill'); p.box.tblColsToggle('t', 'kind');
ok(p.fit().length === 5, 'below the card breakpoint every ticked column is kept (each a label : value line)');
const row = p.box.tblRowHTML(p.box.tblColsChosen('t'), { party: 'A', amount: 1, date: 'd', bill: 'b', kind: 'k' }, { labels: true });
ok((row.match(/data-l="/g) || []).length === 5, 'and each cell carries its label for the card');

/* a stale saved key (a column since removed) is dropped, not drawn as a hole */
const st = mem(); st.setItem('cb_cols_t', JSON.stringify(['gone', 'amount']));
p = page(st);
ok(p.fit().join() === 'party,amount', 'a stale saved key is dropped; the top column is put back');


/* the view toggle: grid / lines, remembered per list; a phone is always lines; lines show every ticked field */
const vs = mem();
p = page(vs); p.fit();
ok(p.box.tblViewGet('t') === 'grid', 'a table list opens as a grid unless it declares lines');
p.box.tblViewSet('t', 'lines');
ok(p.box.tblViewGet('t') === 'lines' && p.fit().length === 5, 'switching to lines shows every field (no top-three limit)');
p = page(vs); p.fit();
ok(p.box.tblViewGet('t') === 'lines', 'reload keeps the view (per list key)');
p.box.tblViewSet('t', 'grid'); p = page(vs);
ok(p.fit().join() === 'party,amount,date', 'back to grid: the top three again');
p = page(throwing); p.fit(); p.box.tblViewSet('t', 'lines');
ok(p.box.tblViewGet('t') === 'lines', 'storage that throws: the view still switches for the session');
p = page(mem(), { width: 400, mob: true }); p.fit();
ok(/view-grid-t"[^>]*disabled/.test(p.box.tblViewHTML('t')) && /view-lines-t"[^>]*aria-pressed="true"/.test(p.box.tblViewHTML('t')), 'phone: lines is forced (grid disabled, lines pressed)');
{
  const q = page(mem());
  q.box.listCtl('d', { rows: () => [], text: () => '', tbl: true, view: 'lines', repaint() {} });
  ok(q.box.tblViewGet('d') === 'lines' && q.box.tblFitBox('d', COLS, PRIO, 'tbox', false).length === 5, 'a list that declares lines opens as lines, every field shown');
  const rowH = q.box.tblRowHTML(COLS, { party: 'A', amount: '', date: '-', bill: 'b', kind: 'k' }, { lines: true, sub: 'GIST' });
  ok(/class="lsub">GIST/.test(rowH) && (rowH.match(/class="lcell/g) || []).length === 4, 'lines: the sub line sits under the record' + (rowH.match(/class="lcell/g) || []).length);
}

console.log('\n  ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
