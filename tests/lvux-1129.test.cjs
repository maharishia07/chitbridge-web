'use strict';
/* LVUX (1129), lens-verify LV-16 / LV-17 and two P3s. Each case fails on the parent.
   1 · LV-17 the CRM record's bill count: a party with 150 bills read through a 100-entry timeline says 150 when the server sends `bills`
   2 · P3 the Do-first digit is the number of THINGS (12 orders + 4 tasks = 16), one function (needsCount) for the digit and the bell
   3 · P3 a toast with Undo is not cleared by the 4.5 s timer (WCAG 2.2.1), and has a dismiss
   4 · LV-16 modal(): role=dialog, aria-modal, a name, focus in on open, Tab / Shift-Tab trapped; home2's <dialog> has an aria-labelledby that points at its title
   Run: node tests/lvux-1129.test.cjs */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8').split('\r\n').join('\n');
const cut = (src, name) => { const a = src.indexOf('function ' + name + '('); assert(a >= 0, name + ' exists'); let d = 0; for (let j = src.indexOf('{', a); j < src.length; j++) { if (src[j] === '{') d++; if (src[j] === '}' && --d === 0) return src.slice(a, j + 1); } };
let n = 0; const ok = (m) => { n++; console.log('  ok  ' + m); };

/* 1 */
const rec = read('public/app/cap-crm-record.js');
const ctx1 = {}; vm.createContext(ctx1);
vm.runInContext(cut(rec, 'crmCountUnbilled') + '\n' + cut(rec, 'crmBillFacts') + '\nthis.f = crmBillFacts;', ctx1);
const hundred = []; for (let i = 0; i < 100; i++) hundred.push({ kind: 'bill', src: 'chit', at: '2026-03-' + String(1 + (i % 28)).padStart(2, '0') });
assert.strictEqual(ctx1.f(hundred).bills, 100, 'the page alone can say only 100');
assert.strictEqual(ctx1.f(hundred, { n: 150, last_at: '2026-06-30T00:00:00.000Z' }).bills, 150, 'the server count wins'); ok('a busy party: 150 bills, not the 100 of a timeline page');
assert.strictEqual(ctx1.f(hundred, { n: 150, last_at: '2026-06-30T00:00:00.000Z' }).lastBill, '2026-06-30T00:00:00.000Z'); ok("the last bill date is the server's");
assert.strictEqual(ctx1.f(hundred, { n: 0, last_at: null }).bills, 0, 'the server says none: none'); ok("server 0 is 0, not the page's count");
assert(/crmBillFacts\(rec\.timeline_all \|\| rec\.timeline_head, rec\.bills\)/.test(rec), "both callers hand the record's bills over"); ok('the record and the due chip both read rec.bills');

