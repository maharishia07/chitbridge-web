/**
 * grey-au-1129.test.cjs — batch 1129 GREY-AU (walk U: U-F-04, U-F-09, U-F-10), offline (vm, no browser, no network).
 * OWNS      Month lock: ONE Lock in a bar, greyed with the server's sentence for the seat · no per-row Lock x12 / sentence x8 · BAS: a shop the server says is not registered gets the sentence and a greyed Close · Bank grid: no "Not signed off" x4 per row.
 * CALLED BY .github/workflows/ci.yml (Offline guards).   node e2e/grey-au-1129.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const { liftFns } = require('./lib/lift-fn.cjs');
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');
const MONTHS = ['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];

/* ── Month lock: the bar ── */
function lockCx(info, rows) {
  const cx = vm.createContext({ tx: (s) => s, esc: (s) => String(s), BK: { lk: { fy: '2026-27', rows, info } }, bkMonths: () => MONTHS, bkMountAttribute: () => '', CBLockWords: { whoOf: () => ({ line: '', note: '', all: [] }), whyOf: (x, k) => (x && x[k] && x[k].why) || '' } });
  vm.runInContext(liftFns('public/app/cap-books-lock.js', ['bkLockWho', 'bkLockWhyWords', 'bkLockRule', 'bkLockBarHTML', 'bkLockOpenButton', 'bkLockButtonsHTML', 'bkLockSoftButtons', 'bkLockHardButton', 'bkLockSoftCount']) + '\nthis.bar = bkLockBarHTML; this.btn = bkLockButtonsHTML;', cx);
  return cx;
}
const WHY = 'Only the owner may do this.';
const refused = {}; MONTHS.forEach((m, i) => { refused['2026-27|' + (i + 1)] = { start_date: '2026-0' + 7 + '-01', lock: { may: false, why: WHY }, reopen: { may: false, why: WHY } }; });
const viewer = lockCx(refused, {});
const barHtml = viewer.bar(true);
assert.strictEqual((barHtml.match(/<button/g) || []).length, 1, 'ONE Lock button for the seat, not twelve');
assert.ok(/disabled/.test(barHtml) && barHtml.includes('title="' + WHY + '"') && barHtml.includes('data-testid="lk-bar-why"'), 'greyed WITH the server sentence for that seat');
assert.strictEqual(viewer.btn(true, 'open', 1, { may: false, why: WHY }), '', 'an open month carries no Lock of its own');
/* the owner: the first month the server lets lock is the one the bar locks */
const ok = {}; MONTHS.forEach((m, i) => { ok['2026-27|' + (i + 1)] = { lock: i === 2 ? { may: true, why: null } : { may: false, why: 'This month is not over yet.' }, reopen: { may: false, why: null } }; });
const ownerBar = lockCx(ok, { '2026-27|1': 'hard_locked', '2026-27|2': 'hard_locked' }).bar(true);
assert.ok(/onclick="bkLockDo\('lock',3\)"/.test(ownerBar) && !/disabled/.test(ownerBar) && ownerBar.includes('September'), 'the bar locks the first lockable month (September)');
assert.ok(!/This month is not over yet/.test(ownerBar), 'the other months repeat no sentence');
/* a seat the server grants may but the screen does not call the owner: still greyed */
assert.ok(/disabled/.test(lockCx(ok, {}).bar(false)));
assert.ok(src('app/cap-books-lock.js').includes('bkLockBarHTML(own) +'), 'the bar is painted above the months');

/* ── BAS: not registered ── */
const sentence = 'This shop is not registered for GST, so there is no BAS to lodge.';
const host = { innerHTML: '' };
const pcx = vm.createContext({ tx: (s) => s, esc: (s) => String(s), PE_RET: {}, peEl: () => host });
vm.runInContext(liftFns('public/app/cap-period.js', ['peReturnPaint']) + '\nthis.f = peReturnPaint;', pcx);
pcx.f({ form: 'BAS', short: 'BAS', needs: 'registration', why: sentence, periods: [], period: null, boxes: [] });
assert.ok(host.innerHTML.includes(sentence) && /data-testid="pr-close" disabled/.test(host.innerHTML) && host.innerHTML.includes('title="' + sentence + '"'), 'the sentence + a greyed Close with it');
assert.ok(!/BAS|To pay|Simpler/.test(host.innerHTML.split(sentence).join('')), 'no BAS body for an unregistered shop');
assert.ok(!/registration|\bAU\b|'AU'/.test(src('app/cap-period.js').split('\n').filter((l) => /needs === 'registration'/.test(l)).join('') .replace(/needs === 'registration'/g, '')), 'the page names no country: the server\'s flag is the source');

/* ── Bank grid: the repeated label ── */
const bank = src('app/cap-bank-home.js');
const missLines = bank.split('\n').filter((l) => l.includes('bank-stmts-miss-'));
assert.strictEqual(missLines.length, 2);
missLines.forEach((l) => { assert.ok(l.includes('class="sr-only"') && l.includes('aria-hidden="true">○'), 'a gap cell shows a mark, the words stay for a screen reader: ' + l.slice(0, 60)); });
assert.ok(/<div class="pe-note bkh-key"[^\n]*○ ' \+ bkhE\(tx\('Not signed off'\)\)/.test(bank), 'the key says it once');
console.log('grey-au-1129: all passed');
