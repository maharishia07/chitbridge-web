// check-adoption.js — the SPEC-adoption-generalize regression: an adopted catalogue must render for ANY vertical.
//
// The bar (from the spec's rollout gate): a veg/meat store's adopted catalogue renders with ZERO paint artifacts and
// correct per-product units, while PAINT renders exactly as before. Cases 1–3 are asserted here; cases 4 (no
// double-create) and 5 (manage link) are UI flows and live in e2e/tests/catalogue-wizard.spec.js.
//
// It pulls the REAL renderers out of public/app.html (no copies to drift) and runs them in a vm with just esc + UI,
// so this stays a pure function-contract test — no browser, no server, no DB.
// Run:  node scripts/check-adoption.js
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// CB_APP_HTML overrides the target — used to prove this check actually FAILS against the pre-fix app.html
// (a regression test that cannot fail on the old code is not a regression test).
const html = fs.readFileSync(process.env.CB_APP_HTML || path.join(root, 'public', 'app.html'), 'utf8');

// lift the renderers + their helpers straight out of the page (each ends at the next top-level `function `)
const NEEDED = ['_refPrice', '_refPriceHTML', '_refChips', '_refFacts', '_refPhoto', 'refFinishRow', 'refFinishDetail', '_swatch', '_combo'];
let src = 'var _REF_SKIP=' + (/var _REF_SKIP=(\{[^}]*\});/.exec(html) || [])[1] + ';\n';
for (const fn of NEEDED) {
  const m = new RegExp('^function ' + fn + '\\b[\\s\\S]*?(?=^function |^var |^\\/\\/)', 'm').exec(html);
  if (!m) { console.log('SETUP FAIL — could not lift ' + fn + '() out of app.html'); process.exit(1); }
  src += m[0] + '\n';
}
const ctx = {
  UI: { refSel: null },
  esc: (v) => String(v == null ? '' : v).replace(/[<>"&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', '&': '&amp;' }[c])),
};
try { new vm.Script(src).runInNewContext(ctx); }
catch (e) { console.log('SETUP FAIL — lifted source did not evaluate: ' + e.message); process.exit(1); }

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); console.log('  ok  ' + name); pass++; } catch (e) { console.log('  XX  ' + name + ' — ' + e.message); fail++; } };
const has = (h, s, why) => { if (h.indexOf(s) < 0) throw new Error('expected to find ' + JSON.stringify(s) + (why ? ' (' + why + ')' : '')); };
const not = (h, s, why) => { if (h.indexOf(s) >= 0) throw new Error('expected NOT to find ' + JSON.stringify(s) + (why ? ' (' + why + ')' : '')); };

// ── the two fixtures: what a paint item and a veg item actually look like coming back from catalogue-mine ──
const PAINT = {
  name: 'Tussar', texture_family: 'weave', region: 'East', effect: ['luminous', 'elegant'], scale: 'single big wall',
  sheen: 'metallic', inspiration: 'Bhagalpur tussar silk.', tools: ['trowel', 'sponge'], coats: '1 base + 2 effect',
  combinations: [{ name: 'Silk Route', colours: [{ name: 'Raw Silk', hex: '#C9A86A' }] }],
  commercials: { price_per_litre: 950 },
};
const VEG = {
  name: 'Tomato', local_names: ['Thakkali', 'Tamatar'], botanical_name: 'Solanum lycopersicum', category: 'vegetable',
  photo: 'data:image/jpeg;base64,AAAA', commercials: { price: 40, unit: 'kg' },
};
const EGG = { name: 'Egg', category: 'poultry', commercials: { price: 7, unit: 'count' } };

// ── CASE 1 · PAINT UNCHANGED (the guardrail — this pass must be additive, not a rewrite) ──
t('case 1 · paint row keeps combinations, swatches, application and ₹/L', () => {
  const h = ctx.refFinishRow(PAINT, 0);
  has(h, 'Colour combinations', 'paint has combinations, so the block must render');
  has(h, '#C9A86A', 'named swatch must still render');
  has(h, 'Applied with trowel, sponge', 'application line must survive');
  has(h, '1 base + 2 effect');
  has(h, '₹950'); has(h, '/L', 'pre-generic price_per_litre still reads as /L');
  has(h, 'weave', 'texture chip'); has(h, 'East', 'region chip'); has(h, 'luminous', 'effect chip');
});
t('case 1 · paint detail keeps the full showcase', () => {
  const h = ctx.refFinishDetail(PAINT);
  has(h, 'Colour combinations'); has(h, '#C9A86A'); has(h, 'Applied with trowel, sponge');
  has(h, '₹950'); has(h, '/ L');
});

