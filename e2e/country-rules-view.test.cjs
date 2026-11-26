'use strict';
// @type: unit
/**
 * country-rules-view.test.cjs - NZ slice 2 (1131): the client list's Country column, filter and group, and the "Country rules and results" door.
 *
 * OWNS      hand-computed proof of country-rules-view.js on the adopted AU pack, and of the list's country plumbing in books-practice.js (source read).
 * CALLED BY by hand: node e2e/country-rules-view.test.cjs
 * CARD      15-tax-and-country-packs/country-lab
 *
 * HAND COMPUTATION (AU pack as adopted, read 2026-11-26 by walking the pack for members with a `cite`): 35 members carry one; less the 3 move-in maps (moveIn, xero, qbo) = 32;
 * less 6 asset classes the pack lists twice (asset_classes = depreciation.assetClasses, same text) = 26; less 1, the registration threshold named under tax and under thresholds
 * with one sentence = 25 rules. Grey (status set, not confirmed): timing, the invoice row, two purchase-box rows, two penalty-unit rows (unconfirmed 6), export (unread 1),
 * adjustment note (cite-check 1) = 8. Scope: out 2 + partial 1 = 3 rows, all grey.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
let failures = 0;
const check = (condition, message) => { console.log((condition ? '  ok ' : '  FAIL ') + message); if (!condition) failures++; };

const box = { console };
box.window = box; box.self = box; vm.createContext(box);
vm.runInContext(read('public/engine/tax.js'), box);
vm.runInContext(read('public/app/country-rules-view.js'), box);
const V = box.CBCountryRules;
const kit = { translate: (x) => x, dayWords: (d) => d, returnAddress: () => '/network.html?open=c1&view=bas' };

const au = V.packOf('AU');
const rules = V.rulesOf(au);
check(rules.length === 25, 'AU: 25 rules carry a source (got ' + rules.length + ')');
check(rules.filter((r) => r.grey).length === 8, 'AU: 8 rules are grey (got ' + rules.filter((r) => r.grey).length + ')');
check(rules.every((r) => r.cite && r.label), 'every rule has a label and its source');
check(rules.filter((r) => /moveIn|xero|qbo/i.test(r.cite) && /Xero|QBO|XERO/.test(r.label)).length === 0, 'the move-in maps are not rules');
const scope = V.scopeOf(au);
check(scope.length === 3 && scope.every((r) => r.grey && r.sentence), 'AU: 3 scope rows, each grey with the pack sentence');
check(V.nameOf('AU') === 'Australia', 'the name is the pack name, not a code literal: ' + V.nameOf('AU'));
check(V.nameOf('ZZ') === 'ZZ' || V.nameOf('ZZ').length > 0, 'an unregistered country still has a word');

const row = { entity_id: 'c1', country: 'AU', bas: { form: 'BAS', due_date: '2026-11-28', due_in_days: 2, overdue: null }, months_unlocked: 3 };
const html = V.doorHTML(row, kit);
check(/data-bp-rules="c1"/.test(html) && /hidden/.test(html), 'the door is a button with a hidden panel');
check((html.match(/data-grey="1"/g) || []).length === 11, 'the panel greys 11 rows (8 + 3 scope)');
check(/Return<\/span><b>BAS<\/b>/.test(html) && /Due<\/span><b>2026-11-28/.test(html) && /Months not locked<\/span><b>3/.test(html), 'results are the practice row figures, as given');
check(/view=bas/.test(html), 'a link to the tax return (the boxes live there)');
check(/Not read: the source text was not opened/.test(html) && /Not confirmed: the pack holds this rule/.test(html), 'a grey rule shows its sentence');
check(V.doorHTML({ entity_id: 'x' }, kit) === '', 'no country, no door');
const none = V.panelHTML({ entity_id: 'x', country: 'ZZ', pack_missing: 'No rules held for ZZ.' }, kit);
check(/No rules held for ZZ\./.test(none), 'a country with no pack says so with the server sentence');
const hostile = V.doorHTML({ entity_id: '"><i>', country: 'AU', bas: {}, months_unlocked: 0 }, kit);
check(!/"><i>/.test(hostile), 'ids are escaped');

/* a pack registered later (NZ shape: statuses and a scope) shows with no change here */
const fake = { name: 'Newland · GST', version: '0.1.0', tax: { timing: { cite: 'Act s.1', status: 'unread' }, rate: { cite: 'Act s.2', status: 'confirmed' } }, scope: { out: { payroll: 'later' } } };
const fr = V.rulesOf(fake);
check(fr.length === 2 && fr[0].grey === true && fr[1].grey === false, 'a confirmed rule is not grey, an unread one is');

