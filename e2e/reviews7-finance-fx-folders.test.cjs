/**
 * reviews7-finance-fx-folders.test.cjs — reviews7 (21 Nov 2026) EL-10 M2, M3, M7, M8 / GF-10 20, on the real functions (vm sandbox).
 * OWNS      the proof that (1) a rate change drops the cached revaluation line; (2) a batch Remind is "Asked" only when the message really opened;
 *           (3) a rule amount typed 1,00,000 reads as a number and a word never goes out as null; (4) the folder Metrics "Value" is money, not "INR 1234.5".
 * CALLED BY .github/workflows/ci.yml (Offline guards). No browser, no network.
 *   node e2e/reviews7-finance-fx-folders.test.cjs
 */
'use strict';
const vm = require('vm');
const { liftFns } = require('./lib/lift-fn.cjs');
let fail = 0;
const t = (name, ok, why) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (ok ? '' : ' - ' + why)); if (!ok) fail++; };

(async () => {
  // M2 fxLoad drops the cached revaluation
  const FXV = { gen: 0, lk: { k: 'a|b', r: { loss: 1200 } } };
  const cx = vm.createContext({ FXV, api: () => Promise.resolve({ rates: [] }), tx: (s) => s, document: { getElementById: () => null }, fxPaint: () => {}, fxLockLine: () => {} });
  vm.runInContext(liftFns('public/app/cap-fx.js', ['fxLoad']) + '\nthis.f = { fxLoad };', cx);
  await cx.f.fxLoad();
  t('new rates drop the cached revaluation', FXV.lk === null, JSON.stringify(FXV.lk));

  // M3 Asked only when the message opened
  for (const [ok, want] of [[true, true], [false, false]]) {
    const FIN = { queue: [{ id: 'p1', name: 'A', done: false }] };
    const c = vm.createContext({ FIN, finQueueSheet: () => {}, bkRemind: () => Promise.resolve({ ok }) });
    vm.runInContext(liftFns('public/app/cap-finance.js', ['finRemindOne']) + '\nthis.f = { finRemindOne };', c);
    await c.f.finRemindOne(0, null);
    t('Asked is ' + want + ' when the open ok=' + ok, FIN.queue[0].done === want, String(FIN.queue[0].done));
  }

  // M7 rule amount
  const FLD = { draft: {} };
  const c2 = vm.createContext({ _FLD: FLD });
  vm.runInContext(liftFns('public/app/cap-folders.js', ['_draftWhen']) + '\nthis.f = { _draftWhen };', c2);
  FLD.draft = { term: 'min_amount', val: '1,00,000' };
  t('1,00,000 is 100000', c2.f._draftWhen().min_amount === 100000, JSON.stringify(c2.f._draftWhen()));
  FLD.draft = { term: 'min_amount', val: 'abc' };
  t('a word is not a number: no rule (never null on the wire)', c2.f._draftWhen() === null);
  FLD.draft = { term: 'older_than_days', val: '30' };
  t('plain 30 still 30', c2.f._draftWhen().older_than_days === 30);

  // M8 Metrics value through the one money renderer
  const c3 = vm.createContext({ _FLD: { busy: false, metrics: { clock: {}, disputes: {}, money: { by_currency: [{ currency: 'INR', total: 1234.5, chits: 2 }] } } }, esc: String, _reconStrip: () => '', txf: (s) => s, nm: String, bkDate: String, _mBox: (a, b, c) => String(a) + String(b) + String(c), tx: (s) => s, fmtMoney: (a, c) => '[M ' + a + ' ' + c + ']' });
  vm.runInContext(liftFns('public/app/cap-folders-metrics.js', ['_folderMetricsPane']) + '\nthis.f = { _folderMetricsPane };', c3);
  let html = '';
  try { html = c3.f._folderMetricsPane(); } catch (e) { html = 'THROW ' + e.message; }
  t('Metrics value goes through fmtMoney', html.includes('[M 1234.5 INR]'), html.slice(0, 200));
  console.log(fail ? 'FAILED ' + fail : 'all ok');
  process.exit(fail ? 1 : 0);
})();
