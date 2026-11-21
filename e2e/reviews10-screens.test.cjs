/**
 * reviews10-screens.test.cjs — reviews10 (21 Nov 2026), GF/EL web-screens 11-18 findings fixed in the shared screens.
 * OWNS      proof that: a blank price amount is no price (not 0); a bulk action only takes the ticked rows still in view; the
 *           tooltip keeps its letter s; a loader never rebuilds an open reply box; an opening bills ledger sends its opposite-side
 *           figure; place-only plan revert never makes a store Private; the register does not paint on a null report and the heat map
 *           uses the table's residual rule; Gather reads UI.laneRd; a settings reply for a section left is dropped and a saved flag is
 *           answered; the vault failure uses failWords; a purchase line that would be dropped stops the save; Bill it follows the
 *           server's verdict; one delivery save at a time; ids in worklist handlers go through escJs; a bad access level fails closed.
 * CALLED BY .github/workflows/ci.yml (Offline guards). No browser, no network.
 *   node e2e/reviews10-screens.test.cjs
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { liftFns } = require('./lib/lift-fn.cjs');
let fail = 0;
const t = (name, ok, why) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (ok ? '' : ' - ' + why)); if (!ok) fail++; };
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');
const has = (f, text) => src(f).includes(text);

// EL-18 M1: a blank amount on a by-reference entry is no price
const win = {};
vm.runInContext(src('app/price-resolve.js'), vm.createContext({ window: win, Math, Number, isFinite, Date, JSON, Object, Array, String, RegExp }));
// price-resolve attaches to `window` when defined; the sandbox's window is `win`
const P = win.CBPrice;
const r = P.resolve([{ label: 'Diwali', by: 'ref', amount: '', source: 'https://x.test' }], { qty: 1 });
t('a blank amount does not price an order at 0', !(r && r.amount === 0), JSON.stringify(r));
const r2 = P.resolve([{ label: 'List', amount: null }], { qty: 1 });
t('a null amount does not price an order at 0', !(r2 && r2.amount === 0), JSON.stringify(r2));
const r3 = P.resolve([{ label: 'List', amount: '340' }], { qty: 1 });
t('a real amount still prices', r3 && r3.amount === 340, JSON.stringify(r3));

// EL-18 M5 / M6: list-ctl
t('selectedRows keeps only rows still matched', has('app/list-ctl.js', 'shown.indexOf(item) >= 0'), 'no filter');
t('the truncation tooltip collapses white space, not the letter s', has('app/list-ctl.js', "replace(/\\s+/g, ' ').trim());") && !has('app/list-ctl.js', "replace(/s+/g"), 'regex typo');

// EL-11 M16 / M15: messages
t('loaders repaint through msgPaintQuiet (never over typed text)', has('app/cap-messages.js', 'function msgPaintQuiet()') && has('app/cap-messages.js', 'RPL.busy = false;\n  msgPaintQuiet();'), 'loader repaints');
t('the thread count says waiting unless All is shown', has('app/cap-messages.js', "(RPL.all ? ' msgs' : ' waiting')"), 'msgs label');

// EL-12 M10: opposite side figure on a bills ledger is sent
{
  const ctx = vm.createContext({ OPENING: { rows: [{ code: 'DEBT', role: 'debtors', dr: null, cr: 20000, bills: [{ party_id: 'p1', minor: 50000, ref: 'INV-1' }] }] } });
  vm.runInContext(liftFns('public/app/cap-opening.js', ['obSide', 'obHasBills', 'obRowsOut']) + '\nthis.f = { obRowsOut };', ctx);
  const out = ctx.f.obRowsOut();
  t('a Cr advance on a Debtors bills ledger is sent', out.some((x) => x.cr_minor === 20000 && !x.party_id), JSON.stringify(out));
  t('the bills are still sent', out.some((x) => x.dr_minor === 50000 && x.party_id === 'p1'), JSON.stringify(out));
}

// GF-12 M4 / M5: network plan
t('a place-only or order-only revert never falls through to Private', has('app/cap-network.js', 'if (!pl.from && !raw.from) {'), 'no guard');
t('the plan signature carries purpose, pos and place', has('app/cap-network.js', "item.purpose || '', item.pos === undefined ? null : item.pos, item.place || null]"), 'sig');

// EL-13 M8 / M9 / M4: register + readiness
t('openRegister does not paint on a null report', has('app/cap-register.js', 'if (!RG.report && !RG.err) return;\n  rgPaint();'), 'paints on null');
t('the heat map uses residual only when both are rated', has('app/cap-register.js', 'var hasRes = e.residual_likelihood && e.residual_severity;'), 'either');
t('gatherReadiness reads UI.laneRd first', has('app/cap-readiness.js', 'var it = ((UI.laneRd && UI.laneRd.clearances) || (UI.readiness && UI.readiness.clearances)'), 'laneRd');

// GF-14 M3 / EL-14 M8 / M9: settings + vault
t('a settings reply for a section left is dropped', has('app/cap-settings.js', 'if (gen !== H.gen) return reply;') && has('app/cap-settings.js', 'H.gen = (H.gen || 0) + 1;'), 'no gen');
t('a saved flag is marked answered', has('app/cap-settings.js', 'policyData.r.asked[k] = true;'), 'asked');
t('the vault failure line uses failWords', has('app/cap-shop.js', "errorBox.textContent = failWords(failure, tx('Could not save the vault'))"), 'raw message');

// EL-15 S3 / T1: purchase lines + Bill it
t('a purchase line that would be dropped stops the save', has('app/cap-supplies.js', 'supReadLines(true)') && has('app/cap-supplies.js', 'A line has no name, no quantity or a bad cost'), 'silent drop');
t('Bill it follows the server verdict and waits for Accept', has('app/cap-tasks.js', 'acts.bill && acts.bill.ok === false') && has('app/cap-tasks.js', "T('Accept the order first')"), 'client verdict');

// GF-16 M1 / M4 / M7: worklist + workforce
t('worklist ids in handlers go through escJs', !/&quot;'\s*\+\s*(r\.line_id|r\.chit_id|e\.raida_id)\s*\+\s*'&quot;/.test(src('app/cap-worklist.js')), 'raw id in a handler');
t('one delivery save at a time', has('app/cap-worklist.js', 'if (WLL.saving) return;'), 'no guard');
t('an unknown access level fails closed to view_only', has('app/cap-workforce.js', "viewer: 'view_only' }[_lvl] || 'view_only'"), 'act default');
t('workforce handler ids through escJs', !has('app/cap-workforce.js', "('${x.id}'") && has('app/cap-traceability.js', 'escJs(item.chit_id)'), 'raw id');

console.log(fail ? '\n' + fail + ' FAILED' : '\nall ok');
process.exit(fail ? 1 : 0);
