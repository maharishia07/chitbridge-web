'use strict';
// @type: unit
/* CARD: retest 1130 (lane retest1129b): proof for two landed P1 fixes no test named. Offline: real functions lifted from the page source and run in a vm.
   AE2-F-03 (AE shop, cart added VAT on a VAT-inclusive price): public/app/cart.js inclOf_ reads the page's option, else the catalogue's own shop.price_includes_tax.
   EL-web-screens-03#L45 (a refused profile/settings save used to navigate away over a "Saved."): public/app/cap-admin-guard.js profSaveSections + profGuardDo.
   Break check: each block also runs against the pre-fix shape (the flip lines) and must fail. Run: node tests/retest-1130-web-guards.test.cjs */
const fs = require('fs'), vm = require('vm'), path = require('path');
const pub = path.join(__dirname, '..', 'public');
let n = 0, fail = 0;
const ok = (name, cond, why) => { n++; if (!cond) { fail++; console.log('  FAIL ' + name + (why ? ' - ' + why : '')); } else console.log('  ok  ' + name); };
const grab = (src, head) => { const at = src.indexOf(head); if (at < 0) throw new Error(head + ' is gone'); let i = src.indexOf('{', at), d = 0; for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) break; } return src.slice(at, i + 1); };

/* AE2-F-03 */
const cart = fs.readFileSync(path.join(pub, 'app', 'cart.js'), 'utf8');
const incl = (src, s) => { const c = vm.createContext({}); vm.runInContext(grab(src, 'function inclOf_(') + '; this.f = inclOf_;', c); return c.f(s); };
const AE = { cat: { shop: { price_includes_tax: true } }, opts: {} };
ok('AE2-F-03 a catalogue that says price_includes_tax is read as inclusive when the page states none', incl(cart, AE) === true);
ok('AE2-F-03 a catalogue that says exclusive stays exclusive', incl(cart, { cat: { shop: { price_includes_tax: false } }, opts: {} }) === false && incl(cart, { cat: { shop: {} }, opts: {} }) === false);
ok('AE2-F-03 the page option wins over the catalogue (both ways)', incl(cart, { cat: { shop: { price_includes_tax: true } }, opts: { priceIncludesTax: false } }) === false && incl(cart, { cat: { shop: { price_includes_tax: false } }, opts: { priceIncludesTax: true } }) === true);
ok('AE2-F-03 compute() hands the cart money the same basis (priceIncludesTax: inclOf_(s))', /priceIncludesTax: inclOf_\(s\)/.test(cart));
const pre = "function inclOf_(s) { return !!(s.opts && s.opts.priceIncludesTax); }"; /* the shape before 4f30b10a: only the page's option */
{ const c = vm.createContext({}); vm.runInContext(pre + '; this.f = inclOf_;', c); ok('flip: the pre-fix basis (page option only) reads the AE catalogue as exclusive', c.f(AE) === false); }

/* EL-web-screens-03#L45 */
const g = fs.readFileSync(path.join(pub, 'app', 'cap-admin-guard.js'), 'utf8');
function run(src, saved) {
  const log = { toasts: [], went: 0, snap: 0 };
  const ctx = { PROF_FIELDS: {}, UI: { _profGo: () => { log.went++; }, _guardMap: null }, tx: (s) => s, toast: (m) => log.toasts.push(m), closeModal() {}, profDirtySections: () => ['a'],
    saveProfile: async () => saved, saveSettings: async () => saved, saveAutoAssign: async () => saved, profSnapshot: () => { log.snap++; } };
  vm.createContext(ctx);
  vm.runInContext(grab(src, 'async function profSaveSections(') + '\n' + grab(src, 'async function profGuardDo(') + '\n;this.go = profGuardDo;', ctx);
  return ctx.go('save').then(() => log);
}
(async () => {
  const refused = await run(g, false);
  ok('EL-web-screens-03#L45 a refused save stays: no navigation, the reason toast, no "Saved."', refused.went === 0 && refused.toasts.some((t) => /Not saved/.test(t)) && !refused.toasts.includes('Saved.'), JSON.stringify(refused));
  const good = await run(g, true);
  ok('EL-web-screens-03#L45 an accepted save says Saved. and goes on', good.went === 1 && good.toasts.includes('Saved.'), JSON.stringify(good));
  const broken = g.replace('if (done === false) refused = true;', '');
  const b = await run(broken, false);
  ok('flip: without the refusal check a refused save navigates away over "Saved."', b.went === 1 && b.toasts.includes('Saved.'));
  console.log(n + ' checks, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
