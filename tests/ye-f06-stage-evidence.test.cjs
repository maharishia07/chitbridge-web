/* tests/ye-f06-stage-evidence.test.cjs — YE-F-06 (walk YE 21 Nov): a closed year shows its evidence; a return's stage words come from ONE state.
 * HAND-COMPUTED  Elm Park FY26 Q1: state declared_lodged → "Lodged, as you said" and NO "lodge it in the portal" line; a prepared period → "Prepared, not lodged".
 *                Year 2025-26 closed 2 Nov 2026 by Elm Park Physio, declared lodged, profit 1436617 → three lines.
 * OWNS the offline guard of peReturnStage and peYearClosedEvidence in public/app/cap-period.js.   CARD 14-accounting */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const text = ['cap-period.js', 'cap-period-year.js'].map((name) => fs.readFileSync(path.join(__dirname, '..', 'public', 'app', name), 'utf8')).join('\n').split('\r\n').join('\n');
const pick = (name) => { const at = text.indexOf('function ' + name + '('); return text.slice(at, text.indexOf('\n}\n', at) + 2); };
const line = (name) => text.slice(text.indexOf('const ' + name + ' ='), text.indexOf('\n', text.indexOf('const ' + name + ' =')) + 1);
const ctx = { tx: (s) => s, txf: (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]), esc: (s) => String(s), bkDate: (d) => d, peMoney: (m, c) => c + ' ' + (m / 100).toFixed(2) };
vm.createContext(ctx);
vm.runInContext('const PE_RET_STATE = { set_off: "closed", months_locked: "closed", year_closed: "closed with the year", declared_lodged: "lodged, as you said" };' + pick('peReturnStage') + pick('peYearClosedEvidence') + ';this.stage=peReturnStage;this.ev=peYearClosedEvidence;', ctx);
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ok   ' + name); };
const ret = (state) => ({ prepared: 'Prepared, not lodged', period: { period: 'Q1' }, periods: [{ period: 'Q1', state }] });
ok('a period declared lodged says "Lodged, as you said" and no portal line', () => { const s = ctx.stage(ret('declared_lodged')); assert.strictEqual(s.word, 'Lodged, as you said'); assert.strictEqual(s.lodge, false); });
ok('the server stage wins: one word from one state', () => { const lodged = ctx.stage({ stage: { code: 'declared_lodged', words: 'Lodged, as you said' }, prepared: 'Prepared, not lodged' }); assert.strictEqual(lodged.word, 'Lodged, as you said'); assert.strictEqual(lodged.lodge, false); const late = ctx.stage({ stage: { code: 'overdue', words: 'Overdue — prepared, not lodged' } }); assert.strictEqual(late.lodge, true); });
ok('a prepared period keeps "Prepared, not lodged" with the portal line', () => { const s = ctx.stage(ret('open')); assert.strictEqual(s.word, 'Prepared, not lodged'); assert.strictEqual(s.lodge, true); });
ok('the closed year: when and by whom, declared lodged, the profit carried with its currency', () => {
  const html = ctx.ev({ closed_with: { at: '2026-11-02T01:00:00Z', by_name: 'Elm Park Physio', how: 'declared_lodged', profit_minor: 1436617, currency: 'AUD' } });
  assert.ok(html.includes('Closed on 2026-11-02 by Elm Park Physio') && html.includes('Returns lodged outside ChitBridge, as you said') && html.includes('Profit carried forward: AUD 14366.17'), html);
});
ok('an older api (no closed_with): nothing drawn', () => assert.strictEqual(ctx.ev({ closed: true }), ''));
console.log('\n' + n + ' checks');
