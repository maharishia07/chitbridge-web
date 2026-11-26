/**
 * e2e/lib/lift-fn.cjs — lift named functions out of a public/ source file so a test can run the REAL code in a vm sandbox.
 * OWNS      liftFns(file, names, indent): the text of each `function name(` up to its closing brace at the given indent (the files are prettier-formatted, so the
 *           closing brace of a top-level function sits at column 0 and of an IIFE member at two spaces).
 * CALLED BY e2e/cat-*.test.cjs (the P2 PROOF pass, 2026-11-14)
 *           loadScript(file): the whole script in a sandbox window.
 * FLOW      source file → function text → vm.runInContext(text, sandbox)
 */
'use strict';
const fs = require('fs');
const path = require('path');

function liftFns(relativeFile, names, indent) {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', relativeFile), 'utf8');
  const pad = indent || '';
  return names.map((name) => {
    const start = src.search(new RegExp('^' + pad + '(?:async )?function ' + name + '\\s*\\(', 'm'));
    if (start < 0) throw new Error(relativeFile + ': function ' + name + ' not found at indent "' + pad + '"');
    const end = src.indexOf('\n' + pad + '}\n', start);
    if (end < 0) throw new Error(relativeFile + ': end of ' + name + ' not found');
    return src.slice(start, end + 2 + pad.length);
  }).join('\n');
}

/** run a whole public/ script in a vm sandbox that looks enough like a window (no browser); returns the sandbox, so sandbox.CBCart etc. are the real objects */
function loadScript(relativeFile, extras) {
  const vm = require('vm');
  const sb = Object.assign({ console, setTimeout, clearTimeout, Date, Math, JSON, Promise, addEventListener() {} /* cap-admin forgets a minted key on pagehide (p2wave-sec, bdad61a57) */ }, extras || {});
  sb.window = sb; sb.globalThis = sb;
  sb.document = { getElementById: () => null, createElement: () => ({ style: {} }), querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, head: { appendChild() {} }, body: { appendChild() {} }, documentElement: {} };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', relativeFile), 'utf8'), sb);
  return sb;
}

/** load public/app/shop-time.js (the one date/time formatter, CBShopTime) into a vm context; call AFTER engine/locale.js when the test loads it. Leaves CBShopTime global in the context. */
function loadShopTime(cx) {
  const vm = require('vm');
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'app', 'shop-time.js'), 'utf8'), cx);
  vm.runInContext('this.CBShopTime = (typeof window !== "undefined" ? window : this).CBShopTime', cx); /* top-level this = the context's own global, even when the test names its own globalThis */
  return cx;
}

module.exports = { liftFns, loadScript, loadShopTime };
