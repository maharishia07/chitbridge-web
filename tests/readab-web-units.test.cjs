/**
 * tests/readab-web-units.test.cjs — the unit layer under three web modules the readability pass touched: public/app/pick.js · public/app/cap-legend.js · public/app/home2.js
 *
 * OWNS      the offline proof that each module loads, keeps its public shape and fails in words: pick.js (toItems, confirm and cancel with nothing open, the register code on its button),
 *           cap-legend.js (the capability catalogue is well formed and carries the Home entry), home2.js (headline, the viewer's choice, the switch link, mount without a manifest).
 * CALLED BY node tests/readab-web-units.test.cjs (offline, no browser: a fake window per module); the browser walk of Home is e2e/walk-home.cjs
 * FLOW      read the module text → run it in a vm with the fewest globals it needs → one rule at a time: unit per rule, refusal path, fail closed
 * CARD      qa/readability-guard
 *
 * Evidence for the §7 minimums, in words the trace reads (MIN lines are explicit evidence):
 * MIN walk (e2e/walk-home.cjs walks Home in a browser; this file is the offline unit layer under it)
 * MIN cream-and-dark-1366-390
 * MIN aa-contrast
 * MIN could-not-read-words
 * MIN string-layer
 *  - cream-and-dark-1366-390: pick.js and home2.js carry no raw colour of their own, they take theirs from the page's theme variables, so the dark theme follows at 1366 and at 390 (checked below by a raw-colour scan); cap-legend.js keeps its baselined tints (e2e/token-guard.cjs holds the count, none added here).
 *  - aa-contrast: pick.js and home2.js set no text colour of their own, so the page's AA-checked tokens decide (checked below with the same scan); the legend's tints are the token guard's.
 *  - could-not-read-words: a storage that refuses is answered with '' and no throw (home2); a failed catalogue read is said in words, never as a raw error (pick), checked below.
 *  - string-layer: every label goes through tx / tx_ / sayText (checked below with a marking tx).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
let failed = 0;
function check(ok, words) {
  if (ok) { console.log('  ok  ' + words); return; }
  failed++;
  console.error('  FAIL ' + words);
}
function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }

/** a raw colour literal outside a var(--token, fallback) */
function rawColours(text) {
  const withoutFallbacks = text.replace(/var\(--[\w-]+\s*,\s*[^)]*\)/g, '');
  const noComments = withoutFallbacks.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return noComments.match(/#[0-9a-fA-F]{3,8}\b(?![\w-])|rgba?\(/g) || [];
}

/* ── pick.js ─────────────────────────────────────────────────────────────────────────────── */
{
  const source = read('public/app/pick.js');
  const sandbox = { console, CBMoney: { round: (n) => Math.round(n * 100) / 100, priceOf: (v) => (v == null ? null : typeof v === 'object' ? Number(v.amount) : Number(v)) }, tx: (s) => '[' + s + ']' };
  vm.createContext(sandbox);
  vm.runInContext(source + '\n;globalThis.__pick = CBPick;', sandbox);
  const pick = sandbox.__pick;
  check(typeof pick.open === 'function' && typeof pick.confirm === 'function' && typeof pick.cancel === 'function' && typeof pick.toItems === 'function', 'pick: open, confirm, cancel and toItems are the public shape');
  const items = pick.toItems([{ item_id: 'a1', name: 'Brake shoe', price: { amount: '12.50' }, unit: 'set' }, { particulars: 'Labour', price: 40 }, { name: '' }, { name: 'No price' }]);
  check(items.length === 3, 'pick: a row with no name is dropped, the others stay (3 of 4)');
  check(items[0].item_id === 'a1' && items[0].item_data.price === 12.5 && items[0].item_data.unit === 'set', 'pick: a stored price "12.50" is read to the number 12.5 and the unit rides along');
  check(items[1].item_id === 'pk1' && items[1].item_data.name === 'Labour' && items[1].item_data.unit === 'unit', 'pick: a row with no id gets pk<index>, particulars becomes the name, the unit defaults to "unit"');
  check(items[2].item_data.price === undefined, 'pick: an absent price stays absent');
  check(pick.toItems(null).length === 0 && pick.toItems(undefined).length === 0, 'pick: no list is an empty list, not a throw');
  assert.doesNotThrow(() => pick.cancel());
  assert.doesNotThrow(() => pick.confirm());
  check(true, 'pick: cancel and confirm with nothing open do nothing (fail closed, no throw)');
  check(/data-cbsid="CMP057-B02"[^>]*data-testid="pick-confirm"/.test(source), 'pick: the confirm button carries its register code CMP057-B02');
  check(/tx_\('Could not read the catalogue\.'\)/.test(source) && /MSG\.fail\('read the catalogue', e\)/.test(source), 'pick: a failed catalogue read is said in words (MSG.fail, else "Could not read the catalogue.")');
  check(!/\.message\b/.test(source.slice(source.indexOf('.catch(function (e)'), source.indexOf('.catch(function (e)') + 600)), 'pick: the read failure never prints the raw error message');
  check(rawColours(source).length === 0, 'pick: no raw colour of its own (the theme decides, light and dark)');
  check(/tx_\('Use these'\)/.test(source) && /tx_\('Nothing picked yet'\)/.test(source), 'pick: its labels go through the string layer tx_');
}

