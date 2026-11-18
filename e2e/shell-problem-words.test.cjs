'use strict';
// @type: unit
/**
 * shell-problem-words.test.cjs — P1-5 (18 Nov): the header says a refused answer's own words, never "[object Object]".
 * OWNS      the proof of CBShellFacts.problemWords: a 429 with params.retry_after_seconds (hand-computed: 524 s → 9 minutes, 60 s → 1 minute, 30 s → under a minute),
 *           an RFC 9457 body by its detail, a name that is an object by its name.
 * CALLED BY by hand: node e2e/shell-problem-words.test.cjs
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/shell
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
let failures = 0;
const check = (condition, message) => { console.log((condition ? '  ok ' : '  FAIL ') + message); if (!condition) failures++; };
const noop = () => ({ style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, appendChild() {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] });
const sandbox = { console, setTimeout, clearTimeout, document: { createElement: noop, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], body: noop(), documentElement: noop() }, localStorage: { getItem: () => null, setItem() {} }, navigator: {}, matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {}, location: { href: '', hash: '' } };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
try { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'shell-facts.js'), 'utf8'), sandbox, { filename: 'shell-facts.js' }); } catch (e) { console.log('  FAIL shell-facts.js did not load: ' + e.message); process.exit(1); }
const words = sandbox.CBShellFacts && sandbox.CBShellFacts.problemWords;
check(typeof words === 'function', 'CBShellFacts.problemWords is the one helper');
if (words) {
  check(words({ params: { retry_after_seconds: 524 }, detail: 'x' }, 429) === 'Too many requests: try again in 9 minutes', '524 s on a 429 says 9 minutes');
  check(words({ params: { retry_after_seconds: 60 } }, 429) === 'Too many requests: try again in 1 minute', '60 s says 1 minute');
  check(words({ params: { retry_after_seconds: 30 } }, 429) === 'Too many requests: try again in a minute', '30 s says in a minute');
  check(words({ title: 'Nope', detail: 'The books are closed.' }, 403) === 'The books are closed.', 'a problem body says its detail');
  check(words({ name: 'Moonee Espresso' }, 200) === 'Moonee Espresso', 'an object name says its name');
  check(words({}, 500) === '', 'nothing to say is empty, never "[object Object]"');
}
console.log(failures ? failures + ' FAILED' : 'all ok');
process.exit(failures ? 1 : 0);
