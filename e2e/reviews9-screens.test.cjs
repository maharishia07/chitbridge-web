/**
 * reviews9-screens.test.cjs — reviews9 (21 Nov 2026), GF/EL web-screens 10-14 findings fixed in the shared screens.
 * OWNS      proof that: Undo posts to the side the change belongs to; Receive re-reads the list; a failed marks read draws "!";
 *           the store request total is rounded money; Move-in drops a preview and an in-flight read when the date or file changes;
 *           the Match error clears and Raise-it cannot post twice; Pictures lands a Sales answer under the period it asked for;
 *           Marketing pages Who came back and ignores a late page; the Opening Save refuses a half-filled bill; a failed parties read
 *           is not latched as empty; the Accruals page says a failed read failed; the phone period label keeps its words;
 *           Readiness never PUTs an unread profile; the register is not made twice; the vault base is what was SENT;
 *           connectors_in_use is not written from an unread list; stdCounts never gives NaN.
 * CALLED BY .github/workflows/ci.yml (Offline guards). No browser, no network.
 *   node e2e/reviews9-screens.test.cjs
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { liftFns } = require('./lib/lift-fn.cjs');
let fail = 0;
const t = (name, ok, why) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (ok ? '' : ' - ' + why)); if (!ok) fail++; };
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');
const has = (f, text) => src(f).includes(text);

(async () => {
  // GF-10 / Undo: a supplier change is put back on the supplier side
  const esc = (s) => String(s);
  const cu = vm.createContext({ esc, tx: (s) => s, FT_UNDOABLE: { credit_days: 1 } });
  vm.runInContext(liftFns('public/app/cap-finance-terms.js', ['ftUndoFor']) + '\nthis.f = { ftUndoFor };', cu);
  const list = [{ field: 'supplier.credit_days', old: 30, at: '2026-11-02' }];
  const btn = cu.f.ftUndoFor(list, false, 'p1')(list[0], 0);
  t('Undo of a supplier change carries data-side=supplier', btn.includes('data-side="supplier"'), btn);
  t('ftUndo posts that side, not a fixed customer', has('app/cap-finance-terms.js', "side: undo.side") && !has('app/cap-finance-terms.js', "{ party_id: undo.partyId, side: 'customer' }"), 'fixed side');

  // EL-10 M4: Receive passes an after that re-reads the Collections list
  t('Receive re-reads Collections after the payment', has("app/cap-finance.js", "after:function(){finLoad(true)}"), 'no after');

  // EL-10 M9: a failed marks read draws "!" for a row never read and for a blank-state list
  const root = { tx: (s) => s, esc, shopDay: (d) => d, fmtMoney: () => '', document: { querySelectorAll: () => [], createElement: () => ({ setAttribute() {}, appendChild() {}, style: {} }), head: { appendChild() {} }, body: {}, documentElement: {}, addEventListener() {}, getElementById: () => null }, Promise, Date, JSON, Math, Object, Array, String, Number, RegExp, Error, Intl, setTimeout };
  root.window = root; root.globalThis = root;
  const cm = vm.createContext(root);
  ['cap-mark-sheet.js', 'cap-mark.js'].forEach((f) => vm.runInContext(src('app/' + f), cm, { filename: f }));
  const chip = (state, id) => root.CBMarkKit.chipHTML(state, id);
  t('failed read, row never read: "!"', chip({ on: false, failed: true, rows: {} }, 'a').includes('>!<'), chip({ on: false, failed: true, rows: {} }, 'a'));
  t('ok read, marking off: blank', chip({ on: false, failed: false, rows: {} }, 'a') === '', 'not blank');

  // EL-11 M13: the store request total is rounded money
  t('store request total goes through CBMoney.round', has('app/cap-network-member.js', 'total: CBMoney.round((+item.qty || 0) * amt(item))') && has('app.html', 'total: CBMoney.round((+item.qty || 0) * list)'), 'float total');

  // EL-11 M10 / M11: Move-in
  const MIV = { f: {}, pre: { x: 1 }, dec: { a: 1 }, plan: { rows: 1 }, gen: 5, busy: true, err: 'x', refused: null, st: null };
  const cv = vm.createContext({ MIV, miRefresh: () => {}, FileReader: function () { this.readAsText = () => {}; this.readAsArrayBuffer = () => {}; } });
  vm.runInContext(liftFns('public/app/cap-move-in.js', ['miDropRead', 'miSet']) + '\nthis.f = { miSet };', cv);
  cv.f.miSet('as_at', '2026-04-01');
  t('a new move date drops the preview', MIV.plan === null, JSON.stringify(MIV.plan));
  t('and any read in flight (gen moved, not left busy)', MIV.gen === 6 && MIV.busy === false, MIV.gen + ' ' + MIV.busy);
  t('a new file drops the in-flight read too', /form\.csv = null;[\s\S]{0,200}miDropRead\(\)/.test(src('app/cap-move-in.js')), 'miFile');

  // EL-11 M8 / M9: Match
  const MATCH = { rows: null, days: 90, error: 'old', busy: false };
  const cmx = vm.createContext({ MATCH, api: () => Promise.resolve({ orders: [] }), UI: { nav: 'x' }, bgRenderApp: () => {}, failWords: () => 'w', tx: (s) => s });
  vm.runInContext(liftFns('public/app/cap-match.js', ['matchLoad']) + '\nthis.f = { matchLoad };', cmx);
  await cmx.f.matchLoad(true);
  t('a read that worked clears the old Match error', MATCH.error === null, String(MATCH.error));
  let posts = 0;
  const MATCH2 = { rows: [{ chit_id: 'c1', party_id: 'p' }] };
  const cmd = vm.createContext({ MATCH: MATCH2, document: { getElementById: () => ({ value: 'a long enough reason' }) }, api: () => { posts++; return new Promise(() => {}); }, toast: () => {}, tx: (s) => s, closeModal: () => {}, matchLoad: () => {}, failWords: () => '' });
  vm.runInContext(liftFns('public/app/cap-match.js', ['matchDisputeSend']) + '\nthis.f = { matchDisputeSend };', cmd);
  cmd.f.matchDisputeSend('c1'); cmd.f.matchDisputeSend('c1');
  t('Raise it twice posts one dispute', posts === 1, 'posts ' + posts);

  // EL-11 M1 / M2: Pictures
  const sp = src('app/cap-mis-pictures.js');
  t('Pictures: the sales answer lands under the period asked', sp.includes('PICS.sales[asked] = answer'), 'period at response time');
  t('Pictures: a failed dues read marks both cards', sp.includes("pcFail('owe', error)"), 'one card');

  // EL-11 M4 / M5: Marketing
  const mk = src('app/cap-marketing.js');
  t('Who came back has a pager and a latest-wins guard', mk.includes('foot: mktCameFoot') && mk.includes('CAME.gen') && mk.includes('SENT.gen'), 'no pager or guard');

  // EL-12 M9 / M12 / M8: Opening + Accruals
  const OPENING = { rows: [{ bills: [{ party_id: '', minor: 500, ref: '', date: '', due: '' }] }] };
  const co = vm.createContext({ OPENING });
  vm.runInContext(liftFns('public/app/cap-opening.js', ['obHalfBills']) + '\nthis.f = { obHalfBills };', co);
  t('a bill with an amount and no party is half-filled', co.f.obHalfBills() === true, 'dropped silently');
  OPENING.rows[0].bills = [{ party_id: '', minor: null, ref: '', date: '', due: '' }];
  t('an untouched empty bill is not', co.f.obHalfBills() === false, 'blocks an empty one');
  t('Save checks it first', /function obSave\(\) \{\s*if \(obHalfBills\(\)\)/.test(src('app/cap-opening.js')), 'no check');
  const ob = { OPENING: { parties: null }, api: () => Promise.reject(new Error('x')), cbQuiet: () => {} };
  const cob = vm.createContext(ob);
  vm.runInContext(liftFns('public/app/cap-opening-bills.js', ['obEnsureParties']) + '\nthis.f = { obEnsureParties };', cob);
  await cob.f.obEnsureParties();
  t('a failed parties read is not latched as an empty list', ob.OPENING.parties === null, JSON.stringify(ob.OPENING.parties));
  t('a failed accruals read says so', has('app/cap-period-accruals.js', 'if (readFailed) peBad'), 'empty state');

  // EL-13 M11: the phone label
  const label = 'Q1 (Jul–Sep)';
  const m = /item\.label\.replace\((\/.*?\/), ''\)/.exec(src('app/cap-period.js'));
  const re = m && eval(m[1]);
  t('the phone period label keeps its words', re && label.replace(re, '') === 'Q1', re && label.replace(re, ''));

  // EL-13 M1 / M3 / M6
  t('Readiness never PUTs an unread profile', has('app/cap-readiness.js', 'if (UI.profileUnread) return;'), 'writes the stand-in');
  t('Gather says when the document did not go', has('app/cap-readiness.js', 'attached ? ') && has('app/cap-readiness.js', 'did not go'), 'toast on file chosen');
  t('a register made once is used again after a failed entry', has('app/cap-register.js', 'RG.madeNew'), 'made twice');

  // GF-14 M1 / M2, EL-14 M2
  t('the vault base is the copy that was sent', has('app/cap-shop.js', 'UI._vaultBase = sent;'), 'base is the model at response time');
  t('connectors_in_use is not written from an unread list', has('app/cap-settings.js', 'if (pol === null) {'), 'writes from []');
  const cs = vm.createContext({ STANDARDS: [{ s: 'live' }, { s: 'np' }, { s: 'part' }, { s: 'live', k: 'build-rule' }] });
  vm.runInContext(liftFns('public/app/cap-standards.js', ['stdCounts']) + '\nthis.f = { stdCounts };', cs);
  const counts = cs.f.stdCounts();
  t('stdCounts has no NaN for a not-applicable row', counts.live === 1 && counts.part === 1 && !('np' in counts), JSON.stringify(counts));

  console.log(fail ? 'FAILED ' + fail : 'all ok');
  process.exit(fail ? 1 : 0);
})();