/* 2 */
const home = read('public/app/home2.js');
const ctx2 = {}; vm.createContext(ctx2); vm.runInContext(cut(home, 'needsCount') + '\nthis.f = needsCount;', ctx2);
const doors = [{ n: 1, t: 'a' }, { n: 12, t: '12 new orders' }, { n: 4, t: '4 tasks for you' }];
assert.strictEqual(ctx2.f(doors), 17); assert.strictEqual(ctx2.f([{ n: 12 }, { n: 4 }]), 16, '12 orders and 4 tasks are 16, not 2'); ok('Do first counts things (12 + 4 = 16), not doors');
assert(/data-testid="ix2-do-count">' \+ needsCount\(doors\)/.test(home), 'the digit reads needsCount'); ok('the Do-first digit reads needsCount (the bell is the feed count, FW-39)');
assert(!/>' \+ doors\.length \+ '<\/b>/.test(home), 'no digit from doors.length'); ok('no door-count digit left');

/* 3 */
const words = read('public/app/cb-words.js'); const toast = cut(words, 'toast');
assert(/if \(!undo\) toast\._t = setTimeout/.test(toast), 'only a plain notice fades'); assert(/id="undoX"/.test(toast), 'a dismiss'); ok('a toast with Undo stays until pressed or dismissed');

/* 4 · a small fake page: modal() open, focus, trap */
const app = read('public/app.html') + '\n' + read('public/app/modal-dialog.js'); /* the dialog pattern lives in app/modal-dialog.js */
const code = ['modal', 'modalFocusables', 'modalDialogOpen', 'modalTabTarget', 'modalTrapKey'].map((f) => cut(app, f)).join('\n') + "\nconst MODAL_FOCUSABLE = 'a[href],button,input,select,textarea,summary,[tabindex]';";
let page;
function el(name, cls) { return { name, attrs: {}, getAttribute(k) { return this.attrs[k] == null ? null : this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = v; }, classList: { contains: (c) => (cls || '') === c }, focus() { page.active = this; }, type: 'button' }; }
function open(withTitle) {
  const close = el('close', 'mx'), first = el('first-field'), save = el('save'), title = withTitle ? el('title') : null;
  const box = el('box'); const inner = [close, first, save]; box.contains = (x) => x === box || inner.includes(x); box.querySelectorAll = () => inner;
  const body = el('body'); const host = { style: {}, innerHTML: '', querySelector: (s) => (s === '.modal' ? box : /\.mhd \.t/.test(s) ? title : null) };
  page = { active: body, host, box, close, first, save, title }; return page;
}
function sandbox() {
  const doc = { get activeElement() { return page.active; }, getElementById: (id) => (id === 'modalhost' ? page.host : null) };
  const c = { document: doc, UI: {}, tx: (s) => s, rememberModalOpener() {}, mvModal() {}, modalStamp() {}, console };
  vm.createContext(c); vm.runInContext(code + '\nthis.modal = modal; this.trap = modalTrapKey;', c); return c;
}
const tab = (shift) => ({ key: 'Tab', shiftKey: !!shift, prevented: false, preventDefault() { this.prevented = true; } });
assert(/class="modal\$\{wide \? ' wide' : ''\}" role="dialog" aria-modal="true"/.test(cut(app, 'modal')), 'modal() paints role=dialog + aria-modal'); ok('modal() paints role=dialog and aria-modal=true');
let c = sandbox(); open(true); c.modal('<x>');
assert.strictEqual(page.box.attrs['aria-labelledby'], 'modal-title'); assert.strictEqual(page.title.id, 'modal-title'); ok('the dialog is named by its title (aria-labelledby)');
assert.strictEqual(page.active, page.first); ok('focus moves in on open: the first control, not the corner X');
c = sandbox(); open(false); c.modal('<x>'); assert.strictEqual(page.box.attrs['aria-label'], 'Dialog'); ok('no title: it still has an accessible name');
c = sandbox(); open(true); c.modal('<x>'); page.active = page.save; let e = tab(false); c.trap(e); assert(e.prevented && page.active === page.close, 'wrap from last to first'); ok('Tab on the last control wraps to the first');
page.active = page.close; e = tab(true); c.trap(e); assert(e.prevented && page.active === page.save); ok('Shift-Tab on the first control wraps to the last');
page.active = page.first; e = tab(false); c.trap(e); assert(!e.prevented, 'inside the dialog Tab is left to the browser'); ok('Tab in the middle is not interfered with');
page.active = { elsewhere: true }; e = tab(false); c.trap(e); assert(e.prevented && page.active === page.close); ok('focus that has escaped the dialog is pulled back in');
page.host.style.display = 'none'; page.active = { elsewhere: true }; e = tab(false); c.trap(e); assert(!e.prevented); ok('a minimised compose (host hidden) does not trap');
assert(/aria-labelledby="ix2-sheet-title"/.test(home) && /<b id="ix2-sheet-title">/.test(home), 'home2 dialog is named by its title'); ok('home2 <dialog> is named (aria-labelledby the sheet title)');
console.log(n + ' checks');
