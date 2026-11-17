'use strict';
// @type: unit
/**
 * jet-day-book-risk.test.cjs - JET (ASA 240 journal-entry risk filters; ASA 560 "after year end"): hand-computed fixture run through the REAL books-grant-filters.js and engine/money.js. No browser, no api.
 * OWNS      7 entries of an Australian shop (period 1 Jul 2025 - 30 Jun 2026, zone Australia/Sydney, AEST +10 in June/July) and the counts each filter must give (below)
 * CALLED BY by hand: node e2e/jet-day-book-risk.test.cjs
 * CARD      04-network/ACC-176-AUDITOR-GRANT
 *
 * HAND-COMPUTED (Sydney local moment = recorded_at UTC + 10 h):
 *   id  posting     recorded (UTC)        Sydney                 amount (A$)  by    narration  days late
 *   E1  2026-06-30  2026-07-14 02:00      Tue 14 Jul 12:00       1,500.00     Ann   written    14
 *   E2  2026-06-15  2026-06-15 22:30      Tue 16 Jun 08:30         123.45     Bob   none        1   (the UTC day is the 15th: the zone moves the day)
 *   E3  2026-06-20  2026-06-20 13:00      Sat 20 Jun 23:00      10,000.00     Ann   written     0
 *   E4  2026-06-10  2026-06-10 19:30      Thu 11 Jun 05:30          1.00      Bob   none        1
 *   E5  2026-05-01  2026-07-20 00:00      Mon 20 Jul 10:00     50,000.00      Cara  written    80
 *   E6  2026-06-30  2026-06-30 13:30      Tue 30 Jun 23:30      7,777.00      Cara  written     0   (UTC says 1 Jul: NOT after the period end in the shop zone)
 *   E7  2026-07-05  2026-07-05 01:00      Sun  5 Jul 11:00        200.00      Ann   written     0   (dated after the period)
 *   Recorded after period end: E1 E5 E7 = 3 · over 7 days: E1 E5 = 2 · over 30: E5 = 1 · over 90: 0 · weekend: E3 E7 = 2 · after hours (before 07:00 / from 20:00): E3 E4 E6 = 3
 *   Multiple of 100 (A$): E1 E3 E5 E7 = 4 · of 1,000: E3 E5 = 2 · makers: Ann Bob Cara · no narration: E2 E4 = 2
 *   Year end, recorded after it and dated inside the period: E1 E5 = 2 · dated after it: E7 = 1 · the range read for "dated after" = 1 Jul 2026 .. 1 Jul 2027
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
let failures = 0;
const check = (ok, msg) => { console.log((ok ? '  ok ' : '  FAIL ') + msg); if (!ok) failures++; };
const pub = (...p) => fs.readFileSync(path.join(__dirname, '..', 'public', ...p), 'utf8');
const box = { URLSearchParams, setTimeout, console, Intl };
box.window = box; box.globalThis = box; box.CB_SHOP_TZ = 'Australia/Sydney';
vm.createContext(box);
vm.runInContext(pub('engine', 'money.js'), box);
vm.runInContext(pub('app', 'books-grant-filters.js'), box);
const F = box.CBBooksGrantFilters;
const rows = [
  { id: 'E1', posting_date: '2026-06-30', recorded_at: '2026-07-14T02:00:00.000Z', amount_minor: 150000, made_by: 'Ann', no_narration: false },
  { id: 'E2', posting_date: '2026-06-15', recorded_at: '2026-06-15T22:30:00.000Z', amount_minor: 12345, made_by: 'Bob', no_narration: true },
  { id: 'E3', posting_date: '2026-06-20', recorded_at: '2026-06-20T13:00:00.000Z', amount_minor: 1000000, made_by: 'Ann', no_narration: false },
  { id: 'E4', posting_date: '2026-06-10', recorded_at: '2026-06-10T19:30:00.000Z', amount_minor: 100, made_by: 'Bob', no_narration: true },
  { id: 'E5', posting_date: '2026-05-01', recorded_at: '2026-07-20T00:00:00.000Z', amount_minor: 5000000, made_by: 'Cara', no_narration: false },
  { id: 'E6', posting_date: '2026-06-30', recorded_at: '2026-06-30T13:30:00.000Z', amount_minor: 777700, made_by: 'Cara', no_narration: false },
  { id: 'E7', posting_date: '2026-07-05', recorded_at: '2026-07-05T01:00:00.000Z', amount_minor: 20000, made_by: 'Ann', no_narration: false }
];
const period = { from: '2025-07-01', to: '2026-06-30' };
const filters = F.filtersFor(null, { period: () => period, currency: () => 'AUD', rows: () => rows });
const by = (key) => filters.find((f) => f.key === key);
const ids = (key, v) => rows.filter((r) => by(key).match(r, v)).map((r) => r.id).join(' ');

check(ids('rec', 'afterend') === 'E1 E5 E7', 'Recorded after period end: E1 E5 E7 (E6 recorded 23:30 Sydney on 30 Jun is inside, though UTC says 1 Jul)');
check(ids('rec', 'late7') === 'E1 E5' && ids('rec', 'late30') === 'E5' && ids('rec', 'late90') === '', 'Over 7 / 30 / 90 days late: E1 E5 · E5 · none');
check(ids('time', 'weekend') === 'E3 E7', 'Weekend (shop time): E3 (Sat 23:00) and E7 (Sun)');
check(ids('time', 'night') === 'E3 E4 E6', 'After hours: E3 23:00 · E4 05:30 · E6 23:30');
check(ids('round', '100') === 'E1 E3 E5 E7' && ids('round', '1000') === 'E3 E5', 'Round sum, A$: multiple of 100 = E1 E3 E5 E7 · of 1,000 = E3 E5');
check(F.round(rows[0], 1000, 'JPY') === true && F.round(rows[0], 1000, 'AUD') === false, 'the currency decides what a minor unit is: 150000 is Y150,000 (round to 1,000) but A$1,500.00 (not)');
check(ids('by', 'Ann') === 'E1 E3 E7' && ids('by', 'Bob') === 'E2 E4' && ids('by', 'Cara') === 'E5 E6', 'Made by: Ann 3 · Bob 2 · Cara 2');
check(JSON.stringify(by('by').options().map((o) => o.v)) === '["Ann","Bob","Cara"]', 'the Made by choices are the people on the page, sorted');
check(ids('narr', 'none') === 'E2 E4', 'Narration none written: E2 E4');
check(ids('ye', 'recorded') === 'E1 E5' && ids('ye', 'dated') === 'E7', 'Year end: recorded after it, dated inside = E1 E5 · dated after it = E7');
check(ids('ye', 'recorded').split(' ').every((x) => ids('rec', 'afterend').split(' ').indexOf(x) >= 0), 'one definition: Year end "recorded after" is a subset of Recorded "after period end" (same afterEnd)');
check(JSON.stringify(F.afterRange(period)) === '{"from":"2026-07-01","to":"2027-07-01"}' && F.afterRange(null) === null, 'the range read for "dated after it": 1 Jul 2026 to 1 Jul 2027');
check(F.daysLate({ posting_date: '2026-06-30' }) === 0 && F.weekend({}) === false && F.afterHours({ recorded_at: 'nonsense' }) === false, 'a row with no recorded moment (or a bad one) is never flagged');
box.CB_SHOP_TZ = 'Not/AZone';
check(typeof F.weekend(rows[2]) === 'boolean', 'an unknown shop zone falls back to the viewer zone and never throws');
box.CB_SHOP_TZ = 'Australia/Sydney';
const keys = ['mark', 'ev', 'rec', 'time', 'round', 'by', 'narr', 'ye', 'kind'];
check(JSON.stringify(filters.map((f) => f.key)) === JSON.stringify(keys), 'the Day book filters, in order: ' + keys.join(' '));
const all = { mark: 'notchecked', ev: 'flag', kind: 'Other', rec: 'afterend', time: 'weekend', round: '100', by: 'Ann', narr: 'none', ye: 'dated' };
const addr = F.toAddress(all);
check(addr === 'dbf_mark=notchecked&dbf_ev=flag&dbf_kind=Other&dbf_rec=afterend&dbf_time=weekend&dbf_round=100&dbf_by=Ann&dbf_narr=none&dbf_ye=dated' && JSON.stringify(F.fromAddress('?' + addr)) === JSON.stringify(all), 'each filter has its own address word, and the address gives the same choices back');
check(F.paramNames().length === 10 && F.paramNames().indexOf('dbf_ye') >= 0 && F.paramNames().indexOf('dbf_flag') >= 0, 'paramNames names all ten address words, dbf_flag (the Saved filter, W3) included (the page wipes them from one list)');
check(F.carry('?open=c1&view=daybook&dbf_rec=afterend', 'c1') === '&dbf_rec=afterend' && F.carry('?open=c1&dbf_rec=afterend', 'c2') === '', 'a new filter rides to the same client only');
const src = pub('app', 'books-grant-filters.js');
check(!/fetch\(|XMLHttpRequest|\.range\s*=/.test(src), 'the filters file reads and compares only: no call out, no write to the period');
console.log(failures ? '\nFAILED ' + failures : '\nall passed');
process.exit(failures ? 1 : 0);