// ── CASE 2 · VEG CLEAN (the actual bug: paint artifacts on a non-paint item) ──
t('case 2 · veg row shows name · local/botanical · photo · ₹/kg', () => {
  const h = ctx.refFinishRow(VEG, 0);
  has(h, 'Tomato');
  has(h, 'local names', 'the item\'s own fields must surface');
  has(h, 'Thakkali, Tamatar', 'array fields join, not [object Object]');
  has(h, 'botanical name'); has(h, 'Solanum lycopersicum');
  has(h, 'background-image:url(data:image/jpeg;base64,AAAA)', 'the photo must render');
  has(h, '₹40'); has(h, '/kg', 'price in the ITEM\'s unit, not litres');
});
t('case 2 · veg row has NO paint artifacts', () => {
  const h = ctx.refFinishRow(VEG, 0);
  not(h, 'Colour combinations', 'no combos → no header');
  not(h, 'Applied with', 'no tools → no dangling application line');
  not(h, 'optchip', 'no texture/region/effect → no empty chip pills');
  not(h, '/L<', 'must never render a litre price for a kg item');
});
t('case 2 · veg detail has no paint artifacts either', () => {
  const h = ctx.refFinishDetail(VEG);
  not(h, 'Colour combinations'); not(h, 'Applied with'); not(h, 'optchip');
  has(h, '₹40'); has(h, '/ kg');
});
t('case 2 · the by-reference marker survives on every vertical', () => {
  has(ctx.refFinishRow(VEG, 0), '🎨 referenced', 'the reference marker is the model, not a paint detail');
  has(ctx.refFinishRow(PAINT, 0), '🎨 referenced');
});

// ── CASE 3 · PER-PRODUCT UNIT (one catalogue, several units) ──
t('case 3 · two items in one catalogue render their OWN units', () => {
  has(ctx.refFinishRow(VEG, 0), '/kg');
  has(ctx.refFinishRow(EGG, 1), '/count');
  not(ctx.refFinishRow(EGG, 1), '/kg', 'egg must not inherit the tomato\'s unit');
});

// ── backward compatibility: the shape written before this pass must keep rendering ──
t('back-compat · price_per_litre still prices (existing paint adoptions)', () => {
  const p = ctx._refPrice({ commercials: { price_per_litre: 950 } });
  if (!p || Number(p.v) !== 950 || p.u !== 'L') throw new Error('expected {v:950,u:"L"}, got ' + JSON.stringify(p));
});
t('back-compat · generic price wins when both are present', () => {
  const p = ctx._refPrice({ commercials: { price: 40, unit: 'kg', price_per_litre: 950 } });
  if (!p || Number(p.v) !== 40 || p.u !== 'kg') throw new Error('expected {v:40,u:"kg"}, got ' + JSON.stringify(p));
});
t('back-compat · no commercials → "no price", never a crash or NaN', () => {
  const h = ctx.refFinishRow({ name: 'Unpriced' }, 0);
  has(h, 'no price'); not(h, 'NaN'); not(h, 'undefined');
});

// ── the empty-render trap this pass exists to close ──
t('no field renders as the literal "undefined"', () => {
  for (const it of [PAINT, VEG, EGG, { name: 'Bare' }]) {
    not(ctx.refFinishRow(it, 0), 'undefined', 'a missing field must be omitted, not stringified');
    not(ctx.refFinishDetail(it), 'undefined');
  }
});

// ── WIZARD CONTRACT · the order METHOD (what data the business gets back from a buyer) ──
// The wizard used to hardcode method:'cart' at finish, silently discarding the vertical's own declared method —
// a gold or trade catalogue became a cart. These assertions run against the real cap-catalogue.js.
const capSrc = fs.readFileSync(path.join(root, 'public', 'app', 'cap-catalogue.js'), 'utf8');
const capCtx = { UI: {}, renderApp() {}, esc: (v) => String(v == null ? '' : v), val: () => '', toast() {},
                 CBCatalogue: { ensure: (x) => x }, api: null, document: { getElementById: () => null } };
try { new vm.Script(capSrc).runInNewContext(capCtx); }
catch (e) { console.log('  XX  cap-catalogue.js did not evaluate — ' + e.message); fail++; }

if (capCtx._cwMethod) {
  t('wizard · each vertical keeps its OWN declared order method (not a hardcoded cart)', () => {
    for (const v of Object.keys(capCtx.CATF_KB)) {
      const want = capCtx.CATF_KB[v].method, got = capCtx._cwMethod({ vertical: v, method: '' });
      if (got !== want) throw new Error(v + ' should default to ' + want + ', got ' + got);
    }
  });
  t('wizard · an explicit pick overrides the vertical default', () => {
    if (capCtx._cwMethod({ vertical: 'gold', method: 'qtyprice' }) !== 'qtyprice') throw new Error('explicit method ignored');
  });
  t('wizard · every order method states WHAT DATA the business receives', () => {
    for (const m of capCtx.CATF_METHODS) {
      if (!m.receives || !m.receives.length) throw new Error(m.k + ' has no `receives` — the choice must be made on the data, not the widget');
      if (!m.label || !m.hint) throw new Error(m.k + ' missing label/hint');
    }
  });
  t('wizard · "information only" collects no prices', () => {
    const h = capCtx._cwStep5({ vertical: 'veg', method: 'text', erpMap: {}, prices: {}, chosen: {} });
    if (h.indexOf('information only') < 0) throw new Error('text method must explain that nothing is priced');
    if (h.indexOf('<input type="number"') >= 0) throw new Error('text method must not render price inputs');
  });
}

console.log('\ncheck-adoption: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
