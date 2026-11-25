/**
 * reviews12-screens.test.cjs - reviews12 (21 Nov 2026), EL/GF web-screens 17-24 findings fixed in the shared screens.
 * OWNS      proof that: a definitions kind queued behind an in-flight batch is asked again, not cached empty; a refused channel line keeps the
 *           quantity already chosen; adding products to an all-products offer is refused, not narrowed; a failed re-read after a good status
 *           write does not say "could not change"; Clear payment words its failure; a required radio group is answered by any ticked radio;
 *           the promo show shortcuts ignore typing in a box.
 * CALLED BY .github/workflows/ci.yml (Offline guards). No browser, no network.
 *   node e2e/reviews12-screens.test.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
let fail = 0;
const t = (name, ok, why) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (ok ? '' : ' - ' + why)); if (!ok) fail++; };
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');
const has = (f, text) => src(f).includes(text);

t('EL-17 F3: a kind missing from the batch is asked again', has('app/core.js', 'Object.prototype.hasOwnProperty.call(by, kind)') && has('app/core.js', 'return cbDefsLive(kind);'), 'core');
t('EL-17 F8: a refused channel line puts back the earlier quantity', has('app/cart.js', 'if (hadBefore > 0) put(ns, match.item_id, hadBefore);'), 'cart');
t('GF-23 M1: adding to an all-products offer is refused', has('app/offer-add-confirm.js', 'if (adding && !(Array.isArray(appliesTo.item_ids) && appliesTo.item_ids.length))'), 'offer');
t('GF-22 M6: the re-read after a good write has its own try', /try \{\s*await read\(id\);\s*\} catch/.test(src('app/chit-sheet.js')), 'sheet');
t('Clear payment words its failure', has('app/chit-unpay.js', 'failWords(e, tx(') && !has('app/chit-unpay.js', 'toast((e && e.message)'), 'unpay');
t('EL-19 M14: a radio group counts as answered by any ticked radio', has('app/sheet-dialog.js', ':checked'), 'dialog');
t('EL-20 M1: promo shortcuts ignore typing', has('promo.html', 'if (typingInBox(e)) return;') && has('promo.html', 'e.target.isContentEditable'), 'promo');

// behaviour of the F3 retry, lifted logic: late kind is not in `by`
const vm = require('vm');
const { liftFns } = require('./lib/lift-fn.cjs');
const ctx = vm.createContext({ Promise, Object, Array, setTimeout, calls: [] });
vm.runInContext('var _DEFS={},_defsReq={},_defsQueue=[],_defsFlush=null;var api=function(n,o){ctx.calls.push(o.query.kind);return Promise.resolve({definitions:[{kind:o.query.kind.split(",")[0]}]});};var ctx=this;\n' +
  liftFns('public/app/core.js', ['cbDefsFlush', 'cbDefsLive']) + '\nthis.f={cbDefsLive};', ctx);
(async () => {
  const a = ctx.f.cbDefsLive('category');
  await Promise.resolve();
  const b = ctx.f.cbDefsLive('ordermodel');
  const [ra, rb] = await Promise.all([a, b]);
  t('a late kind is fetched in its own batch', rb.length === 1 && rb[0].kind === 'ordermodel' && ra.length === 1, JSON.stringify([ra, rb, ctx.calls]));
  console.log(fail ? 'FAILED' : 'reviews12: all ok');
  process.exit(fail ? 1 : 0);
})();
