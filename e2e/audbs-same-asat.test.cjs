'use strict';
// @type: unit
/**
 * audbs-same-asat.test.cjs - the firm seat asks the same as-at day as the owner (AUDBS, 28 Nov 2026): no browser, no api.
 *
 * OWNS      the rule: a day that has not happened is never the as-at of a trial balance, balance sheet or ageing read. (1) cap-books.js bkCarriedDay: the firm's door carries
 *           to=<period end of the year in progress>; it is no pick, so the seat opens where the owner does (today). (2) books-grant-reports.js queryOf: the Who owes whom read
 *           of the year in progress asks today, not 30 June. A day already past is kept as it is; today is kept.
 * CALLED BY CI (offline guards) · by hand: node e2e/audbs-same-asat.test.cjs   (AUDBS_MUTATE=door | query must fail it)
 * CARD      04-network/ACC-176-AUDITOR-GRANT
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const mutate = process.env.AUDBS_MUTATE || '';
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', 'app', f), 'utf8');
let failures = 0;
const check = (ok, msg) => { console.log((ok ? '  ok ' : '  FAIL ') + msg); if (!ok) failures++; };
const TODAY = '2026-11-28';

let books = read('cap-books.js'), reports = read('books-grant-reports.js');
if (mutate === 'door') books = books.replace(/ && day <= bkToday\(\)/, '');
if (mutate === 'query') reports = reports.replace(/notAfterToday\(period\.to\)/, 'period.to');

/* (1) the owner screen's carried-day reader, cut out of the file and run on its own */
const src = books.slice(books.indexOf('function bkCarriedDay'), books.indexOf('/** the day the trial balance is read at'));
check(src.indexOf('function bkCarriedDay') === 0, 'found bkCarriedDay in cap-books.js');
const carried = (to) => {
  const ctx = { BK: {}, location: { search: to ? '?to=' + to : '' }, URLSearchParams, bkToday: () => TODAY };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  return vm.runInContext('bkCarriedDay("x")', ctx);
};
check(carried('2027-06-30') === '', 'a carried day after today (the year end in progress) is no pick');
check(carried('2026-11-29') === '', 'tomorrow is no pick');
check(carried(TODAY) === TODAY, 'today is kept');
check(carried('2026-06-30') === '2026-06-30', 'a past day (last year end) is kept');
check(carried('2027-02-30x') === '', 'a bad day is no pick');

/* (2) the firm's own ageing read */
const root = { CBShopTime: { today: () => TODAY } };
vm.createContext(root); root.root = root;
vm.runInContext(reports, Object.assign(root, { window: root }));
const kit = root.CBBooksGrantKit || {};
kit.viewState = { period: { kind: 'year', from: '2026-07-01', to: '2027-06-30' } };
const dues = (kit.REPORTS || []).find((r) => r.k === 'dues');
const asked = dues ? kit.queryOf(dues).asOf : null;
check(asked === TODAY, 'Who owes whom of the year in progress asks today (' + asked + '), the owner\'s day');
kit.viewState = { period: { kind: 'year', from: '2025-07-01', to: '2026-06-30' } };
check(dues && kit.queryOf(dues).asOf === '2026-06-30', 'a closed year asks its own end');
console.log(failures ? 'audbs-same-asat: ' + failures + ' FAILED' : 'audbs-same-asat: all ok');
process.exit(failures ? 1 : 0);
