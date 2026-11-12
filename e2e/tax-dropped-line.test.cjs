'use strict';
// @type: unit
/**
 * tax-dropped-line.test.cjs: the Tax month says WHY it is short (api #1180: GET /api/tax/ledger sends `dropped` + `dropped_why`).
 * CARD 18-reports/mis-tax · owns: the proof of cap-admin.js taxDroppedHTML · called by: ci.yml
 * Fails on main (no taxDroppedHTML). Cases: one dropped bill is named in words with its Open; an older api (no keys) paints nothing and does not throw;
 * the Open carries its UX-137 code (CMP010) and an id; a hostile sentence is escaped.
 * Run: node e2e/tax-dropped-line.test.cjs
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-admin.js'), 'utf8');
const at = src.indexOf('function taxDroppedHTML(');
assert(at >= 0, 'taxDroppedHTML is missing from cap-admin.js');
const end = src.indexOf('\nfunction misTax()', at);
const box = { tx: (s) => s, esc: (s) => String(s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';') };
vm.createContext(box);
vm.runInContext(src.slice(at, end) + '\nthis.f = taxDroppedHTML;', box);
let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('  ok  ' + name); };

t('one dropped bill: the sentence, the why, and an Open for it', () => {
  const h = box.f({ dropped: ['c-77'], dropped_why: ['The bill has no amount we can read.'] });
  assert(h.includes('1 bill could not be read and is left out of this month: The bill has no amount we can read.'), h);
  assert(h.includes("openChit('c-77')") && h.includes('data-cbsid="CMP010"') && h.includes('data-testid="mis-tax-dropped-open-0"'), h);
});
t('several: plural words, one Open each', () => {
  const h = box.f({ dropped: ['a', 'b'], dropped_why: 'x' });
  assert(h.includes('2 bills could not be read and are left out of this month: x'));
  assert.strictEqual(h.split('data-cbsid="CMP010"').length - 1, 2);
});
t('an older api (no keys) or an empty list paints nothing', () => {
  assert.strictEqual(box.f({}), '');
  assert.strictEqual(box.f({ dropped: [] }), '');
});
t('a hostile sentence is escaped', () => {
  const h = box.f({ dropped: ['a'], dropped_why: ['<img onerror=x>'] });
  assert(!h.includes('<img'));
});
t('the Tax band paints it', () => assert(/taxDroppedHTML\(L\)/.test(src.slice(end))));
console.log(pass + ' passed');
