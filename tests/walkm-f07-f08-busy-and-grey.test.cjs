/**
 * tests/walkm-f07-f08-busy-and-grey.test.cjs - WALK M (21 Nov): M-F-07 a 429 on a read says "Too many requests - try again in N s" (the wait from the body or Retry-After), never "could not be read";
 * M-F-08 the Accounts menu greys the entries a view-only login cannot open, with the reason (one readiness state: aria-disabled, data-ready="no").
 * OWNS  the proof of shell.js readFailed (429), core.js err.retryAfter, accounts.html navItems / VIEW_ONLY_SHUT. Runs the real shell.js in a stub window. No browser.
 * Run: node tests/walkm-f07-f08-busy-and-grey.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const win = { document: undefined, matchMedia: undefined, esc: (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]) };
win.window = win;
vm.runInNewContext(read('public/app/shell.js'), win);
const host = {}; const draw = (options) => { host.innerHTML = ''; host.querySelector = () => null; win.CBShell.readFailed(host, options); return host.innerHTML; };

/* M-F-07 */
const busy = draw({ what: 'Accounts', status: 429, retryAfter: 7 });
assert(busy.includes('Too many requests') && busy.includes('7 s') && !busy.includes('could not be read'), 'a 429 names the wait: ' + busy);
assert(draw({ what: 'Accounts', status: 429 }).includes('try again in a moment'), 'a 429 without a wait still says it is busy');
assert(draw({ what: 'Accounts', status: 500 }).includes('could not be read'), 'a 5xx is still a failed read');
assert(/retryAfter = Math\.ceil\(.*retry_after_seconds.*Retry-After/.test(read('public/app/core-answers.js')), 'core-answers.js (errorFacts, called by core.js apiOnce): the one api client puts retryAfter on the error (body, else the header)');
assert(read('public/accounts.html').includes('retryAfter: failure && failure.retryAfter'), 'the Accounts card passes it');

/* M-F-08 */
const page = read('public/accounts.html');
const ids = /const VIEW_ONLY_SHUT = \{([^}]*)\}/.exec(page);
assert(ids, 'the shut list exists');
['tb', 'pl', 'bs', 'gstclose', 'delegate', 'access'].forEach((id) => assert(new RegExp('(^|[ ,{])' + id + ':').test(ids[1]), id + ' is greyed for a view-only login'));
assert(!/(^|[ ,{])todo:/.test(ids[1]), 'To do stays open');
assert(page.includes('aria-disabled="true" data-ready="no"') && page.includes("getAttribute('aria-disabled') === 'true') return;"), 'a greyed entry carries the reason, does not open');
assert(/viewOnlySeat = \(\) =>[\s\S]*CBBooksActing\.current\(\)[\s\S]*viewOnlyLogin\(\)/.test(page), 'only a view-only login (not a firm seat, not the owner) is greyed');
console.log('walkm-f07-f08-busy-and-grey: ok');
