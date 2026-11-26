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
const at = src.indexOf('function totalRows(key, a)');
const body = src.slice(at, src.indexOf('\n  }\n', at) + 4);
const totalRows = new Function('grantKit', body + '; return totalRows;')({ words: (w) => w });
ok('W4-16 a loss is labelled Loss and carries the size, not a minus', () => {
  const rows = totalRows('pl', { profit_minor: -1505022 });
  const last = rows[rows.length - 1];
  assert.strictEqual(last.name, 'Loss');
  assert.strictEqual(last.amount_minor, 1505022);
});
ok('W4-16 a profit stays Profit', () => assert.strictEqual(totalRows('pl', { profit_minor: 500 }).pop().name, 'Profit'));
ok('W4-16 gross profit with no cost of sales says it equals sales', () => {
  const rows = totalRows('pl', { profit_minor: -1505022, gross_profit_minor: 13699000, gross_cost_minor: 0 });
  assert.ok(/no cost of sales/i.test(rows[0].name), rows[0].name);
  assert.strictEqual(rows[0].amount_minor, 13699000);
});
ok('W4-16 gross profit with a cost of sales keeps its plain words', () => assert.strictEqual(totalRows('pl', { profit_minor: 1, gross_profit_minor: 5, gross_cost_minor: 2 })[0].name, 'Gross profit (sales less cost of sales)'));
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
ok('W4-16 the balance sheet profit line runs to the heading day (shown_as_at), not the year end still to come', () => {
  const at2 = src.indexOf('function profitRow(row, a)');
  const profitRow = new Function('grantKit', 'root', src.slice(at2, src.indexOf(String.fromCharCode(10) + "  }" + String.fromCharCode(10), at2) + 4) + '; return profitRow;')({ words: (w) => w }, { shopDay: (d) => d });
  const row = profitRow({ role: 'profit_to_date', name: 'x' }, { fy_from: '2026-07-01', asOf: '2027-06-30', shown_as_at: '2026-11-26' });
  assert.strictEqual(row.name, 'Profit 2026-07-01 – 2026-11-26');
});
ok('W4-06 an empty column is not drawn (Year end and Held by), and the strip says N of M', () => {
  const pr = read('public/app/books-practice.js'), band = read('public/app/books-practice-band.js');
  assert.ok(pr.includes("return key !== 'yend'") && pr.includes('r.holders.length'));
  assert.ok(band.includes("listed > total"));
});
ok('W4-15 inside a client the area switcher is not drawn', () => { const sh = read('public/app/shell.js'); assert.ok(sh.includes('.cbsh-is-working .cbsh-sw{display:none}') && sh.includes("classList.toggle('cbsh-is-working'")); });
console.log('\n' + n + ' checks');
