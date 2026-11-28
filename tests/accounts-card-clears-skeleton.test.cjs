/**
 * tests/accounts-card-clears-skeleton.test.cjs — 1138 firm seats: a page that ends in a card (refusal, Ledger off, country setup) leaves no skeleton.
 * Found on sit-au 28 Nov: an auditor opening /accounts.html?acting=<client>#/daybook read "This screen is not open to your seat" with the menu's first-paint
 * skeleton (accounts.html #nav .bk-skel) still shimmering beside it (the screen watch counted it as a stuck spinner). ONE enforcer: card().
 * Runs the real card() from accounts.html against a small fake page; MUTATION: the clearing removed goes red. Run: node tests/accounts-card-clears-skeleton.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'accounts.html'), 'utf8');
const body = (src) => { const i = src.indexOf('function card(html, bad) {'); assert.ok(i > 0, 'card() not found'); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } };
function run(src) {
  const el = (over) => Object.assign({ innerHTML: '', textContent: '', hidden: false, querySelector: () => null }, over);
  const nav = el({ innerHTML: '<div class="bk-skel"></div>', querySelector: (q) => (q === '.bk-skel' && /bk-skel/.test(nav.innerHTML) ? {} : null) });
  const els = { nav, title: el(), content: el(), summary: el() };
  const ctx = vm.createContext({ $: (id) => els[id], document: { body: { classList: { remove() {} } } } });
  vm.runInContext(body(src) + '\ncard("<p>refused</p>", true);', ctx);
  return els;
}
let bad = 0; const ok = (n, f) => { try { f(); console.log('  ok  ', n); } catch (e) { bad++; console.log('  FAIL', n, e.message); } };
ok('card() clears the menu skeleton and paints the card', () => { const e = run(html); assert.strictEqual(e.nav.innerHTML, ''); assert.ok(/refused/.test(e.content.innerHTML)); });
ok('MUTATION: card() without the clearing leaves the skeleton (red)', () => { const e = run(html.replace(/ {2}if \(\$\('nav'\) && \$\('nav'\)\.querySelector\('\.bk-skel'\)\)[^\n]*\n/, '')); assert.ok(/bk-skel/.test(e.nav.innerHTML)); });
console.log('2 checks, ' + bad + ' failed'); process.exit(bad ? 1 : 0);