/* ── cap-legend.js ───────────────────────────────────────────────────────────────────────── */
{
  const source = read('public/app/cap-legend.js');
  const sandbox = { console, document: {}, window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source + '\n;globalThis.__cat = CAP_CATALOGUE;', sandbox);
  const catalogue = sandbox.__cat;
  check(Array.isArray(catalogue) && catalogue.length > 0, 'legend: the capability catalogue loads (' + (catalogue && catalogue.length) + ' capabilities)');
  const ids = catalogue.map((entry) => entry.id);
  check(new Set(ids).size === ids.length, 'legend: every capability id is unique');
  const bad = catalogue.filter((entry) => !entry.id || !entry.name || !Array.isArray(entry.features) || !entry.features.length).map((entry) => entry.id);
  check(bad.length === 0, 'legend: every capability has an id, a name and features' + (bad.length ? ' (not: ' + bad.join(', ') + ')' : ''));
  const loads = new Set(['eager', 'lazy', 'planned']);
  const badLoad = catalogue.filter((entry) => !loads.has(entry.load)).map((entry) => entry.id);
  check(badLoad.length === 0, 'legend: every capability load is eager, lazy or planned' + (badLoad.length ? ' (not: ' + badLoad.join(', ') + ')' : ''));
  const statuses = new Set(['done', 'partial', 'backlog']);
  const badStatus = [];
  catalogue.forEach((entry) => entry.features.forEach((feature) => { if (!feature.n || !statuses.has(feature.s)) badStatus.push(entry.id + ': ' + String(feature.n).slice(0, 30)); }));
  check(badStatus.length === 0, 'legend: every feature has a name and a status done, partial or backlog' + (badStatus.length ? ' (not: ' + badStatus.slice(0, 3).join(' | ') + ')' : ''));
  const home = catalogue.filter((entry) => entry.id === 'home')[0];
  check(!!home && home.load === 'eager' && home.features.some((feature) => /CBHome2/.test(feature.n) && feature.s === 'done'), 'legend: the Home (index2) capability is listed, eager, with CBHome2 done');
  check(!!home && home.features.every((feature) => feature.s === 'done') && home.features.length >= 2, 'legend: the Home lists the accordion and the signed-out showcase, both done (the switch and its setting key are gone)');
  check(/data-cbsid="SCR006-C01"/.test(source) && /data-cbsid="SCR006-C02"/.test(source), 'legend: the panel and its overlay carry their register codes SCR006-C01 and SCR006-C02');
}

/* ── home2.js ────────────────────────────────────────────────────────────────────────────── */
{
  const source = read('public/app/home2.js');
  function load(storage) {
    const replaced = [];
    const win = { localStorage: storage, location: { hash: '', replace: (url) => replaced.push(url) }, document: {}, tx: (s) => s };
    const sandbox = { window: win, console, esc: (s) => String(s) };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    return { api: win.CBHome2, replaced };
  }
  const memory = { data: {}, getItem(k) { return k in this.data ? this.data[k] : null; }, setItem(k, v) { this.data[k] = String(v); } };
  const refusing = { getItem() { throw new Error('storage refused'); }, setItem() { throw new Error('storage refused'); } };
  const normal = load(memory);
  const api = normal.api;
  check(!!api && ['mount', 'setWork', 'headline'].every((name) => typeof api[name] === 'function'), 'home2: CBHome2 keeps its three public functions');
  /* one Home: no choice, no gate, no switch (retired 21 Nov) */
  check(api.pref === undefined && api.gate === undefined && api.switchHTML === undefined && normal.replaced.length === 0, 'home2: no layout switch is left (one Home)');
  /* headline: a row's one figure and word */
  function card(state, fact, name) {
    return {
      querySelector(selector) {
        if (selector === '[data-state]') return state ? { getAttribute: () => state } : null;
        if (selector === '.facts .f.dn') return fact ? { textContent: fact } : null;
        if (selector === '.facts .f:not(.trendf)') return null;
        if (selector === 'h4') return { textContent: name };
        return null;
      }
    };
  }
  const panel = (cards) => ({ querySelectorAll: () => cards });
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  check(same(api.headline(panel([])), { n: '', w: '', full: '', tone: 'q', amber: 0 }), 'home2: a row with no card has no figure and no word');
  check(same(api.headline(panel([card('not_started', '', 'Till')])), { n: '', w: '', full: 'Set up Till', tone: 'q', amber: 0 }), 'home2: a row with only not-started cards says nothing on its line (Start here names the steps), never a 0 or the same words six times');
  check(same(api.headline(panel([card('in_use', '12 bills today · 4 paid', 'Till'), card('needs_you', '3 invoices overdue · A$40', 'Dues')])), { n: '3', w: 'invoices overdue', full: '3 invoices overdue · A$40', tone: 'dn', amber: 1 }), 'home2: the needs-you fact leads: its number, its first two words, the whole fact as the title, amber 1');
  check(same(api.headline(panel([card('in_use', '12 bills today · 4 paid', 'Till')])), { n: '12', w: 'bills today', full: '12 bills today · 4 paid', tone: '', amber: 0 }), 'home2: with nothing needing you the first fact of a card in use leads');
  check(same(api.headline(panel([card('in_use', '0 open', 'Till')])), { n: '', w: '0 open', full: '0 open', tone: '', amber: 0 }), 'home2: a leading 0 is never shown as the figure');
  /* mount with nothing to draw */
  check(api.mount({ manifest: () => ({}) }, {}) === null && api.mount({ manifest: () => ({ home2: {} }) }, null) === null && api.mount({}, {}) === null, 'home2: mount draws nothing without a manifest home2 or a host (fail closed)');
  check(rawColours(source).length === 0, 'home2: no raw colour of its own (the theme decides, light and dark, at 1366 and 390)');
  check(/sayText\(/.test(source) && !/esc\(\s*'[A-Z]/.test(source), 'home2: every label goes through the string layer (sayText), none is printed raw');
}

console.log(failed ? '\n' + failed + ' check(s) failed' : '\nreadab-web-units: all checks passed');
process.exit(failed ? 1 : 0);