/* the list plumbing (source read): the column, filter, group switch only for a mixed firm */
const list = read('public/app/books-practice.js');
check(/num\('country', 'Country'/.test(list) && /filterOf\('country', 'Country'/.test(list), 'a Country column and a Country filter exist');
check(/function mixedCountries/.test(list) && /if \(mixedCountries\(\)\) cols\.splice\(1, 0, 'country'\)/.test(list), 'the column shows only when the firm has more than one country (no repeated label)');
check(/options = \[\['health', translate\('Health'\)\], \['country', translate\('Country'\)\]\]/.test(list), 'group by Health | Country switch');
check(!/'(AU|NZ|IN|AE)'/.test(read('public/app/country-rules-view.js')), 'no country code literal in the rules view');

/* the real list options, built against a stub window (the pattern of practice-a3p.cjs): the firm with AU + IN + AE clients, then a one-country firm */
const stub = { Promise, tx: (x) => x, URLSearchParams, encodeURIComponent, document: { readyState: 'loading', addEventListener() {}, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), head: { appendChild() {} }, documentElement: { classList: { add() {}, remove() {}, toggle() {} } } }, localStorage: { getItem() { return null; } }, location: { hostname: 'x', search: '' } };
const sb = vm.createContext({ module: { exports: {} }, window: stub, globalThis: stub, setInterval() {}, setTimeout() {}, URLSearchParams, encodeURIComponent });
vm.runInContext(read('public/engine/money.js'), sb); sb.CBMoney = sb.module.exports;
stub.CBRegulation = box.CBRegulation; /* the adopted bundle, loaded above */
for (const file of ['helpers.js', 'country-rules-view.js', 'books-acting.js', 'books-practice-band.js', 'books-practice-cells.js', 'books-practice.js']) vm.runInContext(read('public/app/' + file), sb, { filename: file });
stub.CBAssign = { heldFilter: () => ({ options: [], match: () => true }), hasHolders: () => false, slotHTML: () => '', queue: () => ({}) }; /* the assign bar is not under test */
const P = stub.CBPractice.parts;
const mk = (id, name, country, status) => ({ entity_id: id, name, country, role: 'adviser', stage: 'books_in', stage_blocker: null, year_end: null, queries: { open: 0, on_us: 0, on_client: 0 }, bas: { form: 'X', due_date: null }, bank: { state: 'none' }, health: { status, words: status, reasons: [] }, grant: {}, checked: { n: 0, of: 0 }, months_unlocked: 0 });
const PIPE = [{ key: 'books_in', n: 1 }];
const use = (clients) => P.use({ band: { bands: [{ key: 'pipeline', first: true, tiles: [] }], pipeline: PIPE }, clients, words: {} });
const mixed = [mk('1', 'A', 'AU', 'good'), mk('2', 'B', 'IN', 'help'), mk('3', 'C', 'AU', 'watch'), mk('4', 'D', 'AE', 'good')];
use(mixed);
const o = P.listOptions(mixed, 'pipeline');
check(o.defaultCols.indexOf('country') === 1, 'mixed firm: Country is the second column (' + o.defaultCols.join(',') + ')');
const fc = o.filters.find((x) => x.key === 'country');
check(fc && fc.options.map((x) => x.label).join('|') === 'Australia|India|United Arab Emirates', 'filter options are the pack names by name: ' + (fc && fc.options.map((x) => x.label).join('|')));
check(mixed.filter((r) => fc.match(r, 'AU')).length === 2 && mixed.filter((r) => fc.match(r, 'IN')).length === 1, 'filter Australia keeps 2 of 4, India 1 (hand count)');
check(o.group.options.length === 2 && o.group.options[1][0] === 'country', 'the group switch has Health and Country');
check(o.group.by(mixed[0], 'country')[0] === 'Australia' && o.group.by(mixed[0], 'country')[1] === 'AU' && o.group.by(mixed[0], 'health')[1] === 'good', 'group by country names the pack country; by health is as before');
check(o.search(mixed[0]).indexOf('Australia') >= 0, 'search finds a client by the country name');
const one = [mk('1', 'A', 'AU', 'good'), mk('3', 'C', 'AU', 'watch')];
use(one);
const o1 = P.listOptions(one, 'pipeline');
check(o1.defaultCols.indexOf('country') < 0 && !o1.filters.some((x) => x.key === 'country') && !o1.group.options, 'one-country firm: no Country column, filter or switch (no repeated label)');
process.exit(failures ? 1 : 0);
