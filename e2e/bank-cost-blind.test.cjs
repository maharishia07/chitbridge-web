/**
 * bank-cost-blind.test.cjs — l16 integ2b-finmsg (16 Nov 2026): the api's 403 COST_BLIND (B3) on GET /bank/statement-files, /file and /bank/log is SAID, never an empty box or a generic error.
 * OWNS      the proof on the real consts: bksCostBlind · bksCostBlindSay · bksWhy (cap-bank-store.js) · bkstBlind · bkstWhyNot · the load catch and the summary line (cap-bank-statements.js)
 * CALLED BY .github/workflows/ci.yml (Offline guards). No browser, no network.   node e2e/bank-cost-blind.test.cjs
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const store = fs.readFileSync('public/app/cap-bank-store.js', 'utf8'), stm = fs.readFileSync('public/app/cap-bank-statements.js', 'utf8');
const line = (src, name) => { const m = src.match(new RegExp('^const ' + name + ' = [^\n]*$', 'm')); if (!m) throw new Error(name + ' not found'); return m[0]; };
const cx = vm.createContext({ tx: (s) => s, BKST: { mode: 'server', data: null, fileTotal: 0 } });
vm.runInContext(['bksCostBlind', 'bksCostBlindSay', 'bksWhy'].map((n) => line(store, n)).join('\n') + '\n' + ['bkstBlind', 'bkstWhyNot'].map((n) => line(stm, n)).join('\n') + '\nthis.f = { bksCostBlind, bksCostBlindSay, bksWhy, bkstWhyNot };', cx);
const f = cx.f;
let bad = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) bad++; };
const SAY = 'Your access does not include costs, so the bank statements are hidden.';
(async () => {
  const log403 = Object.assign(new Error('Forbidden'), { status: 403, data: { code: 'COST_BLIND' } });
  ok(f.bksCostBlind(log403) && f.bksWhy(log403) === SAY, '/bank/log 403 COST_BLIND says the sentence: ' + f.bksWhy(log403));
  ok(f.bksCostBlind({ status: 403, data: { error: { code: 'COST_BLIND' } } }), 'the nested problem shape is read too');
  ok(!f.bksCostBlind({ status: 403, data: { code: 'GRANT_ENDED' } }) && f.bksWhy({ status: 500, message: 'boom' }) === 'boom', 'another 403 or a 500 keeps its own words');
  const res = (status, body) => ({ status, ok: false, clone: () => ({ json: () => (body ? Promise.resolve(body) : Promise.reject(new Error('no body'))) }) });
  ok((await f.bkstWhyNot(res(403, { code: 'COST_BLIND' }))) === SAY, '/statement-files/:id/file 403 COST_BLIND says the sentence');
  ok((await f.bkstWhyNot(res(403, null))) === 'This access has ended.', 'a 403 with no body keeps "This access has ended."');
  ok(/BKST\.mode = [^;]*bksCostBlind\(failure\) \? 'blind'/.test(stm) && /if \(BKST\.mode === 'blind'\) return bksCostBlindSay\(\)/.test(stm), '/statement-files list 403 sets mode blind and the Statements line says the sentence');
  if (bad) { console.log(bad + ' FAILED'); process.exit(1); }
  console.log('all ok');
})();
