'use strict';
// @type: unit
/**
 * bank-ui-answers.test.cjs - what one answer on a statement line does to OTHER lines, and how the interest the owner types is read (fixWeb02, batch 1128).
 *
 * OWNS      the proof that public/app/bank-preview-ui.js (1) gives a tax-invoice answer to the line it was asked on and to no look-alike (DEC-267: no GST credit without the
 *           question), (2) gives an account answer to the look-alikes of the SAME direction only, only on the explicit "Use this for N similar" press, and says N,
 *           (3) reads the interest through the one money reader with the shop's decimal mark: "250,50" is 250.50 (25050 minor) where the comma is the decimal, never 25,050.00
 * CALLED BY ci.yml (the unit checks): node e2e/bank-ui-answers.test.cjs
 * FLOW      load the painter with a fake controller and a fake host (no browser) -> press the buttons the host hears -> read what the controller was told
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 */
const fs = require('fs'),
  path = require('path'),
  assert = require('assert');
const pub = (rel) => path.join(__dirname, '..', 'public', rel);
let ran = 0;
const ok = (name) => console.log('ok  ' + name) || ran++;

globalThis.esc = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
globalThis.CBBankPreview = { looksLike: () => '', sentenceOf: () => '', dateText: (d) => d, NEEDS_WORDS: {}, STATE_WORDS: {}, asWritten: () => '' };
require(pub('app/bank-preview-ui-parts.js'));
const UI = require(pub('app/bank-preview-ui.js'));

/** four lines: two payments and one receipt that say the same words, and one payment that says something else */
const line = (key, debit, credit, narration) => ({ key, state: 'needs_you', line: { narration, debit_minor: debit, credit_minor: credit, date: '2026-10-01' } });
function setup(extra) {
  const told = [];
  const items = [line('p1', 5000, 0, 'ADJUSTMENT 1'), line('p2', 5000, 0, 'ADJUSTMENT 2'), line('r1', 0, 5000, 'ADJUSTMENT 3'), line('x1', 5000, 0, 'OFFICE RENT')];
  const controller = {
    view: () => ({ items }),
    invoice: (key, answer) => (told.push(['invoice', key, answer]), { ok: true }),
    resolveLine: (key, answers) => (told.push(['resolve', key, answers]), { ok: true }),
    interest: (key, minor) => (told.push(['interest', key, minor]), { ok: true }),
    loans: () => []
  };
  const said = [];
  const handlers = {};
  const fields = {}; /* 'act|key' -> value, the selects and inputs the fake host holds */
  const host = {
    addEventListener: (type, fn) => (handlers[type] = fn),
    querySelectorAll: () => Object.keys(fields).map((id) => ({ value: fields[id], getAttribute: (n) => (n === 'data-key' ? id.split('|')[1] : id.split('|')[0]) }))
  };
  /* the fake host answers querySelectorAll by selector: keep only the elements of the asked data-act */
  host.querySelectorAll = (selector) => Object.keys(fields).filter((id) => selector.indexOf('"' + id.split('|')[0] + '"') >= 0).map((id) => ({ value: fields[id], getAttribute: (n) => (n === 'data-key' ? id.split('|')[1] : null) }));
  const mounted = UI.mount(Object.assign({ host, controller: () => controller, currency: 'AUD', country: 'AU', say: (w) => said.push(w), changed: () => {} }, extra || {}));
  const press = (act, key, data) => handlers.click({ target: { closest: () => ({ getAttribute: (n) => (n === 'data-act' ? act : n === 'data-key' ? key : (data || {})[n] || null) }) } });
  return { told, said, press, fields, mounted, items };
}

/* 1 · a tax-invoice answer stays on its own line */
{
  const t = setup();
  t.press('inv', 'p1', { 'data-v': 'held' });
  assert.deepStrictEqual(t.told, [['invoice', 'p1', 'held']], 'p2 and r1 look alike but were never asked: they stay unanswered');
  ok('"I hold the tax invoice" on one line reaches that line only, never a look-alike that was not asked');
}

