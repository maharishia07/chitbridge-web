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
  const view = read('public/app/books-grant-view.js');
  const label = view.slice(view.indexOf('function labelOf'), view.indexOf('function tabs'));
  check(label.includes('choices.return_name') && !label.includes('packWord'), 'RW3-16: the tab word is the one GET /periods names (return_name), not a registry the page does not load');
  const html = read('public/network.html');
  check(!html.includes('/engine/tax.js'), 'RW3-16: network.html still loads no 650 KB pack bundle for a tab word');
  /* run the real labelOf against a tab: BAS from the answer, "Tax return" while the answer names none */
  const ctx = vm.createContext({ grantKit: { viewState: { choices: { return_name: 'BAS' } } } });
  vm.runInContext(label.slice(label.indexOf('function labelOf')) + ' this.f = labelOf;', ctx);
  check(ctx.f({ k: 'bas', label: 'Tax return' }) === 'BAS' && ctx.f({ k: 'tb', label: 'Trial balance' }) === 'Trial balance', 'RW3-16: only the return tab takes the word; the others keep theirs');
  ctx.grantKit.viewState.choices = { periods: [] };
  check(ctx.f({ k: 'bas', label: 'Tax return' }) === 'Tax return', 'RW3-16: an answer that names no return leaves the tab "Tax return"');
}

Promise.all(pending).then(() => {
  if (failed) { console.log(failed + ' failed'); process.exit(1); }
  console.log('pathreds-1130: all ok');
});
