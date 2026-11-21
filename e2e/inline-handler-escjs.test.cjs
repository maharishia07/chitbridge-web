// e2e/inline-handler-escjs.test.cjs — AV-F-02 sweep (2026-11-22): user text in an inline on*= handler never runs.
// Renders the REAL painters with a hostile value, reads the on*= attribute the way a browser does (entities decoded BEFORE the JS runs),
// runs it with every handler name stubbed, and proves (1) no code runs, (2) the handler gets the hostile text back as plain text.
// Families: finance-pay bill doors (bill reference = supplier's own text) · media gallery remove (media id) · network node keys (source sweep).
// Pattern: chitbridge-api tests/till-inline-handler-xss.test.cjs. Run: node e2e/inline-handler-escjs.test.cjs   (offline, no DB, no browser)
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const pub = path.join(__dirname, '..', 'public', 'app');
const PAYLOAD = "');pwn();//";
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function fnSource(file, name) {
  const src = fs.readFileSync(path.join(pub, file), 'utf8');
  const i = src.indexOf('function ' + name + '(');
  assert(i >= 0, name + ' not found in ' + file);
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
  throw new Error('unbalanced ' + name);
}
function handlersOf(html) { return [...html.matchAll(/\son[a-z]+="([^"]*)"/g)].map((m) => decode(m[1])); }
function runHandlers(html, calls) {
  let pwned = 0;
  const stubs = new Proxy({ pwn() { pwned++; }, event: { stopPropagation() {} }, window: {}, this: {} }, { has: () => true, get: (t, k) => (k in t ? t[k] : (...a) => { calls.push([String(k), a]); }) });
  for (const h of handlersOf(html)) { try { vm.runInNewContext(h, stubs, { timeout: 200 }); } catch (e) { /* a handler that throws ran no payload */ } }
  return pwned;
}
const base = { esc: undefined };
const helpers = new Function(fnSource('helpers.js', 'esc') + '\n' + fnSource('helpers.js', 'escJs') + '\nreturn { esc, escJs };')();
let n = 0;
const ok = (m) => { n++; console.log('  ok   ' + m); };

// 1. finance-pay: the bill reference is the supplier's own text
{
  const ctx = vm.createContext({ esc: helpers.esc, escJs: helpers.escJs, tx: (s) => s });
  vm.runInContext(fnSource('cap-finance-pay.js', 'fpBillActs') + '\n' + fnSource('cap-finance-pay.js', 'fpHeldRow') + ';this.fpBillActs=fpBillActs;this.fpHeldRow=fpHeldRow;', ctx);
  ctx.CBList = { nextRow: () => '' }; ctx.bkDate = String; ctx.bkMoney = String; ctx.FP = { cur: 'INR' }; ctx.FP_HELD_WORD = 'held';
  const html = ctx.fpBillActs({ party_id: PAYLOAD }, { ref: PAYLOAD });
  const calls = [];
  assert.strictEqual(runHandlers(html, calls), 0, 'payload ran');
  const hold = calls.find((c) => c[0] === 'fpHold');
  assert(hold && hold[1][0] === PAYLOAD && hold[1][1] === PAYLOAD, 'fpHold did not receive the text intact: ' + JSON.stringify(hold));
  const held = ctx.fpHeldRow('x', { against_ref: PAYLOAD, bill_no: 'b', open_minor: 1 }, () => '', PAYLOAD);
  const calls2 = [];
  assert.strictEqual(runHandlers(held, calls2), 0, 'held row payload ran');
  const rel = calls2.find((c) => c[0] === 'fpRelease');
  assert(rel && rel[1][0] === PAYLOAD && rel[1][1] === PAYLOAD, 'fpRelease did not receive the text intact');
  ok('finance-pay: hostile bill reference and party id reach fpHold / fpNoteDiff / fpRelease as plain text, no code runs');
}
// 2. control: the unsafe shape DOES run (so the proof above is not vacuous)
{
  const unsafe = '<button onclick="f(\'' + helpers.esc(PAYLOAD) + '\')">';
  assert.strictEqual(runHandlers(unsafe, []), 1, 'control: esc() alone should let the payload run');
  ok('control: esc() inside a JS string DOES run the payload (the proof is not vacuous)');
}
// 3. media gallery: remove button takes a media id
{
  const ctx = vm.createContext({ esc: helpers.esc, escJs: helpers.escJs, encodeURIComponent, tx: (s) => s });
  ctx.window = ctx;
  vm.runInContext(fs.readFileSync(path.join(pub, 'catalogue-lines.js'), 'utf8'), ctx);
  assert.strictEqual(typeof ctx.cbMediaGallery, 'function', 'cbMediaGallery not loaded');
  const html = ctx.cbMediaGallery({ media: [{ id: PAYLOAD, kind: 'image', key: 'k' }] }, { itemId: 'i', apiBase: '', onRemove: "prodMediaRemove('i','{id}')" });
  const calls = [];
  assert.strictEqual(runHandlers(html, calls), 0, 'gallery payload ran');
  const rm = calls.find((c) => c[0] === 'prodMediaRemove');
  assert(rm && rm[1][1] === PAYLOAD, 'prodMediaRemove did not receive the id intact: ' + JSON.stringify(rm));
  ok('media gallery: hostile media id reaches prodMediaRemove as plain text, no code runs');
}
// 4. network node keys ride through escJs in every handler of cap-network.js
{
  const src = fs.readFileSync(path.join(pub, 'cap-network.js'), 'utf8');
  const bad = src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /\bon[a-z]+=/.test(l) && /'\s*\+\s*n\.key\s*\+/.test(l));
  assert.deepStrictEqual(bad, [], 'bare n.key inside a handler: ' + JSON.stringify(bad.slice(0, 3)));
  const multi = [...src.matchAll(/\bon[a-z]+="[a-zA-Z]+\(\\'' \+\s*\n\s*n\.key \+/g)];
  assert.strictEqual(multi.length, 0, 'bare n.key (multi-line) inside a handler');
  assert(/escJs\(n\.key\)/.test(src), 'escJs(n.key) expected');
  ok('network: node keys are escJs-wrapped in every handler');
}
console.log('inline-handler-escjs: ' + n + ' checks passed');
