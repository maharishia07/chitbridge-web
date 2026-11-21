'use strict';
// @type: unit
/**
 * tests/readab-1129-handlers.test.cjs — the unit layer under four web modules whose inline handlers and failure words the 1129 batch changed:
 * public/app/cap-adopt.js · public/app/cap-intake.js · public/app/cap-service.js · public/app/cap-supplies.js
 *
 * OWNS      the offline proof that a value placed inside an inline handler's string literal goes through escJs (a quote in a name or id cannot end the string),
 *           that no raw `e.message` is painted by cap-intake.js (it speaks through failWords), and that escJs itself refuses a quote.
 * CALLED BY node tests/readab-1129-handlers.test.cjs (offline, no browser); the page walks are e2e/intake-page-checks.test.cjs and e2e/guard-xss-handlers.cjs
 * UNIT      22/Intake screen · 24/Suppliers · 26/Service pauses · 27/Adopt
 * FLOW      read each module's text → one rule at a time: the handler argument is escaped for JS, the failure is said in words, a hostile name stays inside its quotes
 * CARD      qa/readability-guard
 *
 * Evidence for the §7 minimums, in words the trace reads (MIN lines are explicit evidence):
 * MIN walk (e2e/intake-page-checks.test.cjs and e2e/guard-xss-handlers.cjs walk the page text and the handler positions; this file is the unit layer under them)
 * MIN cream-and-dark-1366-390
 * MIN aa-contrast
 * MIN could-not-read-words
 *  - cream-and-dark-1366-390: these four modules take their colours from the page's theme variables (var(--...)), the change touched no colour, so the dark theme follows at 1366 and at 390 (e2e/token-guard.cjs holds the raw-colour count).
 *  - aa-contrast: the change sets no text colour; the page's AA-checked tokens decide (e2e/intake-page-checks.test.cjs reads the contrast).
 *  - could-not-read-words: a failed call is said by failWords (the problem's own sentence or the fallback), never a raw library message (checked below on cap-intake.js).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { liftFns } = require('../e2e/lib/lift-fn.cjs');

const ROOT = path.join(__dirname, '..');
let failed = 0;
function check(ok, words) {
  if (ok) { console.log('  ok  ' + words); return; }
  failed++;
  console.error('  FAIL ' + words);
}
function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }
function count(text, needle) { return text.split(needle).length - 1; }

/* ── escJs, the real one from helpers.js ──────────────────────────────────────────────────── */
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(liftFns('public/app/helpers.js', ['esc', 'escJs'], '') + '\n;globalThis.__escJs = escJs;', sandbox);
const escJs = sandbox.__escJs;
const hostile = escJs("O'Brien\"); alert(1); (\"");
check(hostile.indexOf("'") < 0 && hostile.indexOf('"') < 0 && hostile.indexOf('<') < 0, 'escJs: a quote, a double quote and an angle bracket in a value never survive raw');
check(escJs(null) === '' && escJs(undefined) === '' && escJs(7) === '7', 'escJs: nothing is empty, a number is its digits (fail closed, no throw)');

/* ── the handler arguments of the four modules ────────────────────────────────────────────── */
/** a handler argument built with esc( straight after a quote-and-plus, i.e. inside onclick="fn('" + esc(x) — the bug escJs exists for */
function rawHandlerArgs(text) {
  return text.match(/onclick=\\?"[\w.]+\((?:[^"\n]|\n)*?'\s*\+\s*esc\(/g) || [];
}
check(rawHandlerArgs('onclick="go(\'\' + esc(x) + \'\')">').length === 1,'the scan itself: a handler argument built with esc( alone is found');
const MODULES = {
  'public/app/cap-adopt.js': ['escJs(seed.suggested_sku)'],
  'public/app/cap-intake.js': ['escJs(c.id)'],
  'public/app/cap-service.js': ['escJs(p.pause_id)'],
  'public/app/cap-supplies.js': ['escJs(s.supply_item_id)', 'escJs(s.name)', 'escJs(id)']
};
Object.keys(MODULES).forEach((file) => {
  const text = read(file);
  MODULES[file].forEach((arg) => check(count(text, arg) >= 1, file + ': the handler argument ' + arg + ' goes through escJs'));
  check(rawHandlerArgs(text).length === 0, file + ': no handler argument is built with esc( alone');
});
check(count(read('public/app/cap-service.js'), 'escJs(p.pause_id)') === 3, 'public/app/cap-service.js: Accept, Reject and End this pause all escape the pause id (3 of 3)');
check(count(read('public/app/cap-supplies.js'), 'escJs(') >= 3, 'public/app/cap-supplies.js: Used some (id and name) and Record all escape (3 of 3)');

/* ── cap-intake.js says failures in words ─────────────────────────────────────────────────── */
const intake = read('public/app/cap-intake.js');
check(count(intake, 'failWords(') >= 7, 'public/app/cap-intake.js: the failures of read, record, AI read, dismiss, raise and payload go through failWords (7 or more)');
check(count(intake, '(e && e.message) ||') === 0, 'public/app/cap-intake.js: no raw e.message is painted (the library message is never shown)');

console.log(failed ? '\n' + failed + ' check(s) failed' : '\nreadab-1129-handlers: all checks passed');
process.exit(failed ? 1 : 0);
