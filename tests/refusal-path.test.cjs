'use strict';
/* B7 (ERR-13/4/5/10): the ONE refusal path, in node with a stub page. A problem body -> the sentence AND its hint and code on the card and the toast;
   a dead network -> a named error; a capability that will not load -> a card with its name; empty (200, nothing) apart from failed.
   Run: node tests/refusal-path.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('  ok  ' + m); };
const app = (f) => fs.readFileSync(__dirname + '/../public/app/' + f, 'utf8');
const cx = vm.createContext({ console, setTimeout, clearTimeout, tx: (s) => s });
cx.window = cx;
/* refusalFacts + errWords + answerWords are plain functions: lift them out of core.js, scrErr + apiRead + esc out of helpers.js */
const grab = (src, name) => { const i = src.indexOf('function ' + name + '('); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } };
const core = app('core.js'), helpers = app('helpers.js');
vm.runInContext(['refusalFacts', 'errWords'].map((f) => grab(core, f)).join('\n') + '\n' + ['esc', 'errLine', 'scrErr', 'apiRead'].map((f) => grab(helpers, f)).join('\n'), cx);
const run = (code) => vm.runInContext(code, cx);

const body = { code: 'PERIOD_LOCKED', detail: 'January is locked.', hint: 'Ask the owner to reopen the month.', request_id: 'abc123', status: 409 };
cx.body = body;
const err = run("(function(){ var e = new Error(errWords(body)); e.status = 409; return refusalFacts(e, body, 'rid'); })()");
ok(err.message === 'January is locked.' && err.hint === body.hint && err.code === 'PERIOD_LOCKED' && err.requestId === 'abc123', 'a problem body: sentence, hint, code and request id ride on the error');
cx.err = err;
const card = run('scrErr(err, "the month")');
ok(card.includes('January is locked.') && card.includes('Ask the owner to reopen the month.') && card.includes('data-cb-error-code="PERIOD_LOCKED"'), 'the card shows the sentence, the next step and carries the code');
ok(!/Something went wrong|Try again/.test(card), 'no generic text on the card');
const net = run("refusalFacts(new Error(\"You're offline\"), null, 'r1', 'network')");
ok(net.kind === 'network' && net.requestId === 'r1' && !net.hint, 'a network failure is marked network and has no invented hint');
const cap = run("(function(){ var e = new Error('Could not load the books capability.'); e.capability = 'books'; return e; })()");
cx.cap = cap;
ok(run('scrErr(cap)').includes('load books'), 'a capability that fails to load shows one card with its name');

const shell = app('cb-words.js'); /* rewordPlain · friendlyErr · toastRefusal live in the neutral words file since the customer delink */
vm.runInContext([grab(shell, 'rewordPlain'), grab(shell, 'friendlyErr'), grab(shell, 'toastRefusal')].join(String.fromCharCode(10)), cx);
const sessionErr = run("(function(){ var e = new Error('Your session expired, sign in again.'); e.code = 'AUTH_EXPIRED'; return e; })()");
cx.sessionErr = sessionErr; cx.window.CB_LAST_REFUSAL = sessionErr;
ok(run('friendlyErr(sessionErr)') === sessionErr.message && run('toastRefusal(friendlyErr(sessionErr)).attr').includes('AUTH_EXPIRED'), 'friendlyErr leaves an api error with a code alone, so its toast keeps the code');
ok(run("friendlyErr(new Error('Failed to fetch'))").includes('network hiccup'), 'a codeless network failure is still reworded');

/* ERR-14: cbStampRefusal puts the code on a screen's OWN line about a fresh refusal (stub nodes, no browser) */
vm.runInContext('var REFUSAL_FRESH_MS = 3000;' + grab(shell, 'cbStampRefusal'), cx);
const node = (text, kids, attrs) => { const n = { nodeType: 1, children: kids || [], attrs: Object.assign({}, attrs), textContent: text + (kids || []).map((k) => k.textContent).join(''), hasAttribute(k) { return k in this.attrs; }, getAttribute(k) { return this.attrs[k] || null; }, setAttribute(k, v) { this.attrs[k] = v; }, closest() { return null; } };
  n.querySelectorAll = () => { const all = []; const walk = (x) => x.children.forEach((c) => { all.push(c); walk(c); }); walk(n); return all; }; return n; };
const line = node('Locked: January is locked.'), other = node('Saved'), wrap = node('', [line, other]);
cx.stampWrap = wrap; cx.window.CB_LAST_REFUSAL = Object.assign(new Error('January is locked.'), { code: 'PERIOD_LOCKED', at: Date.now() });
ok(run('cbStampRefusal(stampWrap)') === 1 && line.attrs['data-cb-error-code'] === 'PERIOD_LOCKED' && !other.attrs['data-cb-error-code'] && !wrap.attrs['data-cb-error-code'], 'the innermost line holding the refusal words is stamped, nothing else');
cx.window.CB_LAST_REFUSAL.at = Date.now() - 10000; line.attrs = {};
ok(run('cbStampRefusal(stampWrap)') === 0, 'a refusal older than 3 s stamps nothing');

(async () => {
  cx.api = (key) => key === 'empty' ? Promise.resolve([]) : key === 'full' ? Promise.resolve([1]) : key === 'slow' ? new Promise(() => {}) : Promise.reject(err);
  const empty = await run("apiRead('empty')"), full = await run("apiRead('full')"), failed = await run("apiRead('bad')");
  ok(empty.state === 'empty' && !empty.error, 'a 200 with nothing is empty, not failed');
  ok(full.state === 'ok' && full.data.length === 1, 'a 200 with rows is ok');
  ok(failed.state === 'failed' && failed.error === err, 'a refusal is failed and carries the error');
  const slow = await run("apiRead('slow', null, null, 30)");
  ok(slow.state === 'failed' && slow.error.kind === 'timeout', 'a read with no answer inside the limit is failed (timeout), so a spinner ends in the card');
  console.log(n + ' ok');
})();
