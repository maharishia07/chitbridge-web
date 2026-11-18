'use strict';
// @type: unit
/**
 * shell-problem-words.test.cjs — P1-5 (18 Nov): a refused answer says its own words, never "[object Object]"; a 429 says the one rate-limit sentence.
 * OWNS      the proof of core.js answerWords (the ONE reader the header and every fetch use): a 429 with params.retry_after_seconds (524 → "Too many tries; wait 524 seconds", 1 → "1 second"),
 *           an RFC 9457 body by its detail, a wait on another status says the problem's words.
 * CALLED BY by hand: node e2e/shell-problem-words.test.cjs
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/shell
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
let failures = 0;
const check = (condition, message) => { console.log((condition ? '  ok ' : '  FAIL ') + message); if (!condition) failures++; };
const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'core.js'), 'utf8');
const pick = (name) => { const at = source.indexOf('function ' + name + '('); return source.slice(at, source.indexOf('\n}\n', at) + 3); };
const shellSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'shell.js'), 'utf8');
const pickShell = (name) => { const at = shellSrc.indexOf('function ' + name + '('); return shellSrc.slice(at, shellSrc.indexOf('
  }
', at) + 5); };
const sandbox = {};
sandbox.window = sandbox; /* shell.js (every shelled page) holds rateWords as root.cbRateWords; core.js answerWords reads it at call time */
vm.createContext(sandbox);
/* a page WITHOUT core.js (network.html): shell.js alone says the wait */
const alone = { root: {} }; vm.createContext(alone);
vm.runInContext(pickShell('rateWords') + 'this.out = rateWords;', alone);
check(alone.out({ params: { retry_after_seconds: 524 } }, 429) === 'Too many tries; wait 524 seconds', 'shell.js alone (no core.js) says the wait on a 429');
check(alone.out({ params: { retry_after_seconds: 524 } }, 403) === '' && alone.out({}, 429) === '', 'no wait or another status is empty');
vm.runInContext(pickShell('rateWords') + 'this.cbRateWords = rateWords;', sandbox);
vm.runInContext(pick('errWords') + pick('answerWords') + 'this.answerWords = answerWords;', sandbox);
const words = sandbox.answerWords;
check(typeof words === 'function', 'core.js answerWords is the one reader');
check(words({ params: { retry_after_seconds: 524 }, detail: 'x' }, 429) === 'Too many tries; wait 524 seconds', '524 s on a 429 says 524 seconds');
check(words({ params: { retry_after_seconds: 1 } }, 429) === 'Too many tries; wait 1 second', '1 s says 1 second');
check(words({ params: { retry_after_seconds: 30 }, detail: 'x' }, 403) === 'x', 'a wait on another status says the problem words');
check(words({ title: 'Nope', detail: 'The books are closed.' }, 403) === 'The books are closed.', 'a problem body says its detail');
check(words({}, 500) === '', 'nothing to say is empty, never "[object Object]"');
console.log(failures ? failures + ' FAILED' : 'all ok');
process.exit(failures ? 1 : 0);