/* 2 · the account answer: this line alone at first; the look-alikes of the same direction only on the explicit press, with their count */
{
  const t = setup();
  t.fields['acct|p1'] = 'office_supplies';
  t.fields['taxkind|p1'] = 'gst';
  t.press('useacct', 'p1');
  assert.deepStrictEqual(t.told, [['resolve', 'p1', { account: 'office_supplies', tax_kind: 'gst' }]], 'the first answer is this line alone: nothing is applied to the others by itself');
  /* the offer is on the line: one payment look-alike (p2), the receipt (r1) and the other words (x1) are not counted */
  const html = t.mounted.panel(t.items[0], null);
  assert.ok(/data-act="similar"/.test(html) && /Use this for 1 similar/.test(html) && /data-cbsid="BKS017-B08"/.test(html), 'the press is offered with its count (1) and carries its code: ' + html.slice(0, 300));
  t.press('similar', 'p1');
  assert.deepStrictEqual(t.told.slice(1), [['resolve', 'p2', { account: 'office_supplies', tax_kind: 'gst' }]], 'only the same-direction look-alike p2; the receipt r1 is never given an expense account');
  assert.ok(/Applied to 1 similar line/.test(t.said[t.said.length - 1]), 'the count is said: ' + t.said.join('|'));
  t.press('similar', 'p1');
  assert.strictEqual(t.told.length, 2, 'the offer is spent: a second press changes nothing');
  ok('an account answer is OFFERED to the same-direction look-alikes (a receipt is never one), applied only on the press, and the count is said');
}

/* 3 · the interest reads with the shop's decimal mark through the ONE reader (the real CBUiMoney over the real CBUiField and the engine's CBMoney, only the locale is a stand-in) */
{
  const vm = require('vm');
  globalThis.window = globalThis;
  globalThis.ui = { words: (english) => english, escape: globalThis.esc, style() {} };
  globalThis.CBMoney = require(pub('engine/money.js'));
  const locale = { mark: '.' };
  globalThis.CBLocale = { number: () => (locale.mark === ',' ? '1.234.567,5' : '1,234,567.5') };
  vm.runInThisContext(fs.readFileSync(pub('app/ui-field.js'), 'utf8'));
  vm.runInThisContext(fs.readFileSync(pub('app/ui-money.js'), 'utf8'));
  globalThis.CBUiMoney = vm.runInThisContext('CBUiMoney');
  const read = (typed, mark) => {
    locale.mark = mark;
    const t = setup();
    t.fields['interestfield|p1'] = typed;
    t.press('interest', 'p1');
    return { told: t.told.filter((entry) => entry[0] === 'interest').map((entry) => entry[2]), said: [t.mounted.panel(t.items[0], null)] }; /* a refusal is said ON THE LINE: it is in the line's panel */
  };
  assert.deepStrictEqual(read('250,50', ',').told, [25050], 'decimal-comma shop: "250,50" is 250.50, 25050 minor units, never 25,050.00 (2505000)');
  assert.deepStrictEqual(read('1.250,75', ',').told, [125075], 'decimal-comma shop: "1.250,75" is 1,250.75');
  assert.deepStrictEqual(read('250.50', '.').told, [25050], 'decimal-point shop: "250.50" is 250.50');
  assert.deepStrictEqual(read('1,250.75', '.').told, [125075], 'decimal-point shop: "1,250.75" is 1,250.75 (the comma groups)');
  assert.deepStrictEqual(read('250s', '.').told, [], '"250s" is no number: nothing is sent');
  assert.ok(read('250s', '.').said.some((w) => /number/.test(w)), 'and it is said in words');
  assert.deepStrictEqual(read('', '.').told, [''], 'a blank clears the interest');
  /* a page without the reader (the no-login demo): digits with one point only; a comma that could be a decimal mark is refused, never guessed */
  globalThis.CBUiMoney = undefined;
  assert.deepStrictEqual(read('250.50', '.').told, [25050]);
  assert.deepStrictEqual(read('250,50', '.').told, [], 'without the shop reader "250,50" is refused, not read as 25,050.00');
  ok('the interest is read through the one money reader with the shop\'s decimal mark: "250,50" is 250.50 (25050) in a decimal-comma shop, "250s" is refused');
}
console.log(ran + ' checks passed');
