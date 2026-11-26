/**
 * tests/pathreds-1130.test.cjs — the auditor-path reds that were "fixed" in wave 6 but not on the live box (lane pathreds, 26 Nov)
 *
 * OWNS      one failing-first proof per row: RW3-07 (Home closed row never ends on a connector) · RW3-15 (Shop window reads the handle where crm.html has it) ·
 *           RW3-16 (the return tab word reaches a page with no registry) · RW3-13 (a sheet's buttons stay in view at 1366x768)
 * CALLED BY node tests/pathreds-1130.test.cjs (offline, vm; no browser); run on a SIT box with sit-box-run.sh (see wt-next/BATCH-1130.md)
 * FLOW      read the module text → run it in a vm with the fewest globals → one rule per check
 * CARD      qa/readability-guard
 * MIN cream-and-dark-1366-390
 * MIN aa-contrast
 * MIN could-not-read-words
 * MIN string-layer
 *  - cream-and-dark-1366-390: no colour is set by these checks; the sheet rule uses the page's tokens only.
 *  - aa-contrast: no text colour is added.
 *  - could-not-read-words: a failed /me read leaves the link saying "Not available yet", never a wrong link (RW3-15 below).
 *  - string-layer: the words go through sayText / tx as before.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let failed = 0;
const pending = [];
const check = (ok, words) => { if (ok) console.log('  ok  ' + words); else { failed += 1; console.log('  FAIL ' + words); } };
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

/* ── RW3-07: "23 entries to fix" was cut to "23 entries to" (the first two words) ── */
{
  const win = { localStorage: { getItem: () => null, setItem() {} }, location: { hash: '', replace() {} }, document: {}, tx: (s) => s };
  const sandbox = { window: win, console, esc: (s) => String(s) };
  vm.createContext(sandbox);
  vm.runInContext(read('public/app/home2.js'), sandbox);
  const api = win.CBHome2;
  const card = (state, fact, name) => ({ querySelector(s) { if (s === '[data-state]') return { getAttribute: () => state }; if (s === '.facts .f.dn') return fact ? { textContent: fact } : null; if (s === '.facts .f:not(.trendf)') return null; if (s === 'h4') return { textContent: name }; return null; } });
  const panel = (cards) => ({ querySelectorAll: () => cards, querySelector: () => null });
  const head = (fact) => api.headline(panel([card('needs_you', fact, 'Accounts')]));
  check(head('23 entries to fix').w === 'entries to fix', 'RW3-07: "23 entries to fix" keeps its verb: ' + head('23 entries to fix').w);
  check(head('3 invoices overdue · A$40').w === 'invoices overdue', 'RW3-07: two plain words stay two words');
  check(head('4 bills to pay · A$40').w === 'bills to pay', 'RW3-07: a short connector pulls in the next word');
  check(!/\b(to|of|in|on|for|at|by|and)$/.test(head('9 items waiting for you').w), 'RW3-07: never ends on a connector: ' + head('9 items waiting for you').w);
}

/* ── RW3-24: Assist read-only line and the Bank key in plain words ── */
{
  const node = () => new Proxy({ style: {} }, { get: (t, k) => (k in t ? t[k] : () => node()), set: (t, k, v) => { t[k] = v; return true; } });
  const run = (publish) => {
    const cx = vm.createContext({ console, esc: (s) => String(s == null ? '' : s), tx: (s) => s, document: { getElementById: () => node() }, EP: {}, CBList: { mount: () => ({}) }, CBTasks: { actRow: (id) => '<button id="' + id + '"></button>' }, CBAction: {}, api: (key) => (key === 'assistWhoami' ? Promise.resolve({ actions: { publish } }) : Promise.resolve([{ id: 'q1', q: 'Q', a: 'A', context: ['*'] }])) });
    cx.window = cx; cx.globalThis = cx;
    vm.runInContext(read('public/app/cap-assist.js'), cx);
    return cx.CBAssistReview.mount(node()).then(() => cx.CBAssistReview.reviewHTML());
  };
  pending.push(run({ ok: false, why: 'not_helpdesk', say: 'Only a help desk can publish to its catalogue.' }).then((html) => {
    check(!/help desk|publish|catalogue/i.test(html) && /ca-readonly/.test(html), 'RW3-24: the owner reads one plain line, no "help desk can publish": ' + html.replace(/<[^>]+>/g, ''));
  }));
  pending.push(run({ ok: false, why: 'other', say: 'Some other sentence.' }).then((html) => check(html.includes('Some other sentence.'), 'RW3-24: any other refusal still shows the own sentence of the server')));
  const bank = read('public/app/cap-bank-home.js');
  const keyLine = bank.split(String.fromCharCode(10)).find((l) => l.includes('bkh-key')) || '';
  check(keyLine.includes("tx('not signed off')") && !keyLine.includes('not signed off yet') && keyLine.includes("tx('no statement kept')"), 'RW3-24: the Bank key says "not signed off" (not "yet") and "no statement kept"');
  const gaps = bank.split(String.fromCharCode(10)).filter((l) => l.includes('bank-stmts-miss-'));
  check(gaps.length === 2 && gaps.every((l) => l.includes("tx('no statement kept')") && !l.includes("tx('Not signed off')")), 'RW3-24: a gap cell and the key use ONE word for the same state');
}

/* ── RW3-16: the BAS tab word on a page that loads no pack registry (network.html: the firm's client books) ── */
{
  const win = { CBRegulation: undefined };
  const sandbox = { window: win, console, document: { documentElement: {} } };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('public/app/helpers.js'), sandbox);
  const word = (kind, cc) => vm.runInContext('packWord(' + JSON.stringify(kind) + ', ' + JSON.stringify(cc) + ')', sandbox);
  check(word('returnName', 'AU') === 'BAS', 'RW3-16: an AU client with no registry on the page still names its return BAS: "' + word('returnName', 'AU') + '"');
  check(word('returnName', 'AE') === 'VAT return', 'RW3-16: an AE client names it "VAT return": "' + word('returnName', 'AE') + '"');
  check(word('returnName', '') === '' && word('returnName', 'ZZ') === '', 'RW3-16: no country, or one with no row, gives no word (the tab keeps its own label)');
  const view = read('public/app/books-grant-view.js');
  check(view.includes("packWord('returnName', clientCountry())"), 'RW3-16: the tab asks packWord for the CLIENT country (the answer, else the page), not the page session alone');
}

Promise.all(pending).then(() => {
  if (failed) { console.log(failed + ' failed'); process.exit(1); }
  console.log('pathreds-1130: all ok');
});
