/* tests/w4acc-1130.test.cjs — walk 4 accounting rows W4-06, W4-07 (tile), W4-14, W4-15, W4-16 (offline guard of the words and the rules).
 * HAND-COMPUTED  W4-16: a P&L of income 136,990.00 less expenses 152,040.22 = -15,050.22 reads "Loss" with 15,050.22 (A$ shown by the money unit), never "Profit" with a minus;
 *                a gross profit with cost of sales 0 says it equals sales (136,990.00 - 0 = 136,990.00), it is not a 100% margin fact.
 * OWNS the guard.   CARD 14-accounting */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').split('\r\n').join('\n');
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ok   ' + name); };
const src = read('public/app/books-grant-reports.js');
const lift = (name) => { const from = src.indexOf('function ' + name + '('); return src.slice(from, src.indexOf('\n  }\n', from) + 4); };
/* ONEP-2 PR 2: the W4-16 Profit / Loss / equals-sales wording moved with the P&L to the owner's screen; it is proved in tests/onep2-pl-one-path.test.cjs */
const acting = read('public/app/books-acting.js');
const fa = acting.indexOf('function clientStores(stores, held, openId)');
const cs = new Function('roleOf', acting.slice(fa, acting.indexOf('\n  }\n', fa) + 4) + '; return clientStores;')((held, id) => ((held[String(id)] || {}).preset === 'adviser' ? 'adviser' : 'auditor'));
ok('W4-14 the Switch client list drops a test shop, shows each country, one order by name (hand: 4 held, 1 test -> 3, Auckland before Zeta)', () => {
  const stores = [{ entity_id: 'a', name: 'x' }, { entity_id: 'b', name: 'x' }, { entity_id: 'c', name: 'x' }, { entity_id: 'd', name: 'x' }];
  const held = { a: { grantor_name: 'Wattle Lane Cafe (SIT AU audit)', grantor_is_test: 'true', grantor_country: 'AU', preset: 'auditor' }, b: { grantor_name: 'Zeta Pies', grantor_is_test: 'false', grantor_country: 'AU', preset: 'adviser' }, c: { grantor_name: 'Harbour Bakes, Auckland', grantor_is_test: 'false', grantor_country: 'NZ', preset: 'auditor' }, d: { grantor_name: 'Mid Cafe', grantor_is_test: null, grantor_country: 'AU', preset: 'auditor' } };
  const out = cs(stores, held, 'c');
  assert.deepStrictEqual(out.map((o) => o.name), ['Harbour Bakes, Auckland', 'Mid Cafe', 'Zeta Pies']);
  assert.strictEqual(out[0].country, 'NZ');
  assert.deepStrictEqual(cs(stores, held, 'a').map((o) => o.id), ['a', 'c', 'd', 'b'].sort((x, y) => ({ a: 'Wattle', c: 'Harbour', d: 'Mid', b: 'Zeta' }[x] < { a: 'Wattle', c: 'Harbour', d: 'Mid', b: 'Zeta' }[y] ? -1 : 1)), 'the open client stays even when it is a test shop');
});
/* ONEP-2 PR 3: the W4-16 profit line running to the heading day (shown_as_at) moved with the balance sheet to the owner's screen: tests/onep2-bs-one-path.test.cjs */
ok('W4-06 an empty column is not drawn (Year end and Held by), and the strip says N of M', () => {
  const pr = read('public/app/books-practice.js'), band = read('public/app/books-practice-band.js');
  assert.ok(pr.includes("return key !== 'yend'") && pr.includes('r.holders.length'));
  assert.ok(band.includes("listed > total"));
});
ok('W4-15 inside a client the area switcher is not drawn', () => { const sh = read('public/app/shell.js'); assert.ok(sh.includes('.cbsh-is-working .cbsh-sw{display:none}') && sh.includes("classList.toggle('cbsh-is-working'")); });
console.log('\n' + n + ' checks');
