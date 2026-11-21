'use strict';
// @type: unit
/**
 * walks-home-not-started-group.test.cjs - WALK S S-F-04: Home said "Not started" 19 times and "Set up" 19 times (rule: the same status more than 3 times = a group).
 * When more than 3 cards are not started, the per-card chip is not drawn and ONE group line ("Not set up yet", the count, one "Set up" link) says it;
 * three or fewer keep their own chip. Also: the card's own "Set up" text carries the class the group hides (f ns).
 *
 * OWNS      the proof for CBShellFacts.groupSetUp and factsHTML (app/shell-facts.js)
 * CALLED BY ci.yml (QA gate); by hand: node e2e/walks-home-not-started-group.test.cjs
 * FLOW      load shell-facts.js in a vm, hand groupSetUp a fake Home with N not-started chips, read the group line and the grouped flag
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/shell
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
let failures = 0;
const check = (ok, message) => { console.log((ok ? '  ok ' : '  FAIL ') + message); if (!ok) failures++; };
const made = [];
const element = () => { const el = { attrs: {}, className: '', innerHTML: '', removed: false, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k] == null ? null : this.attrs[k]; }, removeAttribute(k) { delete this.attrs[k]; }, remove() { this.removed = true; } }; return el; };
const box = { console, esc: (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])), document: { createElement: () => { const el = element(); made.push(el); return el; } } };
box.window = box; vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'shell-facts.js'), 'utf8'), box);
const wording = { state: { needs_you: 'Needs you', in_use: 'In use', not_started: 'Not started' }, setUp: 'Set up', notStartedGroup: 'Not set up yet', notStartedCount: (n) => n + ' areas are waiting for you' };
box.CBShellFacts.painters(wording, (t) => t);
const home = (count) => {
  const holder = element();
  holder.querySelectorAll = () => Array.from({ length: count }, (_, i) => ({ closest: () => ({ getAttribute: () => '/page' + i + '.html' }) }));
  holder.insertAdjacentElement = (where, node) => { holder.group = node; };
  return holder;
};
const ctxOf = (holder) => ({ running: 0, queue: [], $: (sel) => (sel === '.cbsh-more' ? holder : sel === '[data-testid="shell-notstarted-group"]' ? holder.group || null : null) });
(function () {
  const holder = home(19), ctx = ctxOf(holder);
  box.CBShellFacts.groupSetUp(ctx);
  check(holder.getAttribute('data-ns-grouped') === '1', '19 not-started cards: the Home is marked grouped (the per-card chips are hidden by CSS)');
  const line = holder.group;
  check(line && /Not set up yet/.test(line.innerHTML) && /19 areas/.test(line.innerHTML), 'one group line says "Not set up yet" and the count');
  check(line && (line.innerHTML.match(/Set up/g) || []).length === 1 && /data-cbsid="HOM001-B01"/.test(line.innerHTML) && /href="\/page0.html"/.test(line.innerHTML), 'one "Set up" action, the Home card link into the first of them (code HOM001-B01)');
  check(/Not started/.test(line.innerHTML) === false, 'the group line does not repeat the word "Not started"');
  holder.querySelectorAll = () => [{ closest: () => ({ getAttribute: () => '/a' }) }, { closest: () => ({ getAttribute: () => '/b' }) }];
  box.CBShellFacts.groupSetUp(ctx);
  check(holder.getAttribute('data-ns-grouped') === null && line.removed, 'three or fewer: no group, each card keeps its own chip, the line is taken away');
  const busy = home(19); const waitCtx = ctxOf(busy); waitCtx.running = 1;
  box.CBShellFacts.groupSetUp(waitCtx);
  check(busy.getAttribute('data-ns-grouped') === null && !busy.group, 'while a card is still being read nothing is grouped');
  const html = box.CBShellFacts.painters(wording, (t) => t).factsHTML({ id: 'x' }, [], 'not_started', () => '');
  check(/class="f ns">Set up/.test(html), 'a card\'s own "Set up" carries class "ns", the one the grouped Home hides');
  process.exit(failures ? 1 : 0);
})();
