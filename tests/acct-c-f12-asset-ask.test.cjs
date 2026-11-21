/* tests/acct-c-f12-asset-ask.test.cjs — Walk C C-F-12 (21 Nov): Add asset asks first, naming the asset, its cost, the day and where the money came from; Cancel sends nothing.
 * HAND-COMPUTED  "Walk C laptop", cost 120000 minor (A$1,200.00), bought 2026-07-05, paid from Bank: "Add Walk C laptop?" / "It cost A$1,200.00, bought 2026-07-05, paid from Bank. It goes into the books now."
 * OWNS the offline guard of peAssetAsk and the ask in peAssetSave (public/app/cap-period.js).   CARD 14-accounting */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const text = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-period.js'), 'utf8').split('\r\n').join('\n');
const pick = (name) => { const at = Math.max(text.indexOf('async function ' + name + '('), text.indexOf('\nfunction ' + name + '(') + 1); return text.slice(at, text.indexOf('\n}\n', at) + 2); };
let asked = null, sent = 0;
const ctx = { tx: (s) => s, txf: (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]), esc: (s) => String(s), bkMoney: (m) => 'A$' + (m / 100).toFixed(2).replace(/\B(?=(\d{3})+\.)/g, ','), peBad: () => {}, bkMoneyMinor: (v) => Math.round(Number(v) * 100),
  peVal: (id) => ({ pa_name: 'Walk C laptop', pa_cost: '1200', pa_date: '2026-07-05', pa_class: 'furniture', pa_how: 'bank', pa_use: '' }[id] || ''),
  peEl: () => ({ selectedOptions: [{ text: 'Bank' }] }), PE: { ref: { asset: 'r1' } }, api: async () => { sent++; return {}; }, bkOnce: async (k, b, fn) => fn(), peOk() {}, peAssetsList() {},
  CBAction: { ask: async (q) => { asked = q; return ctx.answer; } } };
vm.createContext(ctx);
vm.runInContext(pick('peAssetAsk') + pick('peAssetSave') + ';this.save=peAssetSave;this.askOf=peAssetAsk;', ctx);
let pass = 0;
const ok = async (name, fn) => { await fn(); pass++; console.log('  ok   ' + name); };
(async () => {
  await ok('the question names the asset, cost, day and the money\'s source', () => {
    const q = ctx.askOf({ name: 'Walk C laptop', cost_minor: 120000, date: '2026-07-05', how: 'bank' }, { selectedOptions: [{ text: 'Bank' }] });
    assert.strictEqual(q.title, 'Add Walk C laptop?');
    assert.strictEqual(q.body, 'It cost A$1,200.00, bought 2026-07-05, paid from Bank. It goes into the books now.');
  });
  await ok('Cancel sends nothing', async () => { ctx.answer = false; await ctx.save({}); assert.ok(asked && sent === 0); });
  await ok('Yes sends the one write', async () => { ctx.answer = true; await ctx.save({}); assert.strictEqual(sent, 1); });
  console.log('\n' + pass + ' passed · ' + pass + ' checks');
})().catch((e) => { console.log('  FAIL', e.message); process.exit(1); });
